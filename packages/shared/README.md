# @hoodna/shared

Shared contracts and infrastructure for Eljiran mobile and web apps.

## Usage

```typescript
import { ApiClient, User, Post } from "@hoodna/shared";

const client = new ApiClient("http://localhost:8000");
client.setAccessToken("your-token");

const user = await client.getMe();
const posts = await client.getPosts();
```

## Launch telemetry

Eljiran uses a fixed, privacy-conscious event taxonomy:

- `app_opened`
- `registration_started`
- `registration_completed`
- `onboarding_step_viewed`
- `onboarding_completed`
- `community_selected`
- `search_performed`
- `search_result_opened`
- `post_created`
- `comment_created`
- `business_profile_viewed`
- `business_claim_submitted`
- `invite_shared`
- `referral_registration_completed`
- `notification_opened`
- `report_submitted`

Each event has a typed property allowlist in `ANALYTICS_PROPERTY_ALLOWLIST`.
`sanitizeAnalyticsProperties` rejects unknown properties by default, or removes
them in `remove` mode. Free text, search queries, contact details, addresses,
message/post content, credentials, and tokens are never accepted.

`Analytics` and `ErrorReporter` are vendor-neutral. Use their no-op adapters
when telemetry is disabled, or the first-party API adapters with an injected
transport such as `ApiClient`.

