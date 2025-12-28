from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from app.models.message import Conversation, Message
from app.models.user import User
from app.models.listing import Listing
from typing import List, Optional, Tuple


async def get_or_create_conversation(
    db: AsyncSession,
    user1_id: int,
    user2_id: int,
    listing_id: Optional[int] = None
) -> Conversation:
    """Get existing conversation or create a new one."""
    # Ensure consistent ordering (smaller ID first)
    if user1_id > user2_id:
        user1_id, user2_id = user2_id, user1_id
    
    # Try to find existing conversation
    if listing_id:
        result = await db.execute(
            select(Conversation).where(
                and_(
                    Conversation.user1_id == user1_id,
                    Conversation.user2_id == user2_id,
                    Conversation.listing_id == listing_id
                )
            )
        )
    else:
        result = await db.execute(
            select(Conversation).where(
                and_(
                    Conversation.user1_id == user1_id,
                    Conversation.user2_id == user2_id,
                    Conversation.listing_id.is_(None)
                )
            )
        )
    
    conversation = result.scalar_one_or_none()
    
    if conversation:
        return conversation
    
    # Create new conversation
    conversation = Conversation(
        user1_id=user1_id,
        user2_id=user2_id,
        listing_id=listing_id
    )
    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)
    return conversation


async def send_message(
    db: AsyncSession,
    conversation_id: int,
    sender_id: int,
    content: str
) -> Message:
    """Send a message in a conversation."""
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=content,
        is_read=False
    )
    db.add(message)
    
    # Update conversation updated_at
    conversation = await db.get(Conversation, conversation_id)
    if conversation:
        from sqlalchemy.sql import func
        conversation.updated_at = func.now()
    
    await db.flush()
    await db.refresh(message)
    return message


async def get_conversation_messages(
    db: AsyncSession,
    conversation_id: int,
    user_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[Message]:
    """Get messages for a conversation. Marks messages as read for the requesting user."""
    # Verify user is part of conversation
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        return []
    
    if conversation.user1_id != user_id and conversation.user2_id != user_id:
        return []
    
    # Get messages
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    messages = list(result.scalars().all())
    
    # Mark messages as read (except those sent by the user)
    for message in messages:
        if message.sender_id != user_id and not message.is_read:
            message.is_read = True
    
    await db.flush()
    return messages


async def get_user_conversations(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 50
) -> List[Tuple[Conversation, Optional[Message], int]]:
    """Get all conversations for a user with last message and unread count."""
    # Get conversations where user is user1 or user2
    result = await db.execute(
        select(Conversation)
        .where(
            or_(
                Conversation.user1_id == user_id,
                Conversation.user2_id == user_id
            )
        )
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    conversations = list(result.scalars().all())
    
    # For each conversation, get last message and unread count
    result_list = []
    for conv in conversations:
        # Get last message
        last_msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_message = last_msg_result.scalar_one_or_none()
        
        # Count unread messages (messages not sent by user)
        unread_result = await db.execute(
            select(func.count(Message.id))
            .where(
                and_(
                    Message.conversation_id == conv.id,
                    Message.sender_id != user_id,
                    Message.is_read == False
                )
            )
        )
        unread_count = unread_result.scalar_one() or 0
        
        result_list.append((conv, last_message, unread_count))
    
    return result_list


async def mark_conversation_as_read(
    db: AsyncSession,
    conversation_id: int,
    user_id: int
) -> None:
    """Mark all messages in a conversation as read for a user."""
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        return
    
    if conversation.user1_id != user_id and conversation.user2_id != user_id:
        return
    
    # Mark all messages as read (except those sent by the user)
    await db.execute(
        Message.__table__.update()
        .where(
            and_(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id
            )
        )
        .values(is_read=True)
    )
    await db.flush()

