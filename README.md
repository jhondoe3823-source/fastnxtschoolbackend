# FastNxt — Backend API

Express + Prisma (PostgreSQL) API for the FastNxt school management system.

This service currently implements the **authentication, school registration,
subscription and institute-profile foundation** only:

- Register a school together with its first administrator
- Sign in / sign out with an httpOnly session cookie (Bearer supported too)
- Restore the session on page refresh via `GET /api/auth/me`
- Read and edit the institution profile (the data captured at registration plus
  the optional branding/contact details) via `/api/school/profile`
- A 5-day free trial that expires automatically, reported as `TRIAL`, `ACTIVE`
  or `EXPIRED`

Email verification / OTP, teacher & student registration, and payments are
intentionally out of scope for now.

## Requirements

- Node.js 20+
- A PostgreSQL database (this project targets Neon; any Postgres works)

## Getting started

```bash
npm install

# Configure the database + secrets
cp .env.example .env

# Create the tables
npx prisma migrate dev --name auth_foundation

# Optional: create a demo school + admin
npm run seed

npm run dev      # or: npm start
```

The API listens on `http://localhost:5000` by default. Health check:

```bash
curl http://localhost:5000/api/health
```

## Environment

| Variable                   | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`             | Pooled Postgres URL used by the app at runtime                |
| `DIRECT_URL`               | Unpooled URL used by Prisma migrations (Neon requires this)   |
| `JWT_SECRET`               | Signing secret for session tokens (required in production)     |
| `JWT_EXPIRES_IN`           | Token lifetime, e.g. `30d`                                    |
| `CORS_ORIGINS`             | Comma-separated allowed browser origins (the Next.js app)     |
| `COOKIE_NAME`              | Session cookie name (`bisons_session`)                        |
| `COOKIE_DOMAIN`            | Parent domain for cross-subdomain cookies (empty on localhost) |
| `COOKIE_SECURE`            | `true` in production (HTTPS only)                             |
| `TRIAL_DAYS`               | Length of the free trial (default `5`)                        |
| `PORT` / `HOST` / `NODE_ENV` | Standard server settings                                    |

### Deploying against Neon

Set both connection strings — the app uses the pooled one, migrations use the
direct one:

```env
DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require&pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://…/neondb?sslmode=require&connection_limit=1"
```

Then apply the schema:

```bash
npx prisma migrate deploy
```

## API

All responses share one envelope:

```jsonc
// success
{ "success": true,  "message": "…", "data": { … } }
// failure
{ "success": false, "message": "…", "errors": ["…"], "code": "…" }
```

| Method | Endpoint             | Auth | Description                          |
| ------ | -------------------- | ---- | ------------------------------------ |
| GET    | `/api/health`        | –    | Liveness + database check            |
| POST   | `/api/auth/register` | –    | Create school + admin + trial        |
| POST   | `/api/auth/login`    | –    | Sign in, sets the session cookie     |
| GET    | `/api/auth/me`       | ✔    | Current user, school and subscription |
| POST   | `/api/auth/logout`   | –    | Clears the session cookie            |

### Register

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "schoolName": "Green Valley School",
    "name": "Ayesha Khan",
    "email": "admin@greenvalley.test",
    "password": "Password123",
    "phone": "+92 300 1234567",
    "country": "Pakistan",
    "city": "Karachi"
  }'
```

`schoolName`, `name`, `email` and `password` (min 8 chars) are required;
`ownerName`, `phone`, `country` and `city` are optional.

### Subscription shape

```jsonc
"subscription": {
  "id": "…",
  "plan": "TRIAL",           // TRIAL | MONTHLY | YEARLY
  "status": "TRIAL",         // TRIAL | ACTIVE | EXPIRED
  "active": true,
  "isTrial": true,
  "isExpired": false,
  "needsAttention": false,   // ≤ SUBSCRIPTION_WARNING_DAYS left
  "daysRemaining": 5,
  "trialDaysRemaining": 5,
  "startedAt": "2026-10-03T09:00:00.000Z",
  "expiresAt": "2026-10-08T09:00:00.000Z"
}
```

Status is **derived** on every read, so a trial that lapses overnight is
reported as `EXPIRED` without a cron job; the stored row is corrected the next
time the school signs in or loads `/me`.

## Project layout

```
prisma/
  schema.prisma          School, User, Subscription
  seed.js                demo data
src/
  app.js                 Express app (no listen)
  server.js              bootstrap + graceful shutdown
  config/                env, prisma client, cors, mailer, cloudinary
  constants/             roles, subscription vocabulary, modules
  controllers/<module>/  HTTP layer
  services/<module>/     business logic + data access
  validators/<module>/   request rules
  routes/                one *.routes.js per module, aggregated in index.js
  middleware/            auth, role, validation, errors, rate-limit, …
  utils/                 response envelope, errors, logger, token, subscription
```

### Security notes

- Passwords are hashed with **bcrypt** (cost 10) and never returned by any endpoint.
- Login failures return one generic message so accounts cannot be enumerated.
- The session token lives in an **httpOnly** cookie; `Authorization: Bearer` is
  also accepted for non-browser clients.
- Credential endpoints are rate-limited in-process (`login`: 15 / 15 min,
  `register`: 10 / hour). Move the counter to Redis when running multiple
  instances.
- Emails are normalised to lowercase before writing, making the `@unique`
  constraint effectively case-insensitive.

