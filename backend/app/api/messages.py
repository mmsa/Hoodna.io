from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.message import (
    MessageCreate,
    MessageResponse,
    ConversationResponse,
    ConversationDetailResponse,
)
from app.crud.message import (
    get_or_create_conversation,
    send_message,
    get_conversation_messages,
    get_user_conversations,
    mark_conversation_as_read,
)
from app.crud.user import get_user_by_id
from app.crud.listing import get_listing_by_id
from app.core.dependencies import get_current_approved_user
from app.models.user import User
from app.models.message import Conversation
from typing import List

router = APIRouter()


@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to another user. Creates conversation if it doesn't exist."""
    # Verify recipient exists
    recipient = await get_user_by_id(db, message_data.recipient_id)
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found"
        )
    
    if recipient.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send message to yourself"
        )
    
    # Verify listing exists if provided
    listing = None
    if message_data.listing_id:
        listing = await get_listing_by_id(db, message_data.listing_id)
        if not listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Listing not found"
            )
    
    # Get or create conversation
    user1_id = min(current_user.id, message_data.recipient_id)
    user2_id = max(current_user.id, message_data.recipient_id)
    conversation = await get_or_create_conversation(
        db, user1_id, user2_id, message_data.listing_id
    )
    
    # Send message
    message = await send_message(
        db, conversation.id, current_user.id, message_data.content
    )

    from app.services.notifications import notify_new_message, notify_listing_inquiry

    await notify_new_message(
        db,
        user_id=message_data.recipient_id,
        sender_name=current_user.name or "Neighbour",
        conversation_id=conversation.id,
        preview=message_data.content,
    )
    if message_data.listing_id and listing and listing.owner_id != current_user.id:
        await notify_listing_inquiry(
            db,
            listing_owner_id=listing.owner_id,
            inquirer_name=current_user.name or "Neighbour",
            listing_id=listing.id,
            listing_title=listing.title or "Listing",
        )

    await db.commit()
    await db.refresh(message)
    await db.refresh(message.sender)
    
    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=message.sender.name,
        content=message.content,
        is_read=message.is_read,
        created_at=message.created_at,
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all conversations for the current user."""
    conversations_data = await get_user_conversations(
        db, current_user.id, skip=skip, limit=limit
    )
    
    result = []
    for conv, last_msg, unread_count in conversations_data:
        # Determine other user
        other_user_id = conv.user2_id if conv.user1_id == current_user.id else conv.user1_id
        other_user = await get_user_by_id(db, other_user_id)
        
        if not other_user:
            continue
        
        # Get listing info if exists
        listing_title = None
        if conv.listing_id:
            listing = await get_listing_by_id(db, conv.listing_id)
            if listing:
                listing_title = listing.title
        
        # Format last message
        last_message = None
        if last_msg:
            await db.refresh(last_msg.sender)
            last_message = MessageResponse(
                id=last_msg.id,
                conversation_id=last_msg.conversation_id,
                sender_id=last_msg.sender_id,
                sender_name=last_msg.sender.name,
                content=last_msg.content,
                is_read=last_msg.is_read,
                created_at=last_msg.created_at,
            )
        
        result.append(ConversationResponse(
            id=conv.id,
            user1_id=conv.user1_id,
            user2_id=conv.user2_id,
            listing_id=conv.listing_id,
            listing_title=listing_title,
            other_user_id=other_user.id,
            other_user_name=other_user.name,
            other_user_email=other_user.email,
            last_message=last_message,
            unread_count=unread_count,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        ))
    
    return result


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific conversation with all messages."""
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Verify user is part of conversation
    if conversation.user1_id != current_user.id and conversation.user2_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this conversation"
        )
    
    # Get messages
    messages = await get_conversation_messages(db, conversation_id, current_user.id)
    
    # Mark as read
    await mark_conversation_as_read(db, conversation_id, current_user.id)
    await db.commit()
    
    # Determine other user
    other_user_id = conversation.user2_id if conversation.user1_id == current_user.id else conversation.user1_id
    other_user = await get_user_by_id(db, other_user_id)
    
    if not other_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Other user not found"
        )
    
    # Get listing info if exists
    listing_title = None
    if conversation.listing_id:
        listing = await get_listing_by_id(db, conversation.listing_id)
        if listing:
            listing_title = listing.title
    
    # Format messages
    message_responses = []
    for msg in messages:
        await db.refresh(msg.sender)
        message_responses.append(MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            sender_name=msg.sender.name,
            content=msg.content,
            is_read=msg.is_read,
            created_at=msg.created_at,
        ))
    
    return ConversationDetailResponse(
        id=conversation.id,
        user1_id=conversation.user1_id,
        user2_id=conversation.user2_id,
        listing_id=conversation.listing_id,
        listing_title=listing_title,
        other_user_id=other_user.id,
        other_user_name=other_user.name,
        other_user_email=other_user.email,
        messages=message_responses,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message_to_conversation(
    conversation_id: int,
    message_data: dict,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to an existing conversation."""
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Verify user is part of conversation
    if conversation.user1_id != current_user.id and conversation.user2_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to send messages in this conversation"
        )
    
    content = message_data.get("content", "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty"
        )
    
    # Send message
    message = await send_message(db, conversation_id, current_user.id, content)

    recipient_id = (
        conversation.user2_id
        if conversation.user1_id == current_user.id
        else conversation.user1_id
    )
    from app.services.notifications import notify_new_message

    await notify_new_message(
        db,
        user_id=recipient_id,
        sender_name=current_user.name or "Neighbour",
        conversation_id=conversation_id,
        preview=content,
    )

    await db.commit()
    await db.refresh(message)
    await db.refresh(message.sender)
    
    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=message.sender.name,
        content=message.content,
        is_read=message.is_read,
        created_at=message.created_at,
    )

