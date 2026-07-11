# Deploy eljiran: Render (API) + Vercel (web) + TestFlight (mobile)

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
| Runtime | Python 3 |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `chmod +x start.sh && ./start.sh` |
| Health Check Path | `/health` |

Link the Postgres database so Render injects `DATABASE_URL`.

### Required env vars on the Web Service

| Key | Example |
|-----|---------|
| `ENVIRONMENT` | `production` |
| `SECRET_KEY` | long random string |
| `DATABASE_URL` | (from Render Postgres — auto if linked) |
| `BACKEND_URL` | `https://eljiran-api.onrender.com` (your real Render URL) |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `CORS_ORIGINS` | `https://your-app.vercel.app,http://localhost:3000` |

Optional but recommended for uploads/email:

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`
- `OPENAI_API_KEY`
- Stripe keys if you use promotions

> Render disks are ephemeral. Use S3 for verification/listing images in production.

After deploy, confirm:

```bash
curl https://YOUR-RENDER-URL/health
# → {"status":"healthy"} or similar
```

---

## 2) Vercel — frontend

1. Import the same GitHub repo in Vercel
2. **Root Directory** = `frontend`
3. Framework = Next.js (auto)
4. Env vars:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-RENDER-URL` |

5. Deploy

Update Render `FRONTEND_URL` + `CORS_ORIGINS` to the Vercel URL, then redeploy the API.

---

## 3) Mobile / TestFlight — point at Render

In `mobile/eas.json`, set production/preview:

```json
"EXPO_PUBLIC_API_URL": "https://YOUR-RENDER-URL"
```

Also update `mobile/app.json` → `extra.apiUrl` to the same URL.

Then rebuild:

```bash
cd mobile
eas build --platform ios --profile production --auto-submit
```

Local Expo Go can keep using `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://YOUR-RENDER-URL
```

---

## Quick checklist

- [ ] Render Postgres created
- [ ] Render Web Service healthy at `/health`
- [ ] Vercel frontend loads and can hit the API
- [ ] CORS includes the Vercel origin
- [ ] Mobile EAS `EXPO_PUBLIC_API_URL` = Render URL
- [ ] S3 configured if uploads are needed on device
