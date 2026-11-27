# Google Meet / Online Classes setup

## Environment variables (backend)

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/online-classes/google/callback
# Optional (64 hex chars). Defaults to SHA-256(JWT_SECRET).
TOKEN_ENCRYPTION_KEY=
APP_URL=http://localhost:3000
```

Production redirect example:

```bash
GOOGLE_REDIRECT_URI=https://YOUR_API_HOST/api/online-classes/google/callback
APP_URL=https://app.school.fastnxt.com
```

## Google Cloud Console

1. Create (or select) a Google Cloud project.
2. Enable **Google Meet API**.
3. Configure OAuth consent screen (External or Internal).
4. Add OAuth scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/meetings.space.created`
   - `https://www.googleapis.com/auth/meetings.space.readonly`
5. Create **OAuth 2.0 Client ID** (Web application).
6. Add Authorized redirect URI exactly matching `GOOGLE_REDIRECT_URI`.
7. Copy Client ID and Client Secret into backend `.env`.

## App routes

| Area | Path |
|------|------|
| Admin dashboard | `/online-classes` |
| Create | `/online-classes/new` |
| Settings | `/online-classes/settings` |
| Teacher | `/teacher/online-classes` |
| Student | `/student/online-classes` |
| OAuth callback | `GET /api/online-classes/google/callback` |

## API surface

- `GET /api/online-classes/dashboard`
- `GET/POST /api/online-classes`
- `GET/PATCH/DELETE /api/online-classes/:id`
- `POST /api/online-classes/:id/cancel`
- `POST /api/online-classes/:id/join`
- `POST /api/online-classes/:id/sync-attendance`
- `GET /api/online-classes/:id/sync-logs`
- `PATCH /api/online-classes/participants/:participantId`
- `GET /api/online-classes/google/status|connect`
- `DELETE /api/online-classes/google/disconnect`

## Known Google API limitations

- Creating a Meet **space** does not create a Calendar event or send Google invitations.
- Conference records / participants are available **after** at least one person has joined the meeting.
- Participant identity matching uses display name (and email-like display names). Google does not return your SIS student IDs.
- Unmatched participants remain **Pending Verification**; staff can correct manually. Manual marks are not overwritten by sync unless `force` is used.
- Workspace admin policies may restrict Meet API or OAuth for some accounts.
