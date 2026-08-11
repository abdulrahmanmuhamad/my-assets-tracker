# Asset Portfolio Tracker

Private Next.js portfolio dashboard for minerals, real estate, jewelry, brokerage holdings, market indexes, files, ROI, reports, live metal prices, and automated alerts.

## Features

- Dashboard totals, allocation, ROI, profit/loss, cash flow, and alert summaries
- Minerals with gold karat, non-gold purity, live pricing, search, filters, and files
- Jewelry with karat/purity valuation, gemstones, ROI, search, filters, and files
- Real estate with financing, equity, rent, expenses, cash flow, and reminders
- SnapTrade Personal brokerage accounts, holdings, transactions, cost basis, and sync
- SimpleFIN Bridge bank connections for balances, credit-card debt, and transactions
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

## Automatic Bank And Brokerage Sync

No SimpleFIN or SnapTrade credentials belong in `.env`. Each approved user configures their own read-only provider from the Banks or Stocks page.

### SimpleFIN Bridge Banks

1. Open Banks and choose **Connect Bank**.
2. Follow **Create setup token** to SimpleFIN Bridge.
3. Subscribe for $15/year or $1.50/month, connect the bank on SimpleFIN, and create a one-time setup token.
4. Paste that token into the app once. The app exchanges it server-side, encrypts the returned read-only access URL with `TOKEN_ENCRYPTION_KEY`, and immediately discards the setup token.
5. Use **Sync All** for balances and transactions. SimpleFIN updates source data about daily and limits clients to 24 requests per day, so the app batches all connected SimpleFIN banks into one refresh.

### SnapTrade Personal Stocks

1. Create a free SnapTrade Personal account at `https://snaptrade.com/snaptrade-personal`.
2. Open the SnapTrade dashboard and copy the Personal Client ID and Personal Consumer Key.
3. In this app, open Stocks, choose **Connect Brokerage**, enter those two values, and continue to SnapTrade.
4. Sign in to the brokerage only inside SnapTrade's portal. The app requests a read-only connection and never receives the brokerage username or password.
5. After SnapTrade redirects back to `/stocks`, the app imports accounts, balances, unified positions, and available activities.

Both provider credentials are encrypted per authenticated user and never returned by an API. Plaid remains disabled as a legacy integration unless `ENABLE_PLAID_FEATURES=true` is deliberately configured.

## Banks, Cash, and Liabilities

Open `/banks` to connect checking, savings, money-market, cash-management, CD, credit-card, and supported loan accounts. Investment accounts remain on `/stocks`.

- Liquid cash includes opted-in depository balances. Checking, savings, money-market, and cash-management accounts are opted in by default; CDs are not.
- Credit-card debt is informational and is never added to portfolio asset value.
- Net cash after debt is liquid cash minus credit-card debt and is shown only as an informational bank metric.
- Settings > Privacy & Display can optionally include liquid cash in the dashboard portfolio total. The default is off.
- Cash is included at face value and does not add artificial gain or loss.

SimpleFIN access URLs use the existing AES-256-GCM encryption key. Bank usernames and passwords are never received or stored by this application.

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

Provider credentials use AES-256-GCM. Back up this key securely. Changing it without re-encrypting existing values forces bank and brokerage reconnection.

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

Provider endpoints:

- `POST /api/banks/simplefin/connect` claims a one-time setup token server-side
- `POST /api/banks/sync` and `POST /api/banks/sync/:id`
- `POST /api/brokerage/snaptrade/connect` returns only a short-lived portal URL
- `POST /api/brokerage/snaptrade/finalize` imports the authenticated user's connections
- `POST /api/brokerage/sync` and `POST /api/brokerage/sync/:id`

Connection and sync routes scope every database operation by the authenticated user ID. Provider credentials and access URLs are never serialized to the frontend.

## Testing

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run alerts:evaluate
```

## Deployment Checklist

1. Open the Vercel project and confirm the Production environment variables are complete.
2. Keep `ENABLE_PLAID_FEATURES=false`; SimpleFIN and SnapTrade do not need deployment API keys.
3. Confirm the connected Neon `DATABASE_URL` is available during Vercel builds.
4. Use a URL-encoded PostgreSQL password in `DATABASE_URL`.
5. Set a real `NEXT_PUBLIC_APP_URL`.
6. Configure Clerk Production keys and DNS.
7. Set permanent `TOKEN_ENCRYPTION_KEY` and `ALERTS_EVALUATION_SECRET` values.
8. Configure and verify Resend sender domain if email is enabled.
9. Deploy. Vercel runs `npm run vercel-build`, which applies checked-in Prisma migrations before the Next.js build.
10. Sign in as an approved user and configure SimpleFIN and SnapTrade from Banks and Stocks.

Rebuild after changing any `NEXT_PUBLIC_*` value because Next.js embeds those values in client bundles.
Production uploads use the configured private Vercel Blob store; do not use local `UPLOAD_DIR` storage on Vercel.

## Security Checklist

- `ALLOW_DEV_AUTH_BYPASS=false` in production
- Real Clerk `pk_live_` and `sk_live_` keys configured
- SimpleFIN and SnapTrade provider credentials encrypted per user; bank/brokerage passwords never stored
- Permanent 32-byte token encryption key stored in a secret manager
- Long random evaluation secret stored server-side only
- PostgreSQL password URL-encoded in `DATABASE_URL`
- Every portfolio and alert query scoped by authenticated `user_id`
- Verified email plus local owner approval required before any portfolio page or API
- `OWNER_EMAILS` contains at least one verified production owner
- Last owner cannot be demoted, rejected, or suspended
- Clerk webhook signatures verified with `CLERK_WEBHOOK_SECRET`
- Alert evaluation endpoint excluded from Clerk only because bearer-secret authentication is mandatory
- Resend, Clerk, database, provider, and encryption secrets never use `NEXT_PUBLIC_`
- HTTPS enabled through the hosting platform
- Database backups and encryption-key backups configured
- Upload storage private and not served as a public directory
- Tests and production build pass before deployment

## Database Models

Portfolio models include users, minerals, real estate, jewelry, files, settings, metal prices, encrypted provider credentials, bank/brokerage connections and accounts, holdings, transactions, and sync logs.

Alert models:

- `alert_rules`
- `alert_events`
- `notification_preferences`
- `alert_delivery_logs`
- `market_index_price_cache`
