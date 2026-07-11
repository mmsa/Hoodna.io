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
- `OPENAI_API_KEY`
- Stripe keys if you use promotions

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
