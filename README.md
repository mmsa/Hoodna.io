# Hoodna.io - Verified Neighborhood Community & Marketplace

Hoodna.io is a verified neighborhood community and marketplace platform for compounds in Egypt/MENA. It combines community features (posts, comments) with a marketplace where residents can buy, sell, and rent within their compound or promote listings to reach a wider audience.

## Architecture

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query
- **Backend**: Python FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic migrations
- **Database**: PostgreSQL
- **Storage**: AWS S3 (or S3-compatible) using pre-signed URLs
- **Payments**: Stripe (checkout session + webhook)
- **Local Development**: Docker Compose

## Features

### Core Functionality
- User signup and authentication (JWT with refresh tokens)
- Compound selection and assignment
- Document verification (National ID + Residency/Ownership Contract)
- Community feed with posts and comments
- Marketplace listings (Property, Car, Item, Service)
- Listing promotions (Cross-Compound, Public)
- Admin panel for verification review and moderation

### Business Rules
- Users must be verified to post, comment, or create listings
- Verification requires both National ID and Contract documents
- Manual admin review for MVP (architecture ready for automation)
- Free listings within user's compound
- Paid promotions for cross-compound or public visibility
- Role-based access control (USER, ADMIN, MODERATOR)

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Stripe account (for payments)
- AWS S3 bucket (or S3-compatible service like MinIO)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database (defaults work with Docker Compose)
DATABASE_URL=postgresql+asyncpg://hoodna:hoodna123@postgres:5432/hoodna

# JWT - Generate with: openssl rand -hex 32
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS
CORS_ORIGINS=["http://localhost:3000"]

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=hoodna-uploads
S3_ENDPOINT_URL=  # Leave empty for AWS S3, or use endpoint for S3-compatible services

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# App
ENVIRONMENT=development
```

### Running with Docker Compose

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

3. **Default admin credentials:**
   - Email: `admin@hoodna.io`
   - Password: `admin123`

### Running Locally (without Docker)

#### Backend

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up database:**
   - Ensure PostgreSQL is running
   - Update `DATABASE_URL` in `.env` or `backend/.env`
   - Run migrations:
     ```bash
     alembic upgrade head
     ```

5. **Seed database:**
   ```bash
   python scripts/seed.py
   ```

6. **Run backend:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

#### Frontend

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set environment variable:**
   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Run frontend:**
   ```bash
   npm run dev
   ```

## Testing Stripe Webhooks Locally

To test Stripe webhooks during development:

1. **Install Stripe CLI:**
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Or download from https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to local server:**
   ```bash
   stripe listen --forward-to localhost:8000/api/webhooks/stripe
   ```

4. **Copy the webhook signing secret** from the output and add it to your `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. **Trigger test events:**
   ```bash
   stripe trigger checkout.session.completed
   ```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (client-side token removal)
- `GET /api/auth/me` - Get current user info

### Compounds
- `GET /api/compounds` - List all compounds
- `POST /api/compounds/request` - Request new compound

### Verification
- `POST /api/verification/presign` - Get pre-signed URL for upload
- `POST /api/verification/submit` - Submit verification document
- `GET /api/verification/status` - Get verification status

### Community
- `GET /api/feed` - Get community feed
- `POST /api/posts` - Create post
- `POST /api/posts/{post_id}/comments` - Add comment

### Marketplace
- `GET /api/listings` - List listings (scope: compound|cross|public)
- `POST /api/listings` - Create listing
- `GET /api/listings/{id}` - Get listing details
- `PATCH /api/listings/{id}` - Update listing

### Promotions
- `POST /api/promotions/checkout` - Create Stripe checkout session

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

### Admin
- `GET /api/admin/verifications` - List pending verifications
- `POST /api/admin/verifications/{doc_id}/approve` - Approve document
- `POST /api/admin/verifications/{doc_id}/reject` - Reject document
- `POST /api/admin/users/{user_id}/approve` - Approve user
- `POST /api/admin/users/{user_id}/reject` - Reject user
- `POST /api/admin/users/{user_id}/ban` - Ban user
- `POST /api/admin/listings/{id}/archive` - Archive listing
- `POST /api/admin/posts/{id}/remove` - Remove post

## Database Migrations

### Create a new migration:
```bash
cd backend
alembic revision --autogenerate -m "description"
```

### Apply migrations:
```bash
alembic upgrade head
```

### Rollback:
```bash
alembic downgrade -1
```

## Project Structure

```
Hoodna.io/
├── backend/
│   ├── app/
│   │   ├── api/          # API routers
│   │   ├── core/         # Config, security, dependencies
│   │   ├── crud/         # Database operations
│   │   ├── db/           # Database session and base
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/    # S3, Stripe services
│   │   └── main.py       # FastAPI app
│   ├── alembic/          # Database migrations
│   ├── scripts/          # Seed scripts
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities and API client
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Critical Path (End-to-End Flow)

1. **Signup** → User creates account
2. **Select Compound** → User chooses their compound
3. **Upload Documents** → User uploads National ID and Contract
4. **Admin Approval** → Admin reviews and approves documents
5. **User Approved** → User can now post and create listings
6. **Create Listing** → User creates a marketplace listing
7. **Promote Listing** → User pays to promote listing (cross-compound or public)
8. **Stripe Payment** → Payment processed via Stripe
9. **Webhook Activation** → Stripe webhook activates promotion
10. **Listing Visible** → Listing appears in cross-compound or public feed

## V2 Roadmap

### Automated Verification
- **OCR Integration**: Extract text from National ID and contracts
- **KYC Services**: Integrate with third-party KYC providers (e.g., Onfido, Jumio)
- **Document Validation**: Automated checks for document authenticity
- **Face Matching**: Match ID photo with user-uploaded selfie

### In-App Messaging
- **Direct Messages**: Private messaging between users
- **Listing Inquiries**: Structured inquiry system for marketplace items
- **Notifications**: Real-time notifications for messages, comments, mentions
- **Email Notifications**: Digest emails for important updates

### Enhanced Search & Discovery
- **Full-Text Search**: Search posts, listings, and users
- **Advanced Filters**: Filter listings by price, category, location, date
- **Saved Searches**: Save search queries and get alerts
- **Recommendations**: ML-based recommendations for listings and content

### Reporting & Abuse Handling
- **Report System**: Users can report posts, listings, or other users
- **Moderation Queue**: Admin dashboard for reviewing reports
- **Automated Flagging**: ML-based content moderation
- **Appeal Process**: Users can appeal moderation decisions
- **Trust Scores**: User reputation system based on behavior

### ML-Assisted Moderation
- **Content Classification**: Auto-categorize posts and listings
- **Spam Detection**: Identify and filter spam content
- **Sentiment Analysis**: Monitor community sentiment
- **Fraud Detection**: Detect suspicious listings or user behavior
- **Image Moderation**: Automated image content filtering

### Additional Features
- **Mobile Apps**: Native iOS and Android applications
- **Push Notifications**: Mobile push notifications
- **Analytics Dashboard**: User and listing analytics
- **Subscription Plans**: Premium features for users
- **Multi-language Support**: Arabic and English
- **Payment Methods**: Multiple payment gateways (local payment methods)
- **Reviews & Ratings**: User and listing reviews
- **Events**: Community events and calendar
- **Groups**: Sub-communities within compounds

## License

This project is proprietary software. All rights reserved.

## Support

For issues or questions, please contact the development team.

