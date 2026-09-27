<div align="center">

# RepoLens

### 🔎 See beyond the repository.

**RepoLens is a GitHub repository intelligence platform that turns scattered repository data into one focused, visual overview.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-RepoLens-111111?style=for-the-badge&logo=railway&logoColor=F4C95D)](https://repolens-production-5ada.up.railway.app)
[![GitHub](https://img.shields.io/badge/Source-GitHub-111111?style=for-the-badge&logo=github&logoColor=white)](https://github.com/SwarajAmbawade/RepoLens)

</div>

---

## 🧭 What is RepoLens?

Understanding an unfamiliar GitHub repository usually means jumping between repository details, commits, contributors, issues, pull requests, languages, and activity graphs.

**RepoLens brings those signals together in one place.**

Enter a public repository:

```text
facebook/react
```

and RepoLens creates a structured overview of its:

- ⭐ Stars and forks
- 📝 Issues and pull requests
- 💻 Languages
- 👥 Contributors
- 🔨 Recent commits
- 📈 Development activity
- 📅 Daily / Weekly / Monthly / Yearly commit trends
- 📌 Personal pinned repositories
- 🕘 Private signed-in search history

The idea is simple:

> **Understand a repository before diving into the code.**

---

## ✨ Features

### 🔍 Repository Analysis

Public repositories can be analyzed without signing in.

RepoLens collects repository information through the GitHub API and presents it through a single dashboard.

### 📊 Development Activity

Explore repository activity through:

**Daily · Weekly · Monthly · Yearly**

The activity data is fetched efficiently and the different views are derived locally instead of triggering a new GitHub request every time the range changes.

### 👥 Contributor Explorer

Explore repository contributors through focused views:

- **Top**
- **Recent**
- **Most active**
- **New**
- **Bots**

### 📌 Personal Workspace

GitHub sign-in unlocks the personal workspace.

Signed-in users can:

- Pin repositories
- Unpin repositories
- View analyzed repository history
- Delete individual history entries
- Clear all history
- Revisit previously analyzed repositories

Repeated analysis of the same repository updates its existing history entry instead of creating duplicates.

### 🔐 GitHub Authentication

RepoLens uses GitHub OAuth for authentication.

The flow is:

```text
User
  ↓
GitHub OAuth
  ↓
Authorization callback
  ↓
OAuth state verification
  ↓
GitHub profile
  ↓
RepoLens user
  ↓
HttpOnly session
```

RepoLens does **not** handle GitHub passwords.

The current OAuth flow requests the `read:user` scope required for the workspace.

---

## ⚡ GitHub API Efficiency

GitHub API usage was treated as a core architectural concern.

RepoLens includes:

- Parallel independent GitHub requests
- Five-minute repository caching
- In-flight request deduplication
- Local activity-range derivation
- Bounded issue / pull-request history
- Repository statistics fallbacks
- Lightweight API rate limiting

### Repository statistics handling

GitHub repository statistics can be asynchronous or unavailable for certain repositories.

RepoLens explicitly handles cases including:

```text
202 Accepted
204 No Content
422 Validation Failed
```

For repositories where `commit_activity` cannot be used, RepoLens can fall back to participation statistics rather than breaking the complete repository analysis.

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │       Browser        │
                         │   React + Vite       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Express Server     │
                         │   API + OAuth        │
                         └─────────┬────┬────────┘
                                   │    │
                    ┌──────────────┘    └──────────────┐
                    ▼                                  ▼
          ┌───────────────────┐              ┌───────────────────┐
          │     GitHub API    │              │    PostgreSQL     │
          │                   │              │                   │
          │ Repo data         │              │ Users             │
          │ Activity          │              │ Pins              │
          │ Contributors      │              │ History           │
          │ Issues / PRs      │              │ Workspace data    │
          └───────────────────┘              └───────────────────┘
```

### Production

```text
GitHub Repository
       │
       ▼
    Railway
       │
       ├── RepoLens
       │     ├── React production build
       │     ├── Express API
       │     └── GitHub OAuth
       │
       └── PostgreSQL
```

The production Express server serves the Vite `dist` output, so the frontend and API share a single origin.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Local persistence | JSON store |
| Authentication | GitHub OAuth |
| Sessions | HttpOnly session cookies |
| External API | GitHub REST API |
| Deployment | Railway |
| Production database | Railway PostgreSQL |

---

## 🔒 Security & Hardening

RepoLens includes practical production hardening appropriate for the current student deployment:

- Security headers
- JSON request-size limits
- Lightweight API rate limiting
- Server-side repository validation
- Production environment validation
- OAuth state verification
- HttpOnly session cookies
- Production webhook-secret enforcement
- Secrets stored through environment variables
- GitHub passwords never handled by RepoLens
- GitHub OAuth access tokens not stored in the local JSON database

**Never commit `.env` or any secret credentials to the repository.**

---

## 🧪 Local Development

### 1. Clone

```bash
git clone https://github.com/SwarajAmbawade/RepoLens.git
cd RepoLens
```

### 2. Install

```bash
npm install
```

### 3. Configure environment variables

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

### 4. Start

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8787
```

---

## 🔑 GitHub OAuth Setup

Create a GitHub OAuth App from GitHub Developer Settings.

For local development:

```text
Application URL:
http://localhost:5173

Authorization callback URL:
http://localhost:8787/auth/github/callback
```

For production, use:

```text
https://YOUR-RAILWAY-DOMAIN/auth/github/callback
```

Keep the GitHub client secret and other credentials inside environment variables.

For the project's OAuth setup details, see:

[`GITHUB_OAUTH_SETUP.md`](./GITHUB_OAUTH_SETUP.md)

---

## ☁️ Deployment

RepoLens is deployed using **Railway**.

Production uses PostgreSQL when `DATABASE_URL` is available.

The production service requires the appropriate:

- GitHub OAuth credentials
- Session secret
- Application URL
- OAuth callback URL
- PostgreSQL connection string
- GitHub API token

The deployed application uses one origin for both the React frontend and Express API.

Deployment notes:

[`RAILWAY_DEPLOYMENT.md`](./RAILWAY_DEPLOYMENT.md)

---

## 📁 Project Structure

```text
RepoLens/
│
├── src/                    # React frontend
├── server/                 # Express backend
├── public/                 # Static assets
├── data/                   # Local development data
│
├── .env.example            # Environment variable reference
├── GITHUB_OAUTH_SETUP.md   # GitHub OAuth setup
├── RAILWAY_DEPLOYMENT.md   # Railway deployment notes
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🎯 Project Goal

RepoLens was built around one practical question:

> **Can a developer understand the current state of a GitHub repository faster without manually opening multiple GitHub pages?**

The project focuses on combining repository data into a useful interface while keeping the architecture understandable enough to build, debug, deploy, and maintain as a student project.

---

## 🔮 Future Direction

The current release is intentionally scoped as a completed student project.

If RepoLens is expanded in the future, possible directions include:

- GitHub App based repository monitoring
- Event-driven webhook processing
- Background jobs and retry queues
- Advanced repository comparisons
- Team workspaces
- More notification integrations
- Deeper repository health analysis

These are future possibilities, not requirements for the current release.

---

## 📌 Project Status

**Completed · Deployed · Working**

RepoLens currently includes:

- Public repository analysis
- GitHub API integration
- Activity analytics
- Contributor exploration
- GitHub OAuth
- Personal workspace
- Repository pinning
- Private search history
- PostgreSQL persistence
- Production hardening
- Railway deployment

---

## 👨‍💻 Author

**Swaraj Ambawade**

[GitHub](https://github.com/SwarajAmbawade)

---

<div align="center">

### Built with React · TypeScript · Node.js · Express · PostgreSQL · GitHub API

**RepoLens — See beyond the repository.**

</div>
