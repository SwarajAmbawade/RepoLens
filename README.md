# RepoLens v0.9.1 — V13 Final Student Demo (Corrected)

V13 adds per-repository pinning from analysis pages, private signed-in search history, individual history deletion, and clear-all history. The corrected V13 checkpoint also sends session cookies with repository-analysis requests and refreshes authentication when returning to the app through browser history, fixing history recording and false signed-out states. It also adds basic production hardening: security headers, request-size limits, lightweight API rate limiting, server-side repository validation, production environment checks, and production webhook-secret enforcement.

This is a student project/demo. GitHub handles authentication; RepoLens does not handle GitHub passwords. Public repositories can be analyzed without signing in. Search history is only recorded for signed-in users after a successful analysis. One row is kept per repository and its last-visited time is updated.

For a student deployment, the JSON store is suitable for a single persistent server/demo. If your hosting platform uses an ephemeral filesystem, use its persistent disk or move the store to a database before relying on user data across redeploys.

# RepoLens V0.8.0 — Performance & UI Polish

RepoLens now has the beginning of the actual SaaS layer.


## V12 changes

- Repository analysis now starts independent GitHub requests in parallel.
- Weekly/monthly/yearly commit data uses the lighter participation endpoint instead of waiting on commit_activity generation.
- In-flight repository requests are deduplicated and cached for five minutes.
- Recent contributors show their latest observed commit date without additional per-contributor API calls.
- Repository snapshot uses plain-language facts instead of opaque 0–100 signal scores.
- Landing-page feature cards animate into view with staggered timing.
- Navbar brand now returns to the home screen; redundant API/project links were removed.
- Footer includes the author's GitHub, optional portfolio URL, source link, and build year.

## Architecture

```text
Browser
  │
  ├── Public repository analysis
  │       ↓
  │   RepoLens API
  │       ↓
  │   GitHub API
  │
  └── GitHub sign-in
          ↓
      RepoLens API
          ↓
      User session
          ↓
      Workspace
          ↓
      Pinned repositories
          ↓
      Monitoring / notifications
```

## Repository statistics compatibility

RepoLens handles GitHub repository statistics edge cases explicitly:

- `202 Accepted`: retries while GitHub computes the statistics.
- `204 No Content`: treats the statistics as unavailable instead of crashing.
- `422 Validation Failed`: GitHub uses this for `commit_activity` on repositories with 10,000+ commits, so RepoLens falls back to `stats/participation`.
- Temporary statistics failures: falls back to recent commit timestamps so a repository can still be analyzed.

GitHub documents the 10,000-commit limitation and the `participation` endpoint in its repository statistics API documentation.

## What V6 implements

### GitHub sign-in foundation

The server has the GitHub OAuth web flow:

1. User clicks **Sign in with GitHub**
2. RepoLens generates an OAuth state value
3. GitHub authorizes the user
4. GitHub redirects to the callback
5. RepoLens verifies the state
6. RepoLens fetches the GitHub profile
7. RepoLens creates/updates a local user
8. RepoLens issues an HttpOnly session cookie

GitHub documents the web authorization-code flow for this use case. For production monitoring, GitHub's documentation recommends considering a GitHub App because Apps provide finer-grained permissions and are better suited to automation.

### User workspace

Signed-in users can:

- see their GitHub identity
- open their workspace
- pin public repositories
- remove pinned repositories
- analyze a pinned repository
- see the notification area

### Monitoring foundation

The server has:

```text
POST /webhooks/github
```

with HMAC signature verification when `GITHUB_WEBHOOK_SECRET` is configured.

The endpoint is deliberately not pretending to be a finished monitoring system yet.

## Why the monitoring implementation is not "poll every repository"

For a SaaS product, repeatedly polling every monitored repository does not scale well.

GitHub webhooks deliver event payloads to a server when subscribed events happen. The intended production architecture is:

```text
GitHub App
    ↓
Webhook
    ↓
RepoLens event processor
    ↓
Database
    ↓
Notification service
    ↓
In-app / email / Slack / Discord
```

GitHub repository webhooks require appropriate repository ownership/admin permissions. A GitHub App is therefore the right production direction for repository monitoring.

## Local setup

Install (this also refreshes the lockfile for the new SaaS dependencies):

```bash
npm install
```

Create `.env`:

```env
PORT=8787
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:8787

GITHUB_TOKEN=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8787/auth/github/callback

SESSION_SECRET=replace-with-a-long-random-secret
DATA_FILE=./data/repolens.json
```

Then:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

API:

```text
http://localhost:8787
```

## GitHub OAuth setup

Create a GitHub OAuth App in GitHub Developer Settings.

Use:

```text
Application URL:
http://localhost:5173

Authorization callback URL:
http://localhost:8787/auth/github/callback
```

Put its client ID and client secret in `.env`.

Do not commit `.env`.

The V6 login requests `read:user` and does not request the broad `repo` scope.

## Important V6 limitation

The local JSON store is intentionally a development-only persistence layer:

```text
data/repolens.json
```

It keeps the project easy to understand and run.

Before production, replace it with a real database and encrypted credential/token storage.

The GitHub OAuth access token is intentionally NOT stored in this JSON store.

## Next production steps

1. GitHub App registration
2. App installation flow
3. Installation/repository permission mapping
4. Real database
5. Encrypted token storage
6. Webhook event processor
7. Notification preferences
8. Background jobs / retry queue
9. In-app notification center
10. Email/Slack/Discord delivery
11. Team/workspace roles
12. Billing/plan limits

## V0.6.1 completion fixes

- Repository analytics keeps the direct `GET /repos/{owner}/{repo}` lookup.
- GitHub API status codes are now preserved instead of converting every failure into `502`.
- GitHub rate-limit headers are returned by the API error path.
- GitHub analytics no longer silently turns commit/contributor failures into empty data.
- Added `/api/github/status` for local authentication/rate-limit diagnostics without exposing the token.
- Search/API failures are surfaced as actual GitHub errors rather than being labelled "Repository not found".


### GitHub repository statistics

GitHub computes some repository statistics asynchronously. RepoLens now retries `stats/commit_activity` when GitHub returns HTTP 202 and falls back to `stats/participation` if the statistics job is still pending, so a repository analysis does not fail with `weeks is not iterable`.

## V0.7.0 — Cached activity architecture

The activity dashboard no longer treats Daily / Weekly / Monthly / Yearly as four separate GitHub API queries. RepoLens fetches a bounded raw activity dataset once, caches it per repository for 5 minutes, and derives all four chart views locally.

### What changed

- No GitHub request when the user toggles Daily / Weekly / Monthly / Yearly.
- Repository metadata, languages, contributors, commit statistics, recent commits, and issue/PR history are cached together.
- `stats/commit_activity` is retried for GitHub's asynchronous `202` response and falls back to `stats/participation` for the documented `422` large-repository case.
- PR and issue activity no longer uses GitHub Search API. RepoLens uses the repository Issues endpoint and identifies pull requests through GitHub's `pull_request` field.
- Issue/PR history is bounded to the last 365 days and at most 1,000 records per refresh. If that bound is reached, the API reports `issueHistoryTruncated: true` instead of pretending the history is complete.
- A small request gap is used while paging issue history to avoid creating a request burst.
- The frontend switches activity ranges entirely in memory after the first analysis.

### Data flow

```text
First repository analysis
        ↓
GitHub
  ├─ repository metadata
  ├─ languages
  ├─ contributors
  ├─ weekly commit statistics
  ├─ recent commits
  └─ issues + pull requests
        ↓
RepoLens repository cache (5 min)
        ↓
Raw activity dataset
        ↓
Daily / Weekly / Monthly / Yearly
        ↓
Frontend toggles locally — no GitHub request
```

The yearly chart is intentionally marked as limited because GitHub's repository statistics endpoint provides about 52 weeks of commit history. RepoLens does not invent older history.

For the step-by-step GitHub OAuth setup, see [`GITHUB_OAUTH_SETUP.md`](./GITHUB_OAUTH_SETUP.md).

## Railway deployment

RepoLens keeps the local JSON store for easy development, but uses PostgreSQL when `DATABASE_URL` is present. Railway can provision PostgreSQL and expose `DATABASE_URL` to the app.

For production on Railway:

1. Deploy the repository as a Node/Express service.
2. Add a PostgreSQL service to the same Railway project.
3. Set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the RepoLens service.
4. Set the GitHub OAuth and server secrets from `.env.example` as Railway Variables.
5. Set `APP_BASE_URL` to the final Railway HTTPS domain.
6. Set `GITHUB_CALLBACK_URL` to `<APP_BASE_URL>/auth/github/callback`.
7. Generate the Railway public domain and test `/api/health` before testing GitHub OAuth.

The production service serves the Vite `dist` output from Express, so the browser and API share one origin. The frontend automatically uses the current origin in production; `VITE_API_BASE_URL` is only needed when running the frontend and API on separate origins during development.
