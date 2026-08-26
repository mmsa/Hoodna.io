# Deploy eljiran: Render (API) + Vercel (web) + TestFlight (mobile)

## Live URLs

| Service | URL |
|---------|-----|
| API (Render) | https://eljiran-api.onrender.com |
| Web (Vercel) | https://eljiran.vercel.app |
| API health | https://eljiran-api.onrender.com/health |

## 1) Render — backend API + Postgres

On the Render "Create a new Service" screen:

1. Create **Postgres** first (`eljiran-db`)
2. Create **Web Service** (`eljiran-api`) — "Dynamic web app / mobile backends"

### Option A — Blueprint (recommended)

1. Push this repo to GitHub
2. Render → New → Blueprint → select the repo (`render.yaml` at root)
3. Fill in the prompted env vars (see below)

### Option B — Manual Web Service

| Field | Value |
|--------|--------|
| Runtime | Python 3 / Docker |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` (Python) or Docker build |
| Start Command | `chmod +x start.sh && ./start.sh` |
| Health Check Path | `/health` |
| Region | Same as Postgres (e.g. Frankfurt) |

Link the Postgres database so Render injects `DATABASE_URL`.

### Required env vars on the Web Service

| Key | Example |
|-----|---------|
| `ENVIRONMENT` | `production` |
| `SECRET_KEY` | long random string |
| `DATABASE_URL` | (from Render Postgres — auto if linked) |
| `BACKEND_URL` | `https://eljiran-api.onrender.com` |
| `FRONTEND_URL` | `https://eljiran.vercel.app` |
| `CORS_ORIGINS` | `["https://eljiran.vercel.app","http://localhost:3000"]` |

Optional but recommended for uploads/email:

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`
- **Password reset email** — one of:
  - `RESEND_API_KEY` (recommended; verify sender in [Resend](https://resend.com))
  - AWS SES: verify `SES_FROM_EMAIL` in the same region as `AWS_REGION`, exit sandbox mode
  - SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`
- `OPENAI_API_KEY`
- Stripe keys if you use promotions

### Phone OTP via SMS.to

Production `/api/auth/start` sends an English SMS OTP through [SMS.to](https://sms.to/) (~€0.185/SMS to Egypt). Without these vars, production returns **503**. Twilio and WhatsApp remain supported as alternate `SMS_PROVIDER` values.

1. Create an [SMS.to](https://sms.to/) account and top up credit  
2. Dashboard → **API Clients** → generate an **API key**  
3. Send a manual test to your Egyptian number to confirm delivery  
4. Set on Render `eljiran-api`:

| Key | Value |
|-----|--------|
| `SMS_PROVIDER` | `smsto` |
| `SMSTO_API_KEY` | from SMS.to API Clients |
| `SMSTO_SENDER_ID` | optional, default `Eljiran` (max 11 chars; may be rewritten in Egypt) |
| `OTP_MAX_PER_PHONE_PER_HOUR` | optional, default `5` |
| `OTP_MAX_PER_IP_PER_HOUR` | optional, default `20` |

5. Redeploy the API. Never put the API key in the mobile app — only on the API.

Local development without SMS.to still returns `otp_code` in the start response when `ENVIRONMENT=development` and no OTP provider is configured.

### Alternate providers

| `SMS_PROVIDER` | Required env vars |
|----------------|-------------------|
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| `whatsapp` | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_TEMPLATE`, `WHATSAPP_OTP_TEMPLATE_LANG` |

If no mail provider is configured, forgot-password still returns success but emails are **not** sent (check Render logs for the reset link).

After creating the bucket and IAM user:

1. Attach the bucket policy / permissions to `eljiran-s3`
2. Create an access key (Security credentials → Create access key → Application running outside AWS)
3. Set on Render `eljiran-api`:

| Key | Value |
|-----|--------|
| `AWS_ACCESS_KEY_ID` | from IAM |
| `AWS_SECRET_ACCESS_KEY` | from IAM |
| `AWS_REGION` | `eu-central-1` |
| `S3_BUCKET_NAME` | `eljiran-uploads` |

4. Redeploy the API. Keep **Block all public access** ON — the API issues short-lived signed download URLs.

5. **S3 CORS** (optional if using API proxy upload). Browser uploads go through `POST /api/uploads/s3` on the API, so CORS on the bucket is not required for uploads. For direct S3 PUT (legacy), configure CORS on `eljiran-uploads`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "https://eljiran.vercel.app",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Without direct PUT, uploads still work via the API proxy after deploy.

After deploy, confirm:

```bash
curl https://eljiran-api.onrender.com/health
# → {"status":"healthy"}
```

If signup fails with `invalid input value for enum userrole: "RESIDENT"`, run in the Render Postgres shell:

```sql
ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'RESIDENT';
ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SERVICE_PROVIDER';
ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'COMPOUND_MOD';
```

(Migration `016` also applies this on deploy.)

### Seed neighbourhoods (compounds)

On first boot, `start.sh` runs `python -m scripts.seed_compounds` and loads
`backend/data/compounds/egypt_compounds_2025.csv` if the compounds table is empty.
After deploy, search for “Palm” on neighbourhood select should return results.

To force a re-seed from CSV, set `FORCE_SEED_COMPOUNDS=1` on the Render service and redeploy.

---

## 2) Vercel — frontend

1. Import the same GitHub repo in Vercel
2. **Root Directory** = `frontend`
3. Framework = Next.js (auto)
4. Env vars:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://eljiran-api.onrender.com` |

5. Deploy

**Note:** Vercel requires commit author emails to match a GitHub account email. Use your GitHub email when committing.

Update Render `FRONTEND_URL` + `CORS_ORIGINS` to the Vercel URL, then redeploy the API.

---

## 3) Mobile / TestFlight — point at Render

Production/preview builds use:

```json
"EXPO_PUBLIC_API_URL": "https://eljiran-api.onrender.com"
```

Rebuild:

```bash
cd mobile
eas build --platform ios --profile production --auto-submit
```

Local Expo Go can use `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://eljiran-api.onrender.com
```

---

## Quick checklist

- [x] Render Postgres created
- [x] Render Web Service healthy at `/health`
- [x] Vercel frontend at https://eljiran.vercel.app
- [ ] CORS includes the Vercel origin on Render
- [ ] Compounds seeded (neighbourhood search returns Palm Hills etc.)
- [ ] Signup works (userrole enum includes RESIDENT)
- [ ] Mobile EAS build pointed at Render URL
- [ ] S3 configured if uploads are needed on device
