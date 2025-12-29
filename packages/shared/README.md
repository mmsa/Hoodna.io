# @hoodna/shared

Shared types and API client for Hoodna.io mobile and web apps.

## Usage

```typescript
import { ApiClient, User, Post } from "@hoodna/shared";

const client = new ApiClient("http://localhost:8000");
client.setAccessToken("your-token");

const user = await client.getMe();
const posts = await client.getPosts();
```

