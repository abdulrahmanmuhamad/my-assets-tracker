# Third-Party Keys Setup

This application keeps secrets on the server. Never paste secret values into browser code, commit them to Git, or prefix them with `NEXT_PUBLIC_`. The only public credential in this guide is Clerk's publishable key.

## Configuration Order

1. Create PostgreSQL and set `DATABASE_URL`.
2. Configure Clerk Development, email links, and `OWNER_EMAILS`.
3. Generate `TOKEN_ENCRYPTION_KEY` and alert secrets.
4. Configure Plaid Sandbox.
5. Optionally configure Resend.
6. Apply migrations, run the readiness checks, then start the app.
7. Add the Clerk webhook after a public HTTPS URL is available.
8. Create separate production credentials only when the production domain is ready.

## Public And Secret Values

| Variable | Classification | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public | Initializes Clerk in the browser |
| `NEXT_PUBLIC_APP_URL` and Clerk route variables | Public | Application URLs |
| `CLERK_SECRET_KEY` | Secret | Clerk Backend API |
| `CLERK_WEBHOOK_SECRET` | Secret | Verifies Clerk webhook signatures |
| `OWNER_EMAILS` | Server configuration | Verified emails that bootstrap as owners |
| `DATABASE_URL` | Secret | PostgreSQL credentials |
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | Secret | Plaid server API |
| `TOKEN_ENCRYPTION_KEY` | Critical secret | Encrypts Plaid access tokens at rest |
| `RESEND_API_KEY` | Secret | Sends alert email |
| `ALERTS_EVALUATION_SECRET`, `CRON_SECRET` | Secret | Authorizes alert evaluation |
| `METAL_PRICE_API_KEY` | Secret when used | Optional metal provider key |
| `TWILIO_*` | Secret | Reserved; SMS delivery is not implemented |

## 1. Clerk

Official references: [Clerk Dashboard](https://dashboard.clerk.com/), [custom email-link flows](https://clerk.com/docs/guides/development/custom-flows/authentication/email-links), and [webhooks](https://clerk.com/docs/guides/development/webhooks/overview).

### Local Development

1. In Clerk Dashboard, create or select the **Development** instance. You do not need to deploy first.
2. Set the local application URL to `http://localhost:3001` if Clerk asks for one.
3. Open **User & Authentication > Email, Phone, Username**. Require an email address and enable email-link verification/sign-in. Do not enable password as a required strategy.
4. Keep Clerk's own username sign-in disabled unless you need it elsewhere. This app stores its portfolio username in local profile metadata and signs in by email only.
5. Optional: enable phone numbers, SMS verification, authenticator applications, and other MFA factors in Clerk. Those are managed in Clerk's account UI.
6. Open **API Keys** in the Development instance. Copy `pk_test_...` and `sk_test_...`.
7. Choose the first owner email. It must exactly match the verified Clerk primary email, ignoring case.
8. Set the variables below and restart Next.js.

```env
NEXT_PUBLIC_APP_URL="http://localhost:3001"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET=""
OWNER_EMAILS="owner@example.com"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/pending-approval"
ALLOW_DEV_AUTH_BYPASS="false"
```

Test `/sign-up` with username and email. The link returns to `/verify-email`; verified non-owners go to `/pending-approval`. A verified address in `OWNER_EMAILS` becomes an approved owner.

### Owner Bootstrap

Use plain comma-separated emails:

```env
OWNER_EMAILS="owner@example.com,second-owner@example.com"
```

Only a verified primary Clerk email can match. An empty list never auto-approves anyone. Keep at least one production owner configured. Approval grants application access only; it does not let an owner inspect another user's portfolio.

### Webhook

The route is `POST /api/webhooks/clerk`. It verifies every request signature before processing `user.created`, `user.updated`, or `user.deleted`.

1. Deploy or expose localhost through an HTTPS tunnel.
2. In Clerk Dashboard, open **Webhooks** and create an endpoint such as `https://assets.example.com/api/webhooks/clerk`.
3. Subscribe to `user.created`, `user.updated`, and `user.deleted`.
4. Copy the endpoint signing secret, normally beginning with `whsec_`, into `CLERK_WEBHOOK_SECRET`.
5. Send Clerk's test event and confirm a `200` response.

The app also synchronizes the current Clerk user on authenticated requests, so local auth works without a webhook. The webhook improves email/profile synchronization between sessions.

### Production Domain

1. Create or switch to Clerk's **Production** instance after the real domain is selected.
2. Add the exact domain, for example `assets.example.com`, and complete any DNS records Clerk displays.
3. Replace development keys with `pk_live_...` and `sk_live_...` in the deployment secret manager.
4. Configure the production webhook URL and its separate signing secret.
5. Set allowed redirect/origin URLs to the HTTPS production domain.
6. Set `ALLOW_DEV_AUTH_BYPASS=false`, deploy, and test sign-up, email verification, owner approval, sign-in, email change, MFA, and sign-out.

Email changes use Clerk's User Profile. Clerk verifies the new address before it becomes primary; the local record continues to match by Clerk user ID, preventing a second portfolio user from being created.

## 2. Plaid

Official references: [Plaid Dashboard](https://dashboard.plaid.com/), [Link for web](https://plaid.com/docs/link/web/), and [going to Production](https://plaid.com/docs/quickstart/#going-to-production).

1. Create a Plaid application and open **Team Settings > Keys**.
2. Copy the client ID and the **Sandbox** secret.
3. Request or enable Investments, Auth, Transactions, and Liabilities in **Products**. Product availability and Production access require Plaid approval.
4. Add `http://localhost:3001/stocks` and `http://localhost:3001/banks` to Plaid's allowed redirect URI list. This application currently sends the single `PLAID_REDIRECT_URI` value to both Link flows, so set it to the page you are actively testing if Plaid requires a redirect for that institution.
5. Set:

```env
PLAID_CLIENT_ID="..."
PLAID_SECRET="sandbox-secret"
PLAID_ENV="sandbox"
PLAID_PRODUCTS="investments,auth,transactions,liabilities"
PLAID_COUNTRY_CODES="US"
PLAID_REDIRECT_URI="http://localhost:3001/stocks"
```

6. Start the app and connect a Sandbox institution from Stocks or Banks. Use Plaid's documented Sandbox credentials in Link, never real brokerage credentials.
7. Confirm connect, sync, and disconnect. The browser receives only a short-lived Link token/public token; the exchanged access token is encrypted before database storage and is never returned to the frontend.

For production, obtain Plaid Production approval, use the Production secret, set `PLAID_ENV=production`, and allow the exact HTTPS redirect URLs. Do not reuse Sandbox tokens.

## 3. Resend

Official references: [API keys](https://resend.com/docs/dashboard/api-keys/introduction) and [domain verification](https://resend.com/docs/dashboard/domains/introduction).

1. Create a Resend account and API key with sending permission.
2. Add your sending domain and publish the SPF/DKIM DNS records Resend supplies.
3. Wait for the domain to show **Verified**.
4. Set a sender on that domain:

```env
RESEND_API_KEY="re_..."
ALERT_FROM_EMAIL="Asset Alerts <alerts@assets.example.com>"
```

Without `RESEND_API_KEY`, local alert evaluation uses the safe console provider. It masks recipients and does not prevent in-app notifications.

## 4. Yahoo Finance And Market Data

The current Yahoo-compatible provider needs no API key. It retrieves futures/index market data and caches it server-side.

```env
METAL_PRICE_PROVIDER="yahoo"
METAL_PRICE_API_KEY=""
PRICE_CACHE_TTL_MINUTES="360"
MARKET_INDEX_CACHE_TTL_MINUTES="15"
```

`360` means metal prices refresh after six hours when a price-dependent request occurs or a manual refresh runs. There is no background job solely for metal prices. A different provider may require `METAL_PRICE_API_KEY`.

## 5. PostgreSQL

Local example:

```env
DATABASE_URL="postgresql://asset_user:asset_password@localhost:5432/my_assets_tracker?schema=public"
```

Production should use a managed PostgreSQL database with TLS, backups, and a restricted application role. URL-encode the username/password portion. For example, password `a@b:c` becomes `a%40b%3Ac`. Keep provider-specific TLS query parameters supplied by the database host.

Apply schema changes:

```powershell
npm run prisma:generate
npm run db:migrate   # local development
npm run db:deploy    # production/CI
```

`prisma migrate dev` creates a shadow database and therefore needs PostgreSQL `CREATEDB`. If the restricted local `asset_user` returns Prisma `P3014`, keep the checked-in migration files and run `npm run db:deploy` to apply them. Grant `CREATEDB` only to a development role that must author new migrations; the production application role should remain restricted.

## 6. Token Encryption

Generate a 32-byte Base64 key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set the output as `TOKEN_ENCRYPTION_KEY`. Back it up in a password manager or secret manager. Tokens use AES-256-GCM. Changing or losing this key makes existing Plaid tokens unreadable and forces every bank/brokerage connection to reconnect.

## 7. Alerts And Cron

Generate two separate random values using the command above:

```env
ALERTS_EVALUATION_SECRET="..."
CRON_SECRET="..."
```

- Local evaluation: `npm run alerts:evaluate`
- HTTP evaluation: `POST /api/alerts/evaluate` with `Authorization: Bearer <ALERTS_EVALUATION_SECRET>`
- Docker: enable the `cron` profile in `docker-compose.prod.yml`
- Vercel: `vercel.json` schedules the route every 15 minutes; Vercel sends `CRON_SECRET` as a bearer token

Both values are server secrets. The comparison is constant-time. Missing Resend configuration does not fail evaluation.

## 8. Upload Storage

Current local configuration:

```env
UPLOAD_DIR="./storage/uploads"
MAX_UPLOAD_MB="10"
```

Files are served through authenticated, user-scoped routes. Local disk is unsuitable for serverless production because it is ephemeral and does not scale across instances. Before serverless deployment, replace it with private S3-compatible storage, Supabase Storage, or Vercel Blob and preserve authenticated authorization checks.

## 9. Optional SMS

```env
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM_NUMBER=""
```

These are reserved for a future alert-delivery provider. SMS alerts are not active. Clerk's own phone verification/MFA is configured in Clerk and does not use these application variables.

## Complete Local Example

```env
DATABASE_URL="postgresql://asset_user:asset_password@localhost:5432/my_assets_tracker?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET=""
OWNER_EMAILS="owner@example.com"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/pending-approval"
ALLOW_DEV_AUTH_BYPASS="false"
APP_USER_EMAIL="owner@example.com"
APP_USER_NAME="Portfolio Owner"
PLAID_CLIENT_ID="..."
PLAID_SECRET="sandbox-secret"
PLAID_ENV="sandbox"
PLAID_PRODUCTS="investments,auth,transactions,liabilities"
PLAID_COUNTRY_CODES="US"
PLAID_REDIRECT_URI="http://localhost:3001/stocks"
TOKEN_ENCRYPTION_KEY="generated-base64-key"
UPLOAD_DIR="./storage/uploads"
MAX_UPLOAD_MB="10"
METAL_PRICE_PROVIDER="yahoo"
METAL_PRICE_API_KEY=""
PRICE_CACHE_TTL_MINUTES="360"
MARKET_INDEX_CACHE_TTL_MINUTES="15"
ALERTS_EVALUATION_SECRET="different-generated-secret"
CRON_SECRET="another-generated-secret"
RESEND_API_KEY=""
ALERT_FROM_EMAIL="Asset Alerts <alerts@example.com>"
```

## Production Example

Use the deployment platform's secret manager instead of committing this file:

```env
DATABASE_URL="postgresql://app_user:url_encoded_password@managed-host:5432/assets?sslmode=require"
NEXT_PUBLIC_APP_URL="https://assets.example.com"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
CLERK_WEBHOOK_SECRET="whsec_..."
OWNER_EMAILS="owner@example.com"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/pending-approval"
ALLOW_DEV_AUTH_BYPASS="false"
PLAID_CLIENT_ID="..."
PLAID_SECRET="production-secret"
PLAID_ENV="production"
PLAID_PRODUCTS="investments,auth,transactions,liabilities"
PLAID_COUNTRY_CODES="US"
PLAID_REDIRECT_URI="https://assets.example.com/stocks"
TOKEN_ENCRYPTION_KEY="permanent-generated-base64-key"
RESEND_API_KEY="re_..."
ALERT_FROM_EMAIL="Asset Alerts <alerts@assets.example.com>"
ALERTS_EVALUATION_SECRET="..."
CRON_SECRET="..."
METAL_PRICE_PROVIDER="yahoo"
PRICE_CACHE_TTL_MINUTES="360"
MARKET_INDEX_CACHE_TTL_MINUTES="15"
```

## Verification Commands

Run in this order:

```powershell
npm run integrations:check
npm run typecheck
npm run lint
npm test
npm run build
npm run alerts:evaluate
npm run dev -- -p 3001
```

Then manually test: owner sign-up/sign-in, non-owner sign-up, owner approval, suspended access, Clerk email change, Plaid Sandbox connect/sync/disconnect, in-app notification read state, and Resend or console fallback.
