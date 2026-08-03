"""
Shared helpers for seeding and removing toggleable compound demo data.

Demo users use emails like: sara@palm-hills-katameya.demo.hoodna.io
This makes cleanup safe and compound-scoped.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.crud.user_compound_membership import ensure_user_compound_membership
from app.models.compound import Compound
from app.models.enums import (
    ListingCategory,
    ListingIntent,
    ListingStatus,
    PostCategory,
    UserRole,
    UserStatus,
)
from app.models.listing import Listing
from app.models.post import Comment, Post, PostReaction
from app.models.user import User
from app.models.user_compound_membership import UserCompoundMembership

DEMO_EMAIL_DOMAIN = "demo.hoodna.io"
DEFAULT_COMPOUND_SLUG = "palm-hills-katameya"
DEFAULT_DEMO_PASSWORD = "demo123"


@dataclass(frozen=True)
class DemoUserSpec:
    local_part: str
    name: str
    phone: str


@dataclass(frozen=True)
class DemoPostSpec:
    author_local_part: str
    content: str
    category: PostCategory
    is_urgent: bool = False


@dataclass(frozen=True)
class DemoCommentSpec:
    post_content_prefix: str
    author_local_part: str
    content: str


@dataclass(frozen=True)
class DemoListingSpec:
    owner_local_part: str
    title: str
    description: str
    category: ListingCategory
    intent: ListingIntent
    price: float


def demo_email(compound_slug: str, local_part: str) -> str:
    return f"{local_part}@{compound_slug}.{DEMO_EMAIL_DOMAIN}"


def is_demo_email(email: str) -> bool:
    return email.endswith(f".{DEMO_EMAIL_DOMAIN}")


def demo_email_pattern(compound_slug: str | None = None) -> str:
    if compound_slug:
        return f"%@{compound_slug}.{DEMO_EMAIL_DOMAIN}"
    return f"%.{DEMO_EMAIL_DOMAIN}"


def get_demo_users() -> list[DemoUserSpec]:
    return [
        DemoUserSpec("sara", "Sara Hassan", "+201012345678"),
        DemoUserSpec("ahmed", "Ahmed Mohamed", "+201023456789"),
        DemoUserSpec("nour", "Nour El-Din", "+201034567890"),
        DemoUserSpec("yasmine", "Yasmine Farouk", "+201045678901"),
        DemoUserSpec("omar", "Omar Khaled", "+201056789012"),
    ]


def get_demo_posts(compound_name: str) -> list[DemoPostSpec]:
    return [
        DemoPostSpec(
            "sara",
            f"Welcome to {compound_name}! Looking forward to connecting with neighbours. "
            "If anyone is new here, feel free to say hello.",
            PostCategory.GENERAL,
        ),
        DemoPostSpec(
            "ahmed",
            "Does anyone know a reliable plumber in the compound? Need help with a kitchen leak.",
            PostCategory.HELP,
        ),
        DemoPostSpec(
            "yasmine",
            "Lost our cat yesterday — orange tabby, very friendly. Last seen near the main gate. "
            "Please message if you see him.",
            PostCategory.LOST_FOUND,
        ),
        DemoPostSpec(
            "nour",
            "Community gathering this Friday at 6 PM by the clubhouse. Families welcome — "
            "bring a dish if you can!",
            PostCategory.EVENT,
        ),
        DemoPostSpec(
            "omar",
            "Reminder: pool maintenance scheduled for Tuesday 9 AM–2 PM. Pool will be closed.",
            PostCategory.ANNOUNCEMENT,
        ),
        DemoPostSpec(
            "sara",
            "Water pressure will be low tomorrow morning due to maintenance. "
            "Please store water if needed.",
            PostCategory.ALERT,
            is_urgent=True,
        ),
        DemoPostSpec(
            "ahmed",
            "Best places for Friday brunch nearby? Looking for recommendations within 15 minutes.",
            PostCategory.DISCUSSION,
        ),
        DemoPostSpec(
            "yasmine",
            "Selling a barely-used baby stroller — great condition. DM if interested.",
            PostCategory.MARKETPLACE,
        ),
    ]


def get_demo_comments() -> list[DemoCommentSpec]:
    return [
        DemoCommentSpec(
            "Does anyone know a reliable plumber",
            "omar",
            "Try Hassan — he did our bathroom last month. Very professional.",
        ),
        DemoCommentSpec(
            "Community gathering this Friday",
            "sara",
            "Count us in! Should we bring chairs or will there be seating?",
        ),
        DemoCommentSpec(
            "Lost our cat yesterday",
            "nour",
            "I'll keep an eye out during my evening walk.",
        ),
        DemoCommentSpec(
            "Best places for Friday brunch nearby",
            "yasmine",
            "Paul Bakery at Katameya Dunes is always a good option.",
        ),
    ]


def get_demo_listings(compound_name: str) -> list[DemoListingSpec]:
    return [
        DemoListingSpec(
            "sara",
            'Samsung 55" Smart TV — Like New',
            "Samsung 55-inch 4K Smart TV, purchased 6 months ago. Perfect condition with remote.",
            ListingCategory.ITEM,
            ListingIntent.SELL,
            8500,
        ),
        DemoListingSpec(
            "ahmed",
            "IKEA Dining Table Set (6 chairs)",
            "White IKEA dining table with 6 matching chairs. Excellent condition.",
            ListingCategory.ITEM,
            ListingIntent.SELL,
            4500,
        ),
        DemoListingSpec(
            "omar",
            "2020 Toyota Corolla — Excellent Condition",
            "45,000 km, full service history, no accidents. Perfect daily driver.",
            ListingCategory.CAR,
            ListingIntent.SELL,
            450000,
        ),
        DemoListingSpec(
            "nour",
            f"3-Bedroom Apartment for Rent in {compound_name}",
            "Spacious 3-bedroom, 150 sqm, fully furnished. Available immediately.",
            ListingCategory.PROPERTY,
            ListingIntent.RENT,
            12000,
        ),
        DemoListingSpec(
            "yasmine",
            "Professional Home Cleaning Service",
            "Weekly or one-time cleaning for apartments and villas. References available.",
            ListingCategory.SERVICE,
            ListingIntent.SELL,
            300,
        ),
        DemoListingSpec(
            "sara",
            'MacBook Pro 13" 2021 — M1 Chip',
            "256GB SSD, 8GB RAM, battery health 95%. Comes with charger.",
            ListingCategory.ITEM,
            ListingIntent.SELL,
            25000,
        ),
        DemoListingSpec(
            "ahmed",
            "Sofa Set (3+2+1) — Modern Design",
            "Modern sofa set in excellent condition. Moving sale.",
            ListingCategory.ITEM,
            ListingIntent.SELL,
            6000,
        ),
        DemoListingSpec(
            "omar",
            "Licensed Electrician — Compound Resident",
            "Installation, repairs, and maintenance. Quick response time.",
            ListingCategory.SERVICE,
            ListingIntent.SELL,
            200,
        ),
        DemoListingSpec(
            "nour",
            "Villa for Sale — 4 Bedrooms",
            f"Standalone villa in {compound_name}, garden and private parking.",
            ListingCategory.PROPERTY,
            ListingIntent.SELL,
            8500000,
        ),
    ]


async def get_compound_demo_status(
    session: AsyncSession,
    compound: Compound,
) -> dict:
    slug = compound.compound_id
    if not slug:
        return {
            "active": False,
            "demo_user_count": 0,
            "can_seed": False,
            "reason": "Compound needs a slug before demo data can be seeded.",
            "demo_password": DEFAULT_DEMO_PASSWORD,
        }

    pattern = demo_email_pattern(slug)
    result = await session.execute(
        select(func.count()).select_from(User).where(User.email.like(pattern))
    )
    count = int(result.scalar_one() or 0)
    return {
        "active": count > 0,
        "demo_user_count": count,
        "can_seed": True,
        "reason": None,
        "demo_password": DEFAULT_DEMO_PASSWORD,
    }


async def seed_compound_demo_for_compound(
    session: AsyncSession,
    compound: Compound,
    *,
    password: str = DEFAULT_DEMO_PASSWORD,
) -> dict:
    if not compound.compound_id:
        raise ValueError("Compound needs a slug before demo data can be seeded.")
    return await seed_compound_demo(
        session,
        compound_slug=compound.compound_id,
        password=password,
    )


async def cleanup_compound_demo_for_compound(
    session: AsyncSession,
    compound: Compound,
) -> dict:
    if not compound.compound_id:
        return {"removed_users": 0, "emails": []}
    return await cleanup_compound_demo(session, compound_slug=compound.compound_id)


async def resolve_compound(session: AsyncSession, compound_slug: str) -> Compound | None:
    result = await session.execute(
        select(Compound).where(Compound.compound_id == compound_slug)
    )
    compound = result.scalar_one_or_none()
    if compound:
        return compound

    slug_as_name = re.sub(r"[-_]+", " ", compound_slug).strip()
    result = await session.execute(
        select(Compound).where(Compound.name.ilike(f"%{slug_as_name}%"))
    )
    return result.scalar_one_or_none()


async def seed_compound_demo(
    session: AsyncSession,
    *,
    compound_slug: str = DEFAULT_COMPOUND_SLUG,
    password: str = DEFAULT_DEMO_PASSWORD,
) -> dict:
    compound = await resolve_compound(session, compound_slug)
    if not compound:
        raise ValueError(
            f"Compound '{compound_slug}' not found. Run seed_compounds.py first."
        )

    users_by_local: dict[str, User] = {}
    created_users = 0
    updated_users = 0

    for spec in get_demo_users():
        email = demo_email(compound_slug, spec.local_part)
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                name=spec.name,
                email=email,
                password_hash=get_password_hash(password),
                phone=spec.phone,
                role=UserRole.USER,
                status=UserStatus.APPROVED,
                compound_id=compound.id,
            )
            session.add(user)
            await session.flush()
            created_users += 1
        else:
            user.name = spec.name
            user.phone = spec.phone
            user.compound_id = compound.id
            user.status = UserStatus.APPROVED
            user.password_hash = get_password_hash(password)
            await session.flush()
            updated_users += 1

        await ensure_user_compound_membership(
            session, user.id, compound.id, source="DEMO"
        )
        users_by_local[spec.local_part] = user

    created_listings = 0
    updated_listings = 0
    for spec in get_demo_listings(compound.name):
        owner = users_by_local[spec.owner_local_part]
        result = await session.execute(
            select(Listing).where(
                Listing.title == spec.title,
                Listing.owner_id == owner.id,
            )
        )
        listing = result.scalar_one_or_none()
        if not listing:
            session.add(
                Listing(
                    compound_id=compound.id,
                    owner_id=owner.id,
                    status=ListingStatus.ACTIVE,
                    title=spec.title,
                    description=spec.description,
                    category=spec.category,
                    intent=spec.intent,
                    price=spec.price,
                    currency="EGP",
                )
            )
            created_listings += 1
        else:
            listing.description = spec.description
            listing.category = spec.category
            listing.intent = spec.intent
            listing.price = spec.price
            listing.status = ListingStatus.ACTIVE
            updated_listings += 1

    await session.flush()

    posts_by_content: dict[str, Post] = {}
    created_posts = 0
    for spec in get_demo_posts(compound.name):
        author = users_by_local[spec.author_local_part]
        result = await session.execute(
            select(Post).where(
                Post.content == spec.content,
                Post.author_id == author.id,
            )
        )
        post = result.scalar_one_or_none()
        if not post:
            post = Post(
                compound_id=compound.id,
                author_id=author.id,
                content=spec.content,
                category=spec.category,
                is_urgent=spec.is_urgent,
            )
            session.add(post)
            await session.flush()
            created_posts += 1
        else:
            post.category = spec.category
            post.is_urgent = spec.is_urgent
        posts_by_content[spec.content[:40]] = post

    created_comments = 0
    for spec in get_demo_comments():
        post = next(
            (
                p
                for content, p in posts_by_content.items()
                if content.startswith(spec.post_content_prefix[:20])
            ),
            None,
        )
        if not post:
            result = await session.execute(
                select(Post).where(Post.content.ilike(f"{spec.post_content_prefix}%"))
            )
            post = result.scalar_one_or_none()
        if not post:
            continue

        author = users_by_local[spec.author_local_part]
        result = await session.execute(
            select(Comment).where(
                Comment.post_id == post.id,
                Comment.author_id == author.id,
                Comment.content == spec.content,
            )
        )
        if not result.scalar_one_or_none():
            session.add(
                Comment(
                    post_id=post.id,
                    author_id=author.id,
                    content=spec.content,
                )
            )
            created_comments += 1

    created_reactions = 0
    reaction_targets = list(posts_by_content.values())[:4]
    for idx, post in enumerate(reaction_targets):
        reactor = list(users_by_local.values())[(idx + 1) % len(users_by_local)]
        result = await session.execute(
            select(PostReaction).where(
                PostReaction.post_id == post.id,
                PostReaction.user_id == reactor.id,
            )
        )
        if not result.scalar_one_or_none():
            session.add(
                PostReaction(
                    post_id=post.id,
                    user_id=reactor.id,
                    reaction="👍",
                )
            )
            created_reactions += 1

    await session.commit()

    credentials = [
        {
            "name": spec.name,
            "email": demo_email(compound_slug, spec.local_part),
            "password": password,
        }
        for spec in get_demo_users()
    ]

    return {
        "compound": compound,
        "compound_slug": compound_slug,
        "created_users": created_users,
        "updated_users": updated_users,
        "created_listings": created_listings,
        "updated_listings": updated_listings,
        "created_posts": created_posts,
        "created_comments": created_comments,
        "created_reactions": created_reactions,
        "credentials": credentials,
    }


async def cleanup_compound_demo(
    session: AsyncSession,
    *,
    compound_slug: str | None = None,
) -> dict:
    pattern = demo_email_pattern(compound_slug)
    result = await session.execute(select(User.id, User.email).where(User.email.like(pattern)))
    demo_users = result.all()
    demo_user_ids = [row[0] for row in demo_users]

    if not demo_user_ids:
        await session.commit()
        return {"removed_users": 0, "emails": []}

    await session.execute(
        delete(PostReaction).where(PostReaction.user_id.in_(demo_user_ids))
    )
    await session.execute(
        delete(Comment).where(Comment.author_id.in_(demo_user_ids))
    )
    await session.execute(
        delete(UserCompoundMembership).where(
            UserCompoundMembership.user_id.in_(demo_user_ids)
        )
    )
    await session.execute(delete(User).where(User.id.in_(demo_user_ids)))
    await session.commit()

    return {
        "removed_users": len(demo_user_ids),
        "emails": [row[1] for row in demo_users],
    }
