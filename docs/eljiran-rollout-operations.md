# Eljiran rollout operations

Use this runbook with `docs/eljiran-release-readiness.md`. The API routers are mounted in `backend/app/main.py`; the contracts below match the final backend and `render.yaml`.

## Endpoint verification

Authenticate as a full `ADMIN` for admin routes.

- `GET /api/admin/businesses/claims?status=PENDING` returns `{items,total,skip,limit}`.
- `POST /api/admin/businesses/claims/{claim_id}/approve` and `/reject` accept `{review_notes,membership_role}`.
- `GET /api/reports?status_filter=OPEN` returns a list; `PATCH /api/reports/{report_id}` accepts `{status,review_notes}`.
- `POST /api/moderator/reports/{report_id}/actions` applies a content/user action and appends audit context.
- `GET|POST /api/admin/feature-flags`, `PUT|DELETE /api/admin/feature-flags/{key}`, and the nested `/{key}/overrides` routes manage rollout state.
- `GET /api/admin/beta-metrics?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` accepts at most 366 days.
- `GET /api/admin/audit-logs` accepts `event_type`, `entity_type`, `entity_id`, `actor_id`, `skip`, and `limit`.
- `POST /api/internal/jobs/weekly-digest[?dry_run=true]` accepts `X-Cron-Secret` or a Bearer secret.
- `GET /api/digests/me/latest` returns the authenticated user's latest sent digest or null.

## Chat import (WhatsApp / Telegram)

Admin Dashboard → **Chat import** seeds a compound from a group export.

1. Export the compound WhatsApp group (`Export chat` → Without media or With media `.zip`) or Telegram Desktop (`Export chat history` → JSON).
2. Upload in Admin → Chat import for the target compound.
3. **Parse**, review users / parent posts / nested comments / listings (approve/reject or flip kinds), then **Publish approved**.
4. Parsing:
   - Threads short follow-ups under a parent post (Telegram uses `reply_to`; WhatsApp uses time-window heuristics).
   - Classifies listings with **gpt-4o-mini** when `OPENAI_API_KEY` is set (Arabic + English); regex fallback otherwise.
   - Author display uses the WhatsApp/Telegram **contact/profile name** when present. Phone numbers stay private (login only) and are redacted from published text — never shown as the public author name.
5. Publish creates invited phone users with **PENDING** `CHAT_IMPORT` membership, `profile_setup_required=true`, posts + comments + ACTIVE listings.
6. Residents OTP-login with their phone → app redirects to **Profile** to set **name + password** (email not required). Completing profile confirms compound invites and marks them VERIFIED/APPROVED.

Run migration `036` for the `COMMENT` import kind. Ensure `OPENAI_API_KEY` is set in production for better Arabic listing detection.

APIs: `/api/admin/chat-imports*`, `/api/auth/me/complete-profile`, `/api/auth/me/compound-invites*`.

Quick production checks:

```sh
curl -fsS https://eljiran-api.onrender.com/health
curl -fsS -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  "https://eljiran-api.onrender.com/api/internal/jobs/weekly-digest?dry_run=true"
```

Never paste the secret into tickets, chat, screenshots, or shell history retained by shared systems.

## Migration deployment

1. Take a database backup.
2. Deploy the API; `backend/start.sh` runs `alembic upgrade head`.
3. Confirm the single linear chain `021 -> 022 -> 023 -> 024 -> 025 -> 026 -> 027 -> 028`.
4. Check `alembic current` reports `028`.
5. Confirm `/health`, then smoke-test admin authorization and launch routes before web/mobile deployment.

Do not reorder or selectively skip these migrations. `021` normalizes reports, `024` enforces append-only audit rows, `027` extends the PostgreSQL notification enum, and `028` enables comment soft deletion.

## Safe feature rollout

Render explicitly sets these environment defaults to `false`:

- `invitations`
- `business_claiming`
- `weekly_digest`
- `community_posting`
- `business_reviews`
- `user_registration`

Database rows override environment defaults. Seed all six rows disabled, then:

1. Add an enabled `USER` override for an internal account.
2. Expand to one `COMPOUND`.
3. Expand to one `CITY`.
4. Optionally use `config.rollout_percentage` for a deterministic percentage.
5. Inspect beta metrics, client errors, reports, and audit events after each stage.
6. Enable the database global only after the final pilot.

Override precedence is city, compound, then user, with user most specific. Wait at least `FEATURE_FLAG_CACHE_TTL_SECONDS` after changes. Emergency rollback is a disabled database global plus removal/disablement of enabled overrides.

## Render weekly digest

The Blueprint defines `eljiran-weekly-digest` at `0 7 * * 1` (Monday 07:00 UTC). Its exact target is:

`https://eljiran-api.onrender.com/api/internal/jobs/weekly-digest`

The `eljiran-ops-secrets` environment group generates `CRON_SECRET` and supplies it to both `eljiran-api` and the cron. If the service name or hostname changes, update the hard-coded URL in `render.yaml`.

Activation:

1. Confirm the API and cron resolve the same non-empty `CRON_SECRET`.
2. Run `?dry_run=true`; verify counts and that no digest run/delivery/notification rows were created.
3. Enable `weekly_digest` for an internal user override and ensure that user's digest preference is enabled.
4. Invoke the real endpoint once.
5. Invoke it again for the same completed Monday-to-Monday UTC period; expect `duplicate: true`.
6. Inspect `failed`, `failures`, `skipped_disabled`, `skipped_empty`, and `sent`.
7. Leave the Monday schedule enabled only after the pilot succeeds.

Real runs are idempotent by unique period key and unique run/user/channel delivery. Successfully sent users are not sent twice. A completed run with failures can be retried.

## Telemetry operations

- First-party storage is authoritative. Empty `ANALYTICS_FORWARD_URL` and `CLIENT_ERROR_FORWARD_URL` disable external forwarding.
- Set a dedicated stable `TELEMETRY_ANONYMIZATION_SECRET`; otherwise hashes use `SECRET_KEY`.
- Forwarding timeout defaults to `2.0` seconds and failures do not reject accepted first-party events.
- Sampling is fixed at 100%; there is no sampling environment control.
- There is no automatic retention/purge. Apply the approved production retention schedule outside the application.
- Never send PII or free text in analytics properties. Follow the exact allowlist in the release-readiness document.

## Account deletion queue

`POST /api/auth/me/deletion-request` records one pending request and does not erase or disable the account. There is no admin queue, erasure worker, or backend status `GET`.

Daily:

1. Query pending `account_deletion_requests` through the approved restricted procedure.
2. Verify identity and legal retention exceptions.
3. Execute deletion/anonymization across account, uploads, content attribution, telemetry, referrals, and memberships.
4. Record reviewer, review time, completion time, and minimal non-PII evidence.
5. Notify the requester.

Do not mutate append-only audit logs to satisfy deletion; apply the documented legal retention basis and anonymize linked identity where approved.

## Universal/app link production check

Before shipping signed binaries:

- Publish `/.well-known/apple-app-site-association` on `eljiran.com`, without redirects, for the production Team ID and `com.eljiran.mobile`.
- Publish `/.well-known/assetlinks.json` for `com.eljiran.mobile` and every production signing SHA-256 fingerprint.
- Verify content type, status `200`, no redirect, and valid JSON.
- Test `https://eljiran.com/...` on fresh physical-device installs.
- Align links that still use `eljiran.vercel.app`; that host is not declared in the mobile association configuration.

## Release evidence

Record date, commit, operator, and result for:

- `python -m compileall -q app alembic tests`
- `flake8 app tests --select=E9,F63,F7,F82 --show-source`
- PostgreSQL `alembic upgrade head`
- `pytest --cov=app --cov-report=term`
- shared package builds
- web lint, TypeScript, unit tests, and production build
- mobile TypeScript, `expo config --type public`, and `expo-doctor`
- API, web, mobile, association-link, and cron smoke tests

Do not mark the release ready if final-commit CI or any production-only checklist item is unknown.
