# Launch Readiness Audit

Pre-launch audit of the eljiran.io monorepo (`backend/` FastAPI, `frontend/` Next.js 14,
`mobile/` Expo, `packages/` shared tokens + i18n).

Severity: **P0** launch blocker · **P1** serious, fix before launch · **P2** polish/reliability
· **P3** nice to have.

---

## P0 — Launch blockers

### 1. Production boot seeded a platform admin with hardcoded credentials
- **Area:** Backend / deployment · **Platform:** all
- **Problem:** `start.sh` runs `python -m scripts.seed` on every deploy.
  `scripts/seed.py` defaulted to a committed email and password when
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` were unset, and `render.yaml` does not set them.
  Production therefore had a full-platform ADMIN account whose credentials are
  readable in the repository. The script also *rewrote* the password on every
  boot, so rotating it by hand would be reverted by the next deploy.
- **Fix applied:** `scripts/seed.py` no longer has credential defaults. It skips
  with an informational message when the env vars are absent, requires at least
  12 characters, and only rewrites an existing admin's password when
  `ADMIN_RESET_PASSWORD=true`.
- **Validation:** backend suite green (116 passed); seed skips cleanly with no env vars.
- **Remaining risk:** **Action required by operator** — the existing production
  database still contains this account. Rotate that password (or delete the
  account) before opening signups. Code changes cannot undo an already-seeded row.

### 2. Forgeable JWTs if `SECRET_KEY` was unset
- **Area:** Backend / auth · **Platform:** all
- **Problem:** `SECRET_KEY` defaulted to `"your-secret-key-change-in-production"`.
  With that value anyone can mint an admin access token. Nothing detected it.
- **Fix applied:** `validate_production_settings()` in `app/core/config.py` runs at
  import and refuses to start when `ENVIRONMENT=production` and the secret is a
  known placeholder or shorter than 32 characters. It also rejects a localhost
  `DATABASE_URL` and wildcard/localhost CORS origins in production.
- **Validation:** app imports cleanly in development; production-shaped config with
  the placeholder secret raises at startup.
- **Remaining risk:** none. `render.yaml` uses `generateValue: true` for `SECRET_KEY`.

### 3. One-time codes were brute-forceable (account takeover)
- **Area:** Backend / auth · **Platform:** all
- **Problem:** `POST /api/auth/verify` and `/api/auth/reset-password-phone` accept a
  6-digit OTP with **no attempt limit and no rate limiting**. Only OTP *sending*
  was limited. An attacker who knows a phone number could enumerate the code
  space and take over any account, including by resetting its password.
- **Fix applied:** `OTP_MAX_VERIFY_ATTEMPTS = 5` per issued code (the code is
  destroyed on exhaustion), constant-time comparison via `secrets.compare_digest`,
  plus per-phone (10/15 min) and per-IP (30/15 min) limits on both endpoints.
- **Validation:** `tests/test_auth_hardening.py::test_otp_verify_locks_out_after_repeated_wrong_codes`.

### 4. No rate limiting on password login
- **Area:** Backend / auth · **Platform:** all
- **Problem:** `POST /api/auth/login` had no throttling — unlimited password
  guessing and credential stuffing.
- **Fix applied:** new `app/core/rate_limit.py`; login limited per identifier
  (10/15 min) and per IP (30/15 min), counter cleared on success. Signup
  (10/hour/IP), forgot-password (5/hour/email, 10/hour/IP) and reset-password
  (20/hour/IP) are limited too.
- **Validation:** `tests/test_auth_hardening.py::test_login_is_rate_limited_per_identifier`.
- **Remaining risk:** counters are per-process and in-memory. Correct for the
  current single-instance Render service; must move to Redis before running
  more than one API instance. Documented in the module docstring.

### 5. Password reset links were replayable and logged in full
- **Area:** Backend / auth · **Platform:** all
- **Problem:** `/api/auth/reset-password` logged the complete reset token on
  failure (`logger.warning(f"...Full token: {token}")`) and decoded it without
  signature verification to log its payload. Tokens were also valid for a full
  hour *and reusable*, so one leaked email allowed repeated takeover.
- **Fix applied:** reset tokens now carry a fingerprint of the current password
  hash and are rejected once the password changes, making them single-use. All
  token logging removed; every rejection returns one generic message so the
  failure reason is not disclosed.
- **Validation:** `test_password_reset_token_cannot_be_reused`,
  `test_reset_password_response_never_echoes_the_token`.

### 6. Full SQL statement logging in production
- **Area:** Backend / database · **Platform:** all
- **Problem:** `create_async_engine(..., echo=True)` was hardcoded. Every
  statement and its bound parameters — password hashes, reset tokens, personal
  data — were written to production logs, at a significant throughput cost.
- **Fix applied:** driven by a new `SQL_ECHO` setting, default `False`. Added
  `pool_pre_ping=True` and `pool_recycle=1800`, which also removes a class of
  intermittent 500s from connections dropped while idle.
- **Validation:** suite green; engine constructs with echo off by default.

### 7. No password strength enforcement on the server
- **Area:** Backend / auth · **Platform:** all
- **Problem:** `UserSignup.password` and `ResetPasswordRequest.new_password` had
  no constraints — a one-character password was accepted. `/me/complete-profile`
  required 8 and `reset-password-phone` required 6, so the policy was
  inconsistent and bypassable by choosing the weakest endpoint.
- **Fix applied:** shared validator in `app/schemas/auth.py`, minimum 8
  characters everywhere, maximum 72 bytes (bcrypt silently truncates beyond
  that, so a longer password would not be fully verified at login). `name` is
  bounded to 2–80 characters and whitespace-collapsed.
- **Validation:** `test_signup_rejects_weak_and_oversized_passwords`.

### 8. Feature flags ship disabled, including user registration
- **Area:** Deployment config · **Platform:** all
- **Problem:** `render.yaml` sets `FEATURE_USER_REGISTRATION_ENABLED=false`,
  `FEATURE_COMMUNITY_POSTING_ENABLED=false`, `FEATURE_BUSINESS_REVIEWS_ENABLED=false`,
  `FEATURE_BUSINESS_CLAIMING_ENABLED=false` and `FEATURE_INVITATIONS_ENABLED=false`.
  With these values nobody can sign up or post — the product is inert on launch day.
- **Fix applied:** none — these are deliberate pilot defaults and flipping them is
  a product decision, not a defect. Database flag rows override the environment.
- **Remaining risk:** **Action required by operator** before opening to real users.

---

## P1 — Serious

### 9. Identity documents readable by any signed-in user (IDOR)
- **Area:** Backend / uploads · **Platform:** all
- **Problem:** `GET /api/uploads/download` streamed any `file_url` for any
  authenticated caller with no ownership check. Verification uploads are national
  IDs and residency contracts. Object keys are UUIDs so they are not guessable,
  but any leak of a URL — logs, a support thread, an API response — became a full
  document disclosure, and nothing constrained a caller to their own files.
- **Fix applied:** `_assert_can_read_file()` in `app/core/dependencies.py` gates
  keys under `verification/` to the uploading user and platform staff, on both the
  Bearer and signed-token paths. Listing and profile images are unchanged.
- **Remaining risk:** the model is still capability-URL based for non-identity
  media, which is appropriate for public listing images.

### 10. Phone normalization was not idempotent — unreachable accounts
- **Area:** Backend / auth · **Platform:** all
- **Problem:** `normalize_phone()` accepted a `+`-prefixed number on
  `is_possible_number`, but re-normalizing the digits-only value it *returned*
  required the stricter `is_valid_number` and yielded `None`. Any number outside
  libphonenumber's valid ranges (new carrier prefixes, less-covered countries —
  e.g. `+9715012345678`) was stored in a form the code could never look up again.
  Consequences: duplicate signup with the same phone raised a raw
  `IntegrityError` (HTTP 500 instead of a clear message), phone password reset
  failed, and compound-membership and chat-import matching silently no-opped.
- **Fix applied:** the bare-international branch now falls back to the same
  `is_possible_number` acceptance as the `+` branch, while still rejecting a
  leading zero as a national trunk prefix. Verified idempotent across Egyptian,
  Gulf, UK, French and US formats plus WhatsApp bidi-marked input.
- **Validation:** two pre-existing failing tests
  (`test_signup_duplicate_phone_points_to_otp_login`, `test_reset_password_via_phone_otp`)
  now pass; added `test_normalization_is_idempotent` and
  `test_national_trunk_prefix_is_not_read_as_country_code`.

### 11. Interactive API docs exposed in production
- **Area:** Backend · **Platform:** all
- **Problem:** `/docs`, `/redoc` and `/openapi.json` were served unconditionally,
  publishing the full admin, moderator and internal endpoint surface.
- **Fix applied:** all three disabled when `ENVIRONMENT=production`.

### 12. CORS allowed any origin with credentials
- **Area:** Backend · **Platform:** web
- **Problem:** origins fell back to `["*"]` while `allow_credentials=True`, with
  `allow_methods=["*"]`, `allow_headers=["*"]` and `expose_headers=["*"]`.
  Localhost origins were appended unconditionally, including in production.
- **Fix applied:** explicit allow-list, no wildcard; localhost only outside
  production; methods and headers narrowed to those actually used. Production
  startup now rejects a wildcard or localhost origin outright (see #2).

### 13. Internal error details returned to clients
- **Area:** Backend / uploads · **Platform:** all
- **Problem:** upload, presign and signed-URL handlers returned
  `detail=f"...: {e}"`, leaking S3 bucket names, region and botocore internals.
- **Fix applied:** generic user-facing messages; full context logged server-side.

### 14. Predictable OTP generation
- **Area:** Backend / auth · **Platform:** all
- **Problem:** codes came from `random.choices()`, a non-cryptographic PRNG.
- **Fix applied:** `secrets.choice()`.

### 15. Marketplace listings mis-imported as community comments
- **Area:** Backend / chat import · **Platform:** admin
- **Problem:** a heuristic meant to filter Arabic joke one-liners ("هبيع نفسي")
  was scoped to `هبيع|هابيع|بتباع|selling` — the English `selling` made it
  swallow genuine offers under 28 letters, so "Selling iPhone 13 for 18000 EGP"
  was classified as a community post and then threaded as a comment.
- **Fix applied:** the filter now matches only the Arabic colloquial verbs and
  stands down when the message contains an explicit price.
- **Validation:** pre-existing failing `test_parse_telegram_json` now passes;
  Arabic joke cases and wanted-inquiries still classify as posts.

---

## Component-by-component verification pass

A second pass driven by building, typechecking and actually running every
workspace, plus browser testing of the web app against a live API.

### 16. Mobile app shipped with 16 TypeScript errors, including dead styling
- **Area:** Mobile · **Platform:** iOS + Android · **Severity:** P1
- **Problem:** Metro compiles with Babel, which strips types without checking
  them, so type errors never surfaced in a build. `app/neighbours/[id].tsx`
  referenced design tokens that do not exist — `spacing.lg/md/sm`,
  `typography.subtitle`, `typography.title`, `colors.card`. The token scale is
  numeric (`spacing[4]`), so every one of those evaluated to `undefined` at
  runtime: the neighbour profile rendered with no padding, no gaps, default font
  sizes and a transparent card background.
- **Fix applied:** mapped to the real scale (`spacing[4]`, `typography.size.*`,
  `colors.backgroundCard`); typed the untyped `apiClient.request` response in
  `components/admin/compound-management.tsx`; widened `currentUser.role` to
  accept the `null` the API genuinely returns before a role is chosen.
- **Validation:** `npx tsc --noEmit` in `mobile/` now reports zero errors.
- **Remaining risk:** none for these; the type check is now a usable gate and
  should be wired into CI so this cannot silently recur.

### 17. Client password rules were weaker than the server's
- **Area:** Web + Mobile + shared schemas · **Platform:** all · **Severity:** P1
- **Problem:** after the server minimum moved to 8 characters, every client still
  validated at 6 (`frontend/app/auth/signup`, `reset-password`,
  `forgot-password`, the three mobile equivalents, and `UserSignupSchema`). A
  7-character password passed client validation and came back as a raw 422 the
  user could not act on. The Arabic and English copy also still promised 6.
  Separately `UserSignupSchema` marked `role` required while the server accepts
  null (role is chosen after sign-up), and the login form imposed the sign-up
  minimum, which would have locked out accounts created before the policy.
- **Fix applied:** `MIN_PASSWORD_LENGTH` / `MAX_PASSWORD_LENGTH` and a shared
  `passwordSchema` now live in `packages/shared/src/schemas/auth.ts` next to a
  comment pointing at the server policy; all clients import it. `role` is
  optional. Login validates presence only, with a comment explaining why.
  `passwordMinLength` / `passwordHint` copy updated in both languages.
- **Validation:** live API run confirms 6-char and >72-byte passwords are
  rejected with 422 and a valid password succeeds; the web signup form shows
  "Password must be at least 8 characters".
- **Remaining risk:** bcrypt's 72-byte ceiling is now enforced rather than
  silently truncating.

### 18. Private file endpoints were unreachable whenever local storage was used
- **Area:** Backend / uploads · **Platform:** all · **Severity:** P1
- **Problem:** `GET /api/uploads/{file_path:path}` was registered before
  `GET /api/uploads/download` and `GET /api/uploads/signed-url`. Starlette
  matches in registration order, so both specific routes were shadowed and
  answered `404 {"detail":"File not found"}` instead of streaming the file. They
  are present in the OpenAPI schema, which is why this looked fine on paper.
  Local storage is selected whenever S3 is not configured, so a deploy with
  missing S3 credentials would silently lose all private file access, including
  admin review of verification documents.
- **Fix applied:** the greedy route is now registered last, with a comment
  stating that any new `/api/uploads/*` route must go above it.
- **Validation:** both routes now return 401 (credentials required) rather than
  404; new `backend/tests/test_upload_routes.py` asserts this at the route level
  and asserts the registration order directly.
- **Remaining risk:** none known.

### 19. Per-IP rate limits would have locked out crowds behind carrier NAT
- **Area:** Backend / auth · **Platform:** all · **Severity:** P1
- **Problem:** the limits added earlier in this audit were tuned as if one IP
  meant one person — 30 logins and 30 OTP verifications per IP per 15 minutes,
  10 sign-ups per IP per hour. Egyptian mobile carriers put very large numbers
  of subscribers behind a single NAT address, so ordinary launch traffic from one
  carrier would have started returning 429 to innocent users.
- **Fix applied:** per-IP ceilings raised substantially (login 300/15min, OTP
  300/15min, sign-up 60/hour, forgot-password 60/hour, reset 100/hour) and moved
  into named constants with a comment explaining the split. The per-identifier
  limits — which are the actual brute-force defence and are unaffected by shared
  IPs — stay tight (10 per account per 15 minutes, 5 password resets per email
  per hour).
- **Validation:** live API run confirms repeated failed logins against one
  account still get 429, and repeated wrong OTP codes still lock out.
- **Remaining risk:** `X-Forwarded-For` is client-supplied and therefore
  spoofable, so per-IP limits are best-effort by nature; the per-identifier
  limits are the ones to rely on. State is per-process and must move to Redis
  before running more than one API instance.

### 20. Gated pages showed a permanent spinner to signed-out visitors
- **Area:** Web · **Platform:** web · **Severity:** P1
- **Problem:** `/verification`, `/verification/pending`,
  `/onboarding/compound-select` and `/onboarding/choose-role` all combined
  `if (isLoading || !user) return <Spinner/>` with an effect guarded by
  `if (!user) return`. For a signed-out visitor that never resolves: loading
  finishes, `user` stays null, and the page spins forever with no way forward.
  Confirmed in a browser on `/verification`.
- **Fix applied:** added `frontend/hooks/use-require-auth.ts`, which redirects to
  the login page once loading has finished with no user, and switched those four
  pages to it — one shared fix rather than four one-off patches.
- **Validation:** browser-tested signed out; all four now land on `/auth/login`.
- **Remaining risk:** other gated pages already handled this (via an explicit
  "Please sign in" card or the axios 401 interceptor); the new hook is available
  for any future page.

### 21. Horizontal overflow at 320px
- **Area:** Web / responsive · **Platform:** web · **Severity:** P2
- **Problem:** at a 320px viewport the page scrolled horizontally (scrollWidth
  324 vs clientWidth 320). Measured in the browser: the signed-out header needed
  324px for the brand, language toggle, "Sign In" and "Sign Up" at full padding.
- **Fix applied:** tightened the header row gap and the auth button padding below
  the `sm` breakpoint only, so nothing changes on larger screens. Also added
  `max-w-full` to the toast viewport, which had `w-full p-4` and would inherit
  any ancestor width greater than the viewport.
- **Validation:** browser-measured across 320/360/375/390/430/768/1024/1280/1440
  on 9 public pages — no overflow anywhere. Header screenshot at 320px confirms
  all controls visible, unclipped and not overlapping.
- **Remaining risk:** none known for public pages; authenticated pages were not
  measured at every width because the login rate limit blocked the browser
  session (see remaining work).

### 22. Header touch targets below the 44px minimum
- **Area:** Web / accessibility · **Platform:** web · **Severity:** P2
- **Problem:** the header icon buttons and the language toggle were 40px tall,
  under the 44px minimum touch target.
- **Fix applied:** raised to 44px. The header row is 68px tall so this changed no
  layout.
- **Remaining risk:** footer legal links remain 20px-tall inline text links,
  which is conventional for inline text and was left alone deliberately.

### 23. Mobile login alert exposed the API hostname
- **Area:** Mobile · **Platform:** iOS + Android · **Severity:** P2
- **Problem:** on a network error the login screen appended
  `\n\nAPI URL: ${API_BASE_URL}` to the alert — debug output shown to a
  signed-out user, and infrastructure detail they cannot use.
- **Fix applied:** replaced with a new `auth.networkError` string in English and
  Arabic advising the user to check their connection.

### 24. Mobile uploads leaked raw response bodies
- **Area:** Mobile · **Platform:** iOS + Android · **Severity:** P2
- **Problem:** four call sites in `mobile/lib/upload.ts` threw
  `Upload failed (${status}): ${errorText}`, putting a raw response body or HTML
  error page into an alert.
- **Fix applied:** a single `uploadError()` helper maps 413 and 401/403 to plain
  language, passes through the server's own user-facing `detail`, and otherwise
  falls back to a generic message.

### 25. Feed load failure was indistinguishable from an empty neighbourhood
- **Area:** Mobile · **Platform:** iOS + Android · **Severity:** P2
- **Problem:** `app/(tabs)/home.tsx` caught feed errors, logged to the console
  and set posts to `[]`, so a user on a bad connection saw "Your feed is quiet
  for now" — telling them their neighbourhood is silent when the request in fact
  failed.
- **Fix applied:** tracks the failure and renders the existing shared
  `ErrorState` with a working retry instead of the empty state.
- **Remaining risk:** the same silent-failure pattern exists on other mobile
  screens (market, services, search, notifications, saved listings, messages
  list). Those still show an empty state on failure. Listed as post-launch work
  rather than fixed here, to keep this pass reviewable.

### 26. iOS universal links were not claimed
- **Area:** Mobile / deep links · **Platform:** iOS · **Severity:** P1
- **Problem:** `frontend/public/.well-known/apple-app-site-association` is
  correctly hosted and names `29QWSF7YZ8.com.eljiran.mobile`, and Android
  declares verified app links for `eljiran.io` and `www.eljiran.io` — but
  `app.json` had no `ios.associatedDomains`, so iOS never claimed the domain.
  Every link neighbours shared would have opened in Safari instead of the app.
- **Fix applied:** added `applinks:eljiran.io` and `applinks:www.eljiran.io`.
- **Remaining risk:** needs a real device test after the next build; the
  entitlement only takes effect in a signed build, so it cannot be verified
  locally.

### 27. Destructive local test script had no safety guard
- **Area:** Backend / tooling · **Platform:** n/a · **Severity:** P2
- **Problem:** `backend/scripts/smoke_bootstrap.py` (added during this pass to
  allow running the API without Postgres) calls `drop_all`, so an accidental run
  with a production `DATABASE_URL` exported in the shell would destroy the
  platform.
- **Fix applied:** refuses to run unless `DATABASE_URL` is SQLite or an
  explicitly local host.
- **Validation:** a Render-style URL is refused; SQLite still works.

---

## Verification performed — component pass

| Check | Result |
| --- | --- |
| `packages/tokens` typecheck + build | clean |
| `packages/i18n` typecheck + build | clean |
| `packages/shared` typecheck + build + tests | clean, 3 tests passed |
| `frontend` `tsc --noEmit` | clean |
| `frontend` production `next build` | compiled, 45/45 static pages generated |
| `frontend` Vitest | 7 passed |
| `mobile` `tsc --noEmit` | clean (was 16 errors) |
| `backend` pytest | 120 passed, 0 failed (was 116) |
| Backend live HTTP journey suite (39 checks) | 39 passed, 0 failed |
| Production config guards | placeholder SECRET_KEY refused; localhost CORS refused; valid config boots with docs and SQL echo off |
| Route registration | 219 routes in development, 213 in production (local-storage routes correctly absent) |
| Browser: responsive sweep | 9 public pages x 9 widths (320-1440), no horizontal overflow |
| Browser: signed-out access to gated pages | all redirect to login, no permanent spinners |
| Browser: console errors | none observed |

The live HTTP suite exercised: sign-up validation and duplicate-phone handling,
login success/failure/unknown-user (identical messages, no user enumeration),
login and OTP brute-force lockout, bearer-token enforcement on protected
endpoints, admin and moderator authorization, access/refresh/reset token type
separation, password-reset token hygiene (no echo, no replay), malformed and
missing input, unknown route and wrong method, Arabic/emoji/oversized names,
upload authorization on all four upload routes, public read endpoints and
pagination bounds, and error-body hygiene (no stack traces or driver internals).

---

## Verification performed

| Check | Result |
| --- | --- |
| `pytest` (backend) | 116 passed, 0 failed (baseline: 104 passed, 3 failed) |
| Backend app import / route registration | 219 routes, clean import |
| Phone normalization idempotency sweep | 17 input forms, all stable |
| Chat-import classifier regression sweep | listings, Arabic jokes, wanted-asks all correct |

---

## Operator actions required before launch

These cannot be fixed in code:

1. Rotate or delete the seeded admin account in the production database (#1).
2. Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` on Render if a bootstrap admin is still
   wanted, or leave them unset now that the account exists.
3. Decide and set the launch feature flags (#8) — registration and community
   posting are currently off.
4. Confirm `SECRET_KEY`, `CORS_ORIGINS` and `DATABASE_URL` are production values;
   the API now refuses to start otherwise.
5. Verify iOS universal links on a real device after the next signed build (#26).
   The `associatedDomains` entitlement cannot be tested in the simulator or from
   a local checkout.

---

## Known remaining work (not launch blockers)

Deliberately not fixed in this pass, to keep the change set reviewable:

1. **Silent API failures on mobile screens other than the feed** — market,
   services, search, notifications, saved listings and the messages list still
   render an empty state when a request fails, so a user on a bad connection is
   told there is nothing there. The home feed now distinguishes the two (#25) and
   the same pattern applies mechanically to the rest.
2. **Raw `error.message` in mobile alerts** — widespread across mobile screens.
   The API client's own messages are usually acceptable prose, so this is a
   polish issue rather than a correctness one, but it can surface network-layer
   text. The worst case (the login screen exposing the API hostname) is fixed
   (#23).
3. **No `BackHandler` anywhere in the mobile app** — the multi-step moderator and
   provider onboarding flows and the phone forgot-password flow track their step
   in component state, so the Android hardware back button pops the whole screen
   instead of returning to the previous step. Modals are fine (they use
   `onRequestClose`). Worth fixing before heavy Android promotion.
4. **`mobile/app/index.tsx` splash has no safe-area insets** — centred content, so
   the practical impact is small.
5. **`console.error` calls left across mobile screens** — harmless in production
   but they are the reason the silent failures above went unnoticed; routing them
   to a real error reporter would surface this class of bug.
6. **Rate-limit state is per-process and in-memory** — must move to Redis before
   running more than one API instance.
7. **Authenticated web pages were not measured at every viewport width** — the
   browser session hit the login rate limit during testing. Public pages are
   fully covered.
8. **iOS `NSUserNotificationsUsageDescription` is not declared** in
   `app.json`; `expo-notifications` supplies a default. Worth adding custom copy
   before review.

`android.versionCode` is `1` in `app.json` while iOS `buildNumber` is `43`, which
looks like a mismatch but is not one: `eas.json` sets
`cli.appVersionSource: "remote"` with `autoIncrement: true` on the production
profile, so EAS assigns both server-side and the checked-in values are unused.
