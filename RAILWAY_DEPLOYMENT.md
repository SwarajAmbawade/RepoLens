# RepoLens Railway Deployment Prep

This checkpoint keeps the existing React + Express architecture.

## Local development

Without `DATABASE_URL`, RepoLens continues to use `data/repolens.json` so local development stays simple.

```bash
npm install
npm run build
npm run dev
```

## Production on Railway

When `DATABASE_URL` is present, RepoLens uses PostgreSQL for users, pinned repositories, history, and notifications. The server creates the required tables automatically on startup.

Railway setup:

1. Push this project to GitHub.
2. Create a Railway project from that GitHub repository.
3. Add a PostgreSQL service to the same Railway project.
4. On the RepoLens service, set `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` (adjust `Postgres` if you rename the database service).
5. Add the required secrets from `.env.example` as Railway Variables.
6. Set `APP_BASE_URL` to the final HTTPS Railway domain.
7. Set `GITHUB_CALLBACK_URL` to `${APP_BASE_URL}/auth/github/callback` using the actual URL value.
8. Use `npm run build` as the build command if Railway does not detect it automatically.
9. Use `npm start` as the start command.
10. Generate a Railway public domain and check `/api/health`.
11. Update the GitHub OAuth App Homepage URL and Redirect URI to the production URL.
12. Test GitHub sign-in, pinning, history, logout/login, and a repository analysis.

The production Express server serves the built Vite `dist` folder, so frontend and API share one origin. The browser automatically uses the current origin in production; `VITE_API_BASE_URL` is only needed when frontend and API are separate during development.

## Important

This checkpoint intentionally does not include a committed `package-lock.json` because the production database adapter adds the `pg` dependency. Run `npm install` once locally; this generates the lockfile. Review it, commit it, and then push the project to GitHub. After that, future deployments can use the committed lockfile reliably.
