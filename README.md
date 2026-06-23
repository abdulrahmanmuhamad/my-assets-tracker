# Asset Portfolio Tracker

Private Next.js portfolio dashboard for minerals, real estate, jewelry, brokerage holdings, market indexes, files, ROI, reports, live metal prices, and automated alerts.

## Features

- Dashboard totals, allocation, ROI, profit/loss, cash flow, and alert summaries
- Minerals with gold karat, non-gold purity, live pricing, search, filters, and files
- Jewelry with karat/purity valuation, gemstones, ROI, search, filters, and files
- Real estate with financing, equity, rent, expenses, cash flow, and reminders
- Plaid Investments accounts, holdings, transactions, cost basis, and sync
- Plaid bank connections for depository balances, credit-card debt, and bank transactions
- S&P 500, Dow Jones, Nasdaq Composite, Nasdaq 100, and Russell 2000 tracking
- In-app and email alerts with cooldown, recurrence, history, and read state
- CSV import plus CSV/PDF/JSON export
- Clerk authentication, PostgreSQL, Prisma, Zod, Tailwind CSS, and Recharts
- Passwordless email-link sign-up/sign-in, verified-email gating, owner approval, usernames, roles, and suspended/rejected access controls

Complete credential instructions: [`docs/THIRD_PARTY_KEYS_SETUP.md`](docs/THIRD_PARTY_KEYS_SETUP.md).

## Local Development Setup

Prerequisites:

- Node.js 20+
- PostgreSQL 16 or 17
- Database `my_assets_tracker`
- Login role `asset_user`

Windows Command Prompt commands:

```bat
cd /d D:\MyAssetsTracker
npm install
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm run prisma:generate
npm run db:deploy
npm run db:seed
npm run dev -- -p 3001
```

PowerShell equivalent:

```powershell
Set-Location D:\MyAssetsTracker
npm install
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm run prisma:generate
npm run db:deploy
npm run db:seed
npm run dev -- -p 3001
```

Open `http://localhost:3001`.

Check integration readiness without printing secrets:

```powershell
npm run integrations:check
```

Minimum local `.env`:

```env
DATABASE_URL="postgresql://asset_user:asset_password@localhost:5432/my_assets_tracker?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
ALLOW_DEV_AUTH_BYPASS="true"
METAL_PRICE_PROVIDER="yahoo"
PRICE_CACHE_TTL_MINUTES="360"
MARKET_INDEX_CACHE_TTL_MINUTES="15"
TOKEN_ENCRYPTION_KEY="paste-a-generated-32-byte-base64-key"
ALERTS_EVALUATION_SECRET="paste-a-different-long-random-secret"
```

Never commit `.env` or `.env.production`.

## Clerk Passwordless Login And Approval Setup

Use a Clerk **Development instance** while building locally.

1. Create a Clerk application at `https://dashboard.clerk.com`.
2. Set the development application URL to `http://localhost:3001` when requested.
3. In User & Authentication, enable Email address.
4. Enable passwordless email-link verification and sign-in. Do not require a password.
5. Optionally enable phone/SMS and authenticator-app MFA.
6. Copy the development keys beginning with `pk_test_` and `sk_test_`.
7. Set:

```env
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

Restart the server and test:

- `http://localhost:3001/sign-up`
- `http://localhost:3001/sign-in`

The custom sign-up page collects a local username and email, Clerk verifies the email link, and verified non-owners wait at `/pending-approval`. A verified email listed in `OWNER_EMAILS` is bootstrapped as an approved owner. Owners and admins manage access in Settings > User Access. Approval never grants visibility into another user's financial data.

Optional webhook synchronization is available at `POST /api/webhooks/clerk`. Add that HTTPS endpoint in Clerk, subscribe to user create/update/delete events, and set its signing secret as `CLERK_WEBHOOK_SECRET`. Requests are signature-verified before any user data is changed.

For production, create a Clerk Production instance only after choosing a real domain. Use `pk_live_` and `sk_live_` keys and complete Clerk's DNS instructions.

Users change their authentication email through Clerk's account manager in Settings > Profile/Security. Clerk requires verification before the new primary email is synchronized locally, and the local account remains linked by Clerk user ID.

## Disabling Dev Auth Bypass

The bypass is intended only for local development without Clerk keys:

```env
ALLOW_DEV_AUTH_BYPASS="true"
```

To test real Clerk authentication locally:

```env
ALLOW_DEV_AUTH_BYPASS="false"
```

Production must always use:

```env
ALLOW_DEV_AUTH_BYPASS=false
```

The application also rejects the bypass whenever `NODE_ENV=production`, even if the variable is accidentally set to `true`. Missing production Clerk keys return a clear `503` response.

## Plaid Sandbox Setup

1. Create a Plaid application at `https://dashboard.plaid.com`.
2. Enable the Investments product.
3. Copy the Plaid client ID and **Sandbox** secret.
4. Add `http://localhost:3001/stocks` as a redirect URI when required.
5. Set:

```env
PLAID_CLIENT_ID="..."
PLAID_SECRET="your-sandbox-secret"
PLAID_ENV="sandbox"
PLAID_PRODUCTS="investments,auth,transactions,liabilities"
PLAID_COUNTRY_CODES="US"
PLAID_REDIRECT_URI="http://localhost:3001/stocks"
```

Use the Stocks page to connect a Sandbox institution. The app never stores brokerage usernames or passwords. It receives a provider access token, encrypts it, and stores only the encrypted value.

Plaid products must also be enabled for the application in the Plaid dashboard. `transactions` can initially return `PRODUCT_NOT_READY`, and liability data is not available from every institution. These conditions are recorded as partial-sync warnings while account balances remain usable.

## Banks, Cash, and Liabilities

Open `/banks` to connect checking, savings, money-market, cash-management, CD, credit-card, and supported loan accounts. Investment accounts remain on `/stocks`.

- Liquid cash includes opted-in depository balances. Checking, savings, money-market, and cash-management accounts are opted in by default; CDs are not.
- Credit-card debt is informational and is never added to portfolio asset value.
- Net cash after debt is liquid cash minus credit-card debt and is shown only as an informational bank metric.
- Settings > Privacy & Display can optionally include liquid cash in the dashboard portfolio total. The default is off.
- Cash is included at face value and does not add artificial gain or loss.

Plaid access tokens use the existing AES-256-GCM encryption key. Bank usernames and passwords are never received or stored by this application.

## Privacy, Theme, and Responsive Layout

Financial values are hidden by default. Use the eye control beside an individual value or the global header control to reveal or hide values temporarily. The persisted default is configured under Settings > Privacy & Display; CSV and PDF exports remain complete and unmasked.

Theme choices are Light, Dark, and System. The selected setting is stored per user and applies to pages, forms, tables, modals, charts, badges, and navigation.

The application supports desktop, laptop, tablet, and mobile layouts. Navigation collapses into a mobile menu, wide financial tables have mobile card views or horizontal scrolling, and page actions adapt to narrow screens.

## Token Encryption Key Setup

Generate a 32-byte key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set:

```env
TOKEN_ENCRYPTION_KEY="generated-value"
```

Tokens use AES-256-GCM. Back up this key securely. Changing it without re-encrypting existing tokens forces brokerage reconnection.

Generate a separate alert-evaluation secret with the same command:

```env
ALERTS_EVALUATION_SECRET="different-generated-value"
```

## Yahoo Finance Metal/Index Pricing

```env
METAL_PRICE_PROVIDER="yahoo"
METAL_PRICE_API_KEY=""
PRICE_CACHE_TTL_MINUTES="360"
MARKET_INDEX_CACHE_TTL_MINUTES="15"
```

Metals:

- Gold `GC=F`
- Silver `SI=F`
- Platinum `PL=F`
- Palladium `PA=F`
- Copper `HG=F`, converted from USD/pound to USD/gram

Indexes:

- S&P 500 `^GSPC`
- Dow Jones `^DJI`
- Nasdaq Composite `^IXIC`
- Nasdaq 100 `^NDX`
- Russell 2000 `^RUT`

Indexes are watchlist data and never contribute to portfolio value.

## Alert System Setup

Alerts support:

- Mineral and jewelry ROI, value, and live-price thresholds
- Stock price, ROI, market value, and unrealized gain/loss thresholds
- Market-index price, daily-change, and baseline-change thresholds
- Property payment, rent collection, and custom reminders
- One-time or recurring rules
- Active, paused, triggered, and expired states
- In-app and email channels
- Cooldown protection against duplicates
- Notification history and read/unread state

Pages:

- `/alerts`
- `/notifications`
- `/market-indexes`

Every rule, event, preference, and delivery log is scoped by authenticated `user_id`.

## Email Notification Setup

Development without Resend uses the safe console provider. Recipients are masked in logs and missing email delivery does not stop in-app events.

For real email delivery:

```env
RESEND_API_KEY="re_..."
ALERT_FROM_EMAIL="Asset Alerts <alerts@your-verified-domain.com>"
```

Verify the sender domain in Resend before production. Configure the user's destination and quiet hours in Settings > Notification Preferences. Quiet hours currently use UTC.

SMS fields are reserved for future work and remain disabled:

```env
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM_NUMBER=""
```

## Local Alert Evaluation

Direct manual evaluation:

```powershell
cd D:\MyAssetsTracker
npm run alerts:evaluate
```

Protected HTTP evaluation:

```powershell
$secret = "the-value-from-ALERTS_EVALUATION_SECRET"
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3001/api/alerts/evaluate" `
  -Headers @{ Authorization = "Bearer $secret" }
```

The endpoint returns counts only. It never returns provider tokens, email secrets, or other users' alert details.

## Production Cron Setup

Recommended evaluation interval: every 15 minutes. Hourly is acceptable for low-frequency reminders.

Docker cron worker:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml --profile cron up -d
```

The `alerts-cron` service calls the private app service every `ALERTS_EVALUATION_INTERVAL_SECONDS`, default `900` seconds.

For an external scheduler, send:

```text
POST https://your-domain.com/api/alerts/evaluate
Authorization: Bearer <ALERTS_EVALUATION_SECRET>
```

For Vercel Cron, create a scheduled request to `/api/alerts/evaluate`, configure the bearer secret, and use a 15-minute schedule. Do not expose the secret to browser code or use a `NEXT_PUBLIC_` variable.

This repository includes `vercel.json` with a 15-minute GET schedule. In Vercel, set `CRON_SECRET` to a long random value. Vercel sends it as a bearer token, and the same endpoint also continues to support POST with `ALERTS_EVALUATION_SECRET`.

## API Summary

Identity and access:

- `GET|PUT /api/profile` for the current username/display name; email is Clerk-managed
- `GET /api/auth/status`
- `GET /api/admin/users` for owner/admin identity metadata only
- `POST /api/admin/users/:id/approve|reject|suspend|restore`
- `PUT /api/admin/users/:id/role` for owners
- `POST /api/webhooks/clerk` with a valid Clerk signature

Alerts:

- `GET|POST /api/alerts`
- `GET|PUT|DELETE /api/alerts/:id`
- `POST /api/alerts/:id/pause`
- `POST /api/alerts/:id/resume`
- `POST /api/alerts/evaluate` with bearer secret

Notifications:

- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`
- `DELETE /api/notifications/:id`
- `GET|PUT /api/notifications/preferences`

Market indexes:

- `GET /api/market-indexes`
- `POST /api/market-indexes/refresh`
- `GET /api/market-indexes/:symbol`

All portfolio endpoints require an authenticated, verified, approved local user. Unverified, pending, rejected, and suspended users receive stable `403` denial codes. Evaluation requires the dedicated server secret.

## Testing

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run alerts:evaluate
```

## Deployment Checklist

1. Install Docker or select a managed deployment platform.
2. Copy `.env.production.example` to `.env.production`.
3. Replace every placeholder.
4. Use a URL-encoded PostgreSQL password in `DATABASE_URL`.
5. Set a real `NEXT_PUBLIC_APP_URL`.
6. Configure Clerk Production keys and DNS.
7. Configure Plaid Production credentials and redirect URI.
8. Set permanent `TOKEN_ENCRYPTION_KEY` and `ALERTS_EVALUATION_SECRET` values.
9. Configure and verify Resend sender domain if email is enabled.
10. Copy `Caddyfile.example` to `Caddyfile` and replace the domain.
11. Build, migrate, start the app, and start the cron profile.

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d db
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app caddy
docker compose --env-file .env.production -f docker-compose.prod.yml --profile cron up -d alerts-cron
```

Rebuild after changing any `NEXT_PUBLIC_*` value because Next.js embeds those values in client bundles.

For serverless deployment, replace local uploads with S3, Supabase Storage, or Vercel Blob.

## Security Checklist

- `ALLOW_DEV_AUTH_BYPASS=false` in production
- Real Clerk `pk_live_` and `sk_live_` keys configured
- Plaid access tokens encrypted; brokerage credentials never stored
- Permanent 32-byte token encryption key stored in a secret manager
- Long random evaluation secret stored server-side only
- PostgreSQL password URL-encoded in `DATABASE_URL`
- Every portfolio and alert query scoped by authenticated `user_id`
- Verified email plus local owner approval required before any portfolio page or API
- `OWNER_EMAILS` contains at least one verified production owner
- Last owner cannot be demoted, rejected, or suspended
- Clerk webhook signatures verified with `CLERK_WEBHOOK_SECRET`
- Alert evaluation endpoint excluded from Clerk only because bearer-secret authentication is mandatory
- Resend, Plaid, Clerk, database, and encryption secrets never use `NEXT_PUBLIC_`
- HTTPS enabled through Caddy or the hosting platform
- Database backups and encryption-key backups configured
- Upload storage private and not served as a public directory
- Tests and production build pass before deployment

## Database Models

Portfolio models include users, minerals, real estate, jewelry, files, settings, metal prices, brokerage connections/accounts, holdings, transactions, and sync logs.

Alert models:

- `alert_rules`
- `alert_events`
- `notification_preferences`
- `alert_delivery_logs`
- `market_index_price_cache`
