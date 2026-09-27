# RepoLens — GitHub Sign-In Setup

RepoLens uses a GitHub OAuth App for the student-project login flow.

## What you need to do

1. Open GitHub and go to **Settings → Developer settings → OAuth Apps**.
2. Click **New OAuth App**.
3. Use these local-development values:

   - **Application name:** `RepoLens`
   - **Homepage URL:** `http://localhost:5173`
   - **Application description:** `Student-built GitHub repository intelligence project.`
   - **Authorization callback URL:** `http://localhost:8787/auth/github/callback`

4. Register the application.
5. Copy the **Client ID** into your local `.env`:

   `GITHUB_CLIENT_ID=...`

6. Generate/copy the **Client Secret** into your local `.env`:

   `GITHUB_CLIENT_SECRET=...`

7. Make sure `.env` also has a strong local `SESSION_SECRET`.
8. Restart RepoLens with `npm run dev`.
9. Click **Sign in with GitHub** → **Continue with GitHub**.

## Important

- Do **not** paste the Client Secret into chat, GitHub, screenshots, or your repository.
- `.env` is already listed in `.gitignore`.
- The OAuth flow requests only `read:user`.
- RepoLens uses the OAuth access token during the callback to read the GitHub profile, then does not persist that token in the current local JSON store.
- `GITHUB_TOKEN` is a separate server-side token used by RepoLens for repository analysis. It is **not** your OAuth Client Secret and it is not the user's GitHub login token.

## Local URLs

Frontend: `http://localhost:5173`

API: `http://localhost:8787`

OAuth callback: `http://localhost:8787/auth/github/callback`

## Before deployment

Replace the localhost homepage/callback values with the real HTTPS URLs and register the matching callback URL in GitHub. Never expose the Client Secret in frontend code.
