# Eljiran release readiness

This handoff describes the implementation at migration head `028`. Keep launch flags disabled until every production-only item in the checklist is complete.

## Operator checklist

### Before deployment

- [ ] Back up the production PostgreSQL database and record the restore point.
- [ ] Confirm the deploy runs `alembic upgrade head` and that the database is at revision `020` or earlier before applying `021` through `028` in order.
- [ ] Review report status/reason normalization performed by `021`.
- [ ] Set production URLs, CORS, storage, email, payment, and authentication secrets.
- [ ] Set a strong `CRON_SECRET`; the API and weekly cron must receive the same value.
- [ ] Decide and document telemetry retention and deletion schedules; no automatic purge exists.
- [ ] Decide whether analytics/error forwarding is permitted and set forwarding URLs only after vendor privacy review.
- [ ] Publish and validate the iOS and Android association files on `https://eljiran.com`.
- [ ] Verify the iOS Team ID and Android release certificate SHA-256 fingerprints used in those files.
- [ ] Keep all six database feature rows disabled; create rows if the operations UI says none are seeded.

### Deploy and verify

- [ ] Deploy the API first and wait for `/health` to return `200`.
- [ ] Verify `alembic current` reports `028` and only one Alembic head exists.
- [ ] Verify public and authenticated feature config endpoints fail closed as intended.
- [ ] Deploy web, then production mobile builds that contain the associated-domain entitlements.
- [ ] Exercise registration, referral, business claim, report moderation, preferences, account deletion request, telemetry, and admin authorization.
- [ ] Call the weekly digest endpoint with `?dry_run=true` and the cron secret; confirm no run, delivery, or notification rows are created.
- [ ] Trigger the real digest once in a non-production cohort; call it again for the same period and confirm `duplicate: true`.
- [ ] Confirm the Render cron targets the deployed API hostname and runs Monday at 07:00 UTC.
- [ ] Confirm CI is green for the exact release commit.

### Staged rollout

- [ ] Enable one internal `USER` override and verify server-side enforcement plus UI visibility.
- [ ] Expand to a test `COMPOUND`, then a `CITY`; observe errors, reports, activation, and digest statistics.
- [ ] Remove emergency overrides or disable the database global immediately if thresholds regress.
- [ ] Raise `config.rollout_percentage` gradually only after each observation window.
- [ ] Enable the database global last; database rows override environment defaults.
- [ ] Record flag changes and cohort decisions in the release log.

### After launch

- [ ] Triage pending business claims, reports, client errors, digest failures, and deletion requests daily.
- [ ] Execute the approved telemetry and audit retention jobs outside the application.
- [ ] Verify weekly digest idempotency and failure counts after each Monday run.
- [ ] Revalidate universal/app links after domain, certificate, bundle, package, or signing changes.

## Architecture and implemented scope

- FastAPI is the system of record for authentication, community content, independent businesses and claims, referrals, moderation, feature evaluation, telemetry, metrics, preferences, deletion requests, and weekly digests.
- PostgreSQL schema changes are managed by Alembic. Soft deletion hides posts, listings, and comments without erasing rows. Audit logs are append-only at the database level.
- Web is a Next.js application. Mobile is an Expo Router application. Both use shared TypeScript contracts and the same API.
- Feature decisions use environment defaults only when a key has no database row. A database global can be refined by `CITY`, `COMPOUND`, and `USER` overrides; the most specific matching override wins.
- Analytics and client errors are stored first party. Optional forwarding is best effort and never replaces local persistence.
- Weekly digests are in-app notifications for approved users with a compound, an enabled flag, enabled preferences, and non-empty weekly content.

Implemented launch features include referrals and invite sharing, notification preferences, account deletion requests, business directory/search/claims and admin review, unified reports and moderation actions, immutable audit events, staged feature controls, privacy-safe telemetry and client-error triage, beta metrics, and retry-safe weekly digests.

## Database migrations and deployment order

Apply the linear chain once, in this exact order:

1. `021_stabilize_reports_and_soft_deletes.py` (`020 -> 021`): creates/stabilizes reports and indexes; normalizes legacy statuses, target types, and reasons; prevents duplicate active reports; adds `deleted_at` to posts and listings.
2. `022_referrals_preferences.py` (`021 -> 022`): adds referral invites, per-user notification/digest preferences, and account deletion requests.
3. `023_businesses_claims.py` (`022 -> 023`): adds independent businesses, claims, memberships, indexes, and one-pending-claim protection.
4. `024_moderation_audit.py` (`023 -> 024`): adds moderation actions and append-only audit logs with database triggers rejecting update/delete.
5. `025_feature_flags.py` (`024 -> 025`): adds global feature rows and constrained `USER`, `COMPOUND`, and `CITY` overrides.
6. `026_telemetry_errors.py` (`025 -> 026`): adds analytics events and client error reports.
7. `027_digest_runs.py` (`026 -> 027`): extends PostgreSQL notification types and adds unique digest runs/deliveries.
8. `028_comment_soft_delete.py` (`027 -> 028`): adds indexed `comments.deleted_at`.

The Render API startup script runs migrations before starting the API. Do not deploy web/mobile flows before the API reaches `028`. Migration `021` mutates legacy report values; inspect counts before and after. Migration `024` makes audit log mutation fail by design. Migration `027` changes a native PostgreSQL enum and should not be wrapped in an ad-hoc transaction by deployment tooling.

## New API routes

All routes below are mounted in `backend/app/main.py`.

### Preferences, deletion, and referrals

- `GET /api/auth/me/preferences`
- `PATCH /api/auth/me/preferences`
- `POST /api/auth/me/deletion-request` (`202`; idempotent while pending)
- `GET /api/referrals/me`
- `POST /api/referrals/invites`
- `GET /api/referrals/invites`
- `POST /api/referrals/redeem`
- `GET /api/referrals/stats`

There is no backend `GET /api/auth/me/deletion-request` route. The mobile status lookup currently receives `405`; request submission still works.

### Businesses and claims

- `GET /api/businesses` (`q` or `search`, `city`, `area`, `category`, `compound_id`, `verification_status`, `skip`, `limit`)
- `GET /api/businesses/search` (`q`, optional `compound_id`, `limit`)
- `GET /api/businesses/claims/current` (optional `business_slug`)
- `POST /api/businesses/{identifier}/claims` (`identifier` accepts numeric ID or slug)
- `GET /api/business-claims/me`
- `GET /api/businesses/{slug}`
- `GET /api/admin/businesses` (`search`, `status`, `skip`, `limit`)
- `POST /api/admin/businesses`
- `PATCH /api/admin/businesses/{business_id}`
- `GET /api/admin/businesses/claims` (`status`, `skip`, `limit`; returns `{items,total,skip,limit}`)
- `POST /api/admin/businesses/claims/{claim_id}/approve`
- `POST /api/admin/businesses/claims/{claim_id}/reject`

Claim review bodies accept `review_notes` and `membership_role`.

### Reports, moderation, and audit

- `POST /api/reports` with `reported_type`, `reported_id`, `reason`, and optional `description`
- Compatibility routes: `POST /api/reports/post/{post_id}` and `POST /api/reports/listing/{listing_id}`
- `GET /api/reports` with `status_filter`, `reported_type`, `reported_id`, `reason`, `reporter_id`, `skip`, and `limit`
- `PATCH /api/reports/{report_id}` with `status` and `review_notes`
- `POST /api/moderator/reports/{report_id}/actions` with `action`, `reason`, and optional `notes`
- `GET /api/admin/audit-logs` with `actor_id`, `event_type`, `entity_type`, `entity_id`, `skip`, and `limit`

Moderation actions can hide/restore supported posts, comments, listings, and independent businesses, or suspend a user target. Reviewer access remains compound-scoped except for full admins.

### Feature configuration

- `GET /api/config/public` with optional `city`, `neighbourhood`, and opaque `anonymous_id`
- `GET /api/config/me`
- `GET /api/admin/feature-flags`
- `POST /api/admin/feature-flags`
- `PUT /api/admin/feature-flags/{key}`
- `DELETE /api/admin/feature-flags/{key}`
- `GET /api/admin/feature-flags/{key}/overrides`
- `POST /api/admin/feature-flags/{key}/overrides`
- `DELETE /api/admin/feature-flags/{key}/overrides/{override_id}`

Admin feature and metrics routes require the full `ADMIN` role.

### Telemetry and metrics

- `POST /api/telemetry/events` (`202`, batches of 1-100, maximum declared payload 128 KiB)
- `POST /api/telemetry/errors` (`202`, maximum declared payload 8 KiB)
- `GET /api/admin/telemetry/errors` (`limit` 1-200)
- `PATCH /api/admin/telemetry/errors/{report_id}` (`OPEN`, `RESOLVED`, or `IGNORED`)
- `GET /api/admin/beta-metrics` (`date_from`, `date_to`; maximum 366-day range)

### Weekly digest

- `POST /api/internal/jobs/weekly-digest` with `X-Cron-Secret` or `Authorization: Bearer`; optional `dry_run=true`
- `GET /api/digests/me/latest`

## Web and mobile surfaces

Web:

- `/businesses` directory and filters; `/businesses/[slug]` profile, report, and claim entry.
- `/settings` mounts invite sharing/stats, notification preferences, and deletion request controls.
- `/digest` shows the latest in-app weekly digest.
- Admin dashboard **Operations** tab provides business claim review, moderation queue, global/scoped feature controls, beta metrics, and immutable audit log.
- Global feature config and telemetry/error boundaries are installed in application providers.

Mobile:

- `/businesses`, `/businesses/[slug]`, `/businesses/[slug]/claim`, and `/business-claims`.
- `/invite-neighbours`, `/settings`, `/digest`, and notification deep links.
- Admin dashboard **Eljiran Ops** provides claim review, moderation, global flags, and a beta snapshot; scoped overrides, trends, and audit inspection remain web-only.
- Root providers install feature config and telemetry; app/API errors are forwarded to first-party ingestion.

## Analytics contract and privacy

Every event may include only `platform`, `app_version`, and `source_screen`, plus the event-specific properties below:

- `app_opened`: no additional properties.
- `registration_started`: `method`, `referral_present`.
- `registration_completed`: `method`, `role`.
- `onboarding_step_viewed`: `step`, `step_number`.
- `onboarding_completed`: `steps_completed`.
- `community_selected`: `community_id`.
- `search_performed`: `category`, `result_count`.
- `search_result_opened`: `entity_type`, `entity_id`, `position`.
- `post_created`: `post_id`, `category`, `community_id`.
- `comment_created`: `comment_id`, `post_id`.
- `business_profile_viewed`: `business_id`, `category`.
- `business_claim_submitted`: `business_id`.
- `invite_shared`: `channel`.
- `referral_registration_completed`: `inviter_id`.
- `notification_opened`: `notification_id`, `notification_type`.
- `report_submitted`: `entity_type`, `reason`.

Allowed values are booleans, finite numbers, null, or short machine-readable strings matching letters, digits, `_ . : / -`. `anonymous_id` and `session_id` must be opaque machine identifiers. Event properties must never contain names, email addresses, phone numbers, postal addresses, search text/query strings, free-form descriptions, messages, post/comment content, contact details, passwords, tokens, authorization values, secrets, API keys, or raw stack traces. Query strings and fragments are stripped from error routes; server-side scrubbing is defense in depth, not permission to send PII.

First-party rows retain authenticated user IDs where available. Error forwarding uses a keyed anonymous hash, defaulting to `SECRET_KEY` if `TELEMETRY_ANONYMIZATION_SECRET` is empty.

## Feature flags and rollout behavior

Keys:

- `invitations`
- `business_claiming`
- `weekly_digest`
- `community_posting`
- `business_reviews`
- `user_registration`

Render sets all six environment defaults to `false`. Code defaults outside Render are `true` except `weekly_digest=false`; therefore production must use the Blueprint values or equivalent explicit environment values. Web/mobile outage fallbacks disable the first five but currently leave `user_registration=true`.

Evaluation order is environment default, database global, then matching `CITY`, `COMPOUND`, and `USER` overrides; later/more-specific matches win. Geography allowlists and deterministic `config.rollout_percentage` are applied after overrides. Decisions are cached for `FEATURE_FLAG_CACHE_TTL_SECONDS` (15 seconds by default).

For rollout: seed disabled globals, enable one user, then one compound, then one city; optionally set `config: {"rollout_percentage": 5}` and increase gradually; inspect beta metrics, reports, errors, audit events, and digest failures; enable the global last. To stop a rollout, disable the database global and relevant overrides, wait one cache TTL, and verify `/api/config/me`.

## Environment and operational controls

Required launch controls:

- `CRON_SECRET`: no safe code default; must be non-empty, strong, and identical in API/cron.
- `FEATURE_*_ENABLED`: six booleans listed above; Render default `false`.
- `FEATURE_FLAG_CACHE_TTL_SECONDS`: default `15`.
- `FEATURE_ENABLED_CITIES`, `FEATURE_ENABLED_NEIGHBOURHOODS`: comma-separated allowlists; empty means unrestricted.
- `ANALYTICS_FORWARD_URL`, `CLIENT_ERROR_FORWARD_URL`: empty disables best-effort forwarding.
- `TELEMETRY_FORWARD_TIMEOUT_SECONDS`: default `2.0`.
- `TELEMETRY_ANONYMIZATION_SECRET`: empty falls back to `SECRET_KEY`; set a dedicated stable secret in production.
- `NEXT_PUBLIC_RELEASE`: optional web release identifier attached to client errors.
- `WEEKLY_DIGEST_MAX_POSTS=5`, `WEEKLY_DIGEST_MAX_BUSINESSES=5`, `WEEKLY_DIGEST_MAX_ANNOUNCEMENTS=3`, `WEEKLY_DIGEST_MAX_RECOMMENDATIONS=5`.

Sampling, retention, and dry-run are not environment variables in the current implementation:

- Web/mobile analytics instantiate a batch size of `1` and perform no sampling; accepted events are effectively 100% sampled.
- No retention TTL or purge task exists for analytics, client errors, audit logs, digest summaries, or deletion requests. Define a policy and schedule database cleanup/anonymization where legally allowed; audit-log deletion is blocked by design.
- Digest dry-run is only the request query `?dry_run=true`. The Render schedule omits it and performs a real run.

Also set the production `DATABASE_URL`, `SECRET_KEY`, `BACKEND_URL`, `FRONTEND_URL`, `CORS_ORIGINS`, storage credentials/bucket, verified email sender, and any enabled payment or verification-provider secrets.

## Render weekly cron and idempotency

`render.yaml` defines `eljiran-weekly-digest`, schedule `0 7 * * 1` (Monday 07:00 UTC), and posts to:

`https://eljiran-api.onrender.com/api/internal/jobs/weekly-digest`

The shared `eljiran-ops-secrets` group supplies `CRON_SECRET` to both services. Update the hard-coded hostname if the API service/domain changes.

Each real run uses a unique completed Monday-to-Monday UTC period key. A running or successfully completed run returns `duplicate: true`; each `(run,user,channel)` delivery is unique. Failed completed runs may be retried and already-sent deliveries are skipped. Dry runs build summaries and counts without creating run, delivery, or notification records.

## Universal links and app links

The mobile binary declares `applinks:eljiran.com`, Android package `com.eljiran.mobile`, HTTPS host `eljiran.com`, and custom scheme `eljiran`.

Production must serve:

- `https://eljiran.com/.well-known/apple-app-site-association` with `application/json`, no redirect, and `appID` equal to the Apple Team ID plus `com.eljiran.mobile`.
- `https://eljiran.com/.well-known/assetlinks.json` with `com.eljiran.mobile` and every production Play/App Signing SHA-256 certificate fingerprint.

These files cannot be finalized from this repository because Apple Team ID and production signing fingerprints are external. Custom-scheme support does not validate HTTPS ownership and is not a substitute. Association changes can be cached by Apple/Android; install a fresh signed build and test real links on physical devices after publishing. The configured host is `eljiran.com`, while some web links currently use `eljiran.vercel.app`; those links will not receive the declared verified-link behavior unless the host/config and association files are aligned.

## Account deletion and retention operations

Submission validates exact confirmation `DELETE`, creates one pending request per user, and does not immediately disable or erase the account. Operators must:

1. Verify requester identity and pending status.
2. Freeze or restrict the account if policy requires.
3. Export legally required records and identify retention exceptions.
4. Delete or anonymize user profile/contact data, sessions, uploads, content attribution, telemetry user IDs, referrals, memberships, and provider data according to policy.
5. Preserve only records required for fraud, financial, safety, or legal obligations; document the lawful basis and expiry.
6. Mark the request completed with reviewer/timestamps using an approved administrative procedure.
7. Notify the requester and record completion evidence without copying deleted PII.

There is currently no admin deletion queue/status API, no automated erasure worker, and no user-facing backend status `GET`. Processing and status updates require a controlled database/admin procedure.

## Tests and CI

Release CI is configured to fail on errors:

- Backend: Python compile, critical flake8 checks, PostgreSQL 15 `alembic upgrade head`, full pytest with coverage.
- Web: clean installs, shared package builds, lint, TypeScript, unit tests, and production Next.js build.
- Mobile/shared: clean installs, shared package builds, TypeScript, public Expo config, and Expo Doctor.

Record the exact local commands and outcomes in `docs/eljiran-rollout-operations.md` for each release. A local SQLite test pass does not replace CI's PostgreSQL migration job.

Handoff validation on 2026-07-13:

- Shared contract and token builds passed.
- Backend compile and critical flake8 checks passed; all 49 pytest tests passed with 50% aggregate coverage under local Python 3.10/SQLite.
- Web lint and TypeScript passed; 7 unit tests passed; the production build completed with non-blocking client-rendering warnings.
- Mobile TypeScript and public Expo config passed; Expo Doctor passed all 18 checks.
- PostgreSQL `alembic upgrade head`, signed-device links, Render cron, and final-commit hosted CI were not run locally and remain required production/CI gates.

## Remaining limitations and manual production actions

- Publish association files with real Apple/Android signing identifiers and align all shared-link hosts.
- Seed disabled database flag rows; migrations create tables but do not seed keys.
- Set production secrets and forwarding policy; Render currently does not declare the telemetry forwarding/anonymization variables.
- Define and automate privacy retention/purge procedures.
- Build an operator-supported account deletion queue, status route, and erasure workflow; until then use a controlled manual runbook.
- Mobile deletion-status lookup is unsupported by the backend and silently hides the `405`.
- Mobile operations lack scoped override management and audit-log/error triage.
- Weekly digest delivers in-app notifications only; email/push channels are schema-ready but not implemented.
- Telemetry has no sampling control and the clients send events one at a time.
- Render cron URL is hard-coded and must be changed if the API hostname changes.
- Confirm production UI smoke tests and CI on the final commit; source inspection alone is not release approval.
