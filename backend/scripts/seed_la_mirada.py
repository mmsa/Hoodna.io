"""
Seed script to create a test user and sample listings in La Mirada compound.
This creates dummy data for testing/demo purposes.
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from datetime import datetime, timedelta

# Import all models to ensure relationships are set up
from app.models import compound, user, post, listing, verification  # noqa
from app.models.user import User
from app.models.compound import Compound
from app.models.listing import Listing
from app.models.post import Post
from app.core.security import get_password_hash
from app.models.enums import UserRole, UserStatus, ListingCategory, ListingIntent, ListingStatus
from scripts.utils import get_db_url


async def seed_la_mirada():
    """Seed La Mirada compound with test user and sample listings."""
    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Find La Mirada (New Cairo) compound
        result = await session.execute(
            select(Compound).where(Compound.compound_id == "la-mirada-new-cairo")
        )
        la_mirada = result.scalar_one_or_none()
        
        if not la_mirada:
            # Try alternative name
            result = await session.execute(
                select(Compound).where(Compound.name.ilike("%La Mirada%"))
            )
            la_mirada = result.scalar_one_or_none()
        
        if not la_mirada:
            print("❌ La Mirada compound not found. Please seed compounds first using:")
            print("   python scripts/seed_compounds.py")
            return
        
        print(f"✅ Found compound: {la_mirada.name} (ID: {la_mirada.id})")
        
        # Create test user
        test_email = "test@lamirada.com"
        result = await session.execute(
            select(User).where(User.email == test_email)
        )
        test_user = result.scalar_one_or_none()
        
        if not test_user:
            test_user = User(
                name="Ahmed Mohamed",
                email=test_email,
                password_hash=get_password_hash("test123"),
                phone="+201234567890",
                role=UserRole.USER,
                status=UserStatus.APPROVED,  # Approved so they can create listings
                compound_id=la_mirada.id,
            )
            session.add(test_user)
            await session.flush()
            print(f"✅ Created test user: {test_email} / test123")
        else:
            # Update existing user
            test_user.compound_id = la_mirada.id
            test_user.status = UserStatus.APPROVED
            test_user.password_hash = get_password_hash("test123")
            await session.flush()
            print(f"✅ Updated test user: {test_email} / test123")
        
        await session.refresh(test_user)
        
        # Sample listings data
        sample_listings = [
            {
                "title": "Samsung 55\" Smart TV - Like New",
                "description": "Samsung 55-inch 4K Smart TV, purchased 6 months ago. Perfect condition, comes with remote and all accessories. Moving sale!",
                "category": ListingCategory.ITEM,
                "intent": ListingIntent.SELL,
                "price": 8500,
                "currency": "EGP",
            },
            {
                "title": "IKEA Dining Table Set (6 chairs)",
                "description": "Beautiful IKEA dining table with 6 matching chairs. White color, excellent condition. Perfect for families.",
                "category": ListingCategory.ITEM,
                "intent": ListingIntent.SELL,
                "price": 4500,
                "currency": "EGP",
            },
            {
                "title": "2020 Toyota Corolla - Excellent Condition",
                "description": "2020 Toyota Corolla, 45,000 km. Well maintained, full service history. No accidents. Perfect for daily commute.",
                "category": ListingCategory.CAR,
                "intent": ListingIntent.SELL,
                "price": 450000,
                "currency": "EGP",
            },
            {
                "title": "3-Bedroom Apartment for Rent",
                "description": "Spacious 3-bedroom apartment, 150 sqm, fully furnished. Great location in La Mirada. Available immediately. Perfect for families.",
                "category": ListingCategory.PROPERTY,
                "intent": ListingIntent.RENT,
                "price": 12000,
                "currency": "EGP",
            },
            {
                "title": "Professional Cleaning Service",
                "description": "Experienced cleaning service for apartments and villas. Weekly, bi-weekly, or one-time cleaning available. References available.",
                "category": ListingCategory.SERVICE,
                "intent": ListingIntent.SELL,
                "price": 300,
                "currency": "EGP",
            },
            {
                "title": "MacBook Pro 13\" 2021 - M1 Chip",
                "description": "MacBook Pro 13-inch with M1 chip, 256GB SSD, 8GB RAM. Excellent condition, battery health 95%. Comes with charger.",
                "category": ListingCategory.ITEM,
                "intent": ListingIntent.SELL,
                "price": 25000,
                "currency": "EGP",
            },
            {
                "title": "Sofa Set (3+2+1) - Modern Design",
                "description": "Modern sofa set in excellent condition. Comfortable and stylish. Perfect for living room. Moving sale!",
                "category": ListingCategory.ITEM,
                "intent": ListingIntent.SELL,
                "price": 6000,
                "currency": "EGP",
            },
            {
                "title": "Electrician Services",
                "description": "Licensed electrician available for all electrical work. Installation, repairs, maintenance. Quick response time.",
                "category": ListingCategory.SERVICE,
                "intent": ListingIntent.SELL,
                "price": 200,
                "currency": "EGP",
            },
        ]
        
        # Create sample listings
        created_count = 0
        updated_count = 0
        
        for listing_data in sample_listings:
            # Check if listing already exists (by title and owner)
            result = await session.execute(
                select(Listing).where(
                    Listing.title == listing_data["title"],
                    Listing.owner_id == test_user.id
                )
            )
            existing_listing = result.scalar_one_or_none()
            
            if not existing_listing:
                listing = Listing(
                    compound_id=la_mirada.id,
                    owner_id=test_user.id,
                    status=ListingStatus.ACTIVE,
                    **listing_data
                )
                session.add(listing)
                created_count += 1
            else:
                # Update existing listing
                for key, value in listing_data.items():
                    setattr(existing_listing, key, value)
                existing_listing.status = ListingStatus.ACTIVE
                updated_count += 1
        
        await session.flush()
        
        # Create some sample posts
        sample_posts = [
            {
                "content": "Welcome to La Mirada community! 🎉 Looking forward to connecting with all my neighbors. If anyone needs help with anything, feel free to reach out!"
            },
            {
                "content": "Does anyone know a good plumber in the area? Need someone reliable for a bathroom renovation project."
            },
            {
                "content": "Lost my cat yesterday - orange tabby, very friendly. Last seen near Building 5. Please contact me if you see him! 😿"
            },
            {
                "content": "Community event this weekend! We're organizing a neighborhood gathering at the clubhouse. Everyone is welcome! More details to follow."
            },
        ]
        
        post_count = 0
        for post_data in sample_posts:
            result = await session.execute(
                select(Post).where(
                    Post.content == post_data["content"],
                    Post.author_id == test_user.id
                )
            )
            existing_post = result.scalar_one_or_none()
            
            if not existing_post:
                post = Post(
                    compound_id=la_mirada.id,
                    author_id=test_user.id,
                    **post_data
                )
                session.add(post)
                post_count += 1
        
        await session.commit()
        
        print(f"\n✅ Seeding completed!")
        print(f"   - User: {test_user.name} ({test_email})")
        print(f"   - Compound: {la_mirada.name}")
        print(f"   - Listings created: {created_count}")
        print(f"   - Listings updated: {updated_count}")
        print(f"   - Posts created: {post_count}")
        print(f"\n📝 Login credentials:")
        print(f"   Email: {test_email}")
        print(f"   Password: test123")


if __name__ == "__main__":
    asyncio.run(seed_la_mirada())

