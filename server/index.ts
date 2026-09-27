import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchRepoAnalysis, GitHubApiError } from "./github.js";
import {
  clearSession, consumeOAuthState, getSessionUserId, requireAuth, setOAuthState, setSession
} from "./auth.js";
import { exchangeCode, githubAuthorizeUrl, githubOAuthConfigured, githubUser } from "./githubAuth.js";
import {
  clearHistory, createMonitor, createNotification, deleteHistoryItem, deleteMonitor, getUser,
  listHistory, listMonitors, listNotifications, markNotificationRead, recordHistory, setMonitorLastEvent, upsertUser, initializeStore, closeStore
} from "./store.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT_NAME);
const PORT = Number(process.env.PORT || 8787);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

if (isProduction) {
  const required = ["SESSION_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_CALLBACK_URL", "APP_BASE_URL", "GITHUB_TOKEN", "DATABASE_URL"];
  const missing = required.filter(key => !process.env[key]?.trim());
  const insecureSecret = ["replace-with-a-long-random-secret", "dev-only-change-this-secret"].includes(process.env.SESSION_SECRET?.trim() || "");
  const insecureUrl = /^http:\/\/localhost(?::\d+)?$/i.test(process.env.APP_BASE_URL?.trim() || "");
  const insecureCallback = /^http:\/\/localhost(?::\d+)?\//i.test(process.env.GITHUB_CALLBACK_URL?.trim() || "");
  if (missing.length || insecureSecret || insecureUrl || insecureCallback) {
    const problems = [...missing];
    if (insecureSecret) problems.push("SESSION_SECRET must not use the development placeholder");
    if (insecureUrl) problems.push("APP_BASE_URL must use the deployed HTTPS origin");
    if (insecureCallback) problems.push("GITHUB_CALLBACK_URL must use the deployed HTTPS callback");
    throw new Error(`Invalid production environment: ${problems.join("; ")}`);
  }
}

app.disable("x-powered-by");
app.set("trust proxy", isProduction ? 1 : 0);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(cors({ origin: APP_BASE_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({
  limit: "50kb",
  verify: (req: any, _res, buf) => { req.rawBody = buf; }
}));

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();
function rateLimit(windowMs: number, max: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip}:${max}`;
    const now = Date.now();
    const current = rateBuckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil((bucket.resetAt - now) / 1000));
    if (bucket.count > max) return res.status(429).json({ error: "Too many requests. Please wait and try again." });
    next();
  };
}

const oauthLimiter = rateLimit(15 * 60 * 1000, 20);
const mutationLimiter = rateLimit(15 * 60 * 1000, 60);
const repoLimiter = rateLimit(15 * 60 * 1000, 60);

app.get("/", (_req, res) => res.json({
  service: "RepoLens API",
  version: "0.9.0",
  status: "ok",
  endpoints: ["/api/health", "/auth/github", "/api/me", "/api/monitors", "/api/notifications"]
}));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "repolens-api", version: "0.9.0" }));

app.get("/api/github/status", async (_req, res) => {
  if (isProduction) return res.status(404).json({ error: "Not found." });
  const token = process.env.GITHUB_TOKEN?.trim();
  const configured = Boolean(token && !["your_actual_token", "your_token_here", "YOUR_TOKEN", "your-github-token"].includes(token));
  if (!configured) return res.json({ configured: false, authenticated: false });

  try {
    const response = await fetch("https://api.github.com/rate_limit", {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ configured: true, authenticated: false, error: body?.message || "GitHub authentication failed." });
    const core = body?.resources?.core;
    res.json({ configured: true, authenticated: true, rateLimit: core ? { limit: core.limit, remaining: core.remaining, reset: core.reset } : null });
  } catch {
    res.status(502).json({ configured: true, authenticated: false, error: "Could not reach GitHub." });
  }
});

// ---------------- Auth ----------------

app.get("/auth/github", oauthLimiter, (_req, res) => {
  if (!githubOAuthConfigured()) {
    return res.redirect(`${APP_BASE_URL}/?auth_error=${encodeURIComponent("GitHub OAuth is not configured yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env.")}`);
  }

  const state = crypto.randomBytes(24).toString("hex");
  setOAuthState(res, state);
  res.redirect(githubAuthorizeUrl(state));
});

app.get("/auth/github/callback", oauthLimiter, async (req, res) => {
  try {
    const returnedState = typeof req.query.state === "string" ? req.query.state : "";
    const expectedState = consumeOAuthState(req, res);
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      return res.redirect(`${APP_BASE_URL}/?auth_error=${encodeURIComponent("GitHub sign-in could not be verified. Please try again.")}`);
    }

    const oauthError = typeof req.query.error === "string" ? req.query.error : "";
    if (oauthError) {
      const description = typeof req.query.error_description === "string" ? req.query.error_description : "GitHub authorization was cancelled.";
      return res.redirect(`${APP_BASE_URL}/?auth_error=${encodeURIComponent(description)}`);
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      return res.redirect(`${APP_BASE_URL}/?auth_error=${encodeURIComponent("GitHub did not return an authorization code.")}`);
    }

    const token = await exchangeCode(code);
    if (!token.access_token) throw new Error(token.error || "GitHub did not return an access token.");

    const profile = await githubUser(token.access_token);
    const user = await upsertUser({
      githubId: profile.id,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      htmlUrl: profile.html_url
    });

    // V6 intentionally does not persist the GitHub access token in the local JSON store.
    // The next security pass will use a proper encrypted token store / GitHub App installation.
    setSession(res, user.id);
    res.redirect(`${APP_BASE_URL}/?signed_in=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub sign-in failed.";
    res.redirect(`${APP_BASE_URL}/?auth_error=${encodeURIComponent(message)}`);
  }
});

app.post("/auth/logout", mutationLimiter, (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await getUser((req as any).userId);
  if (!user) return res.status(401).json({ error: "Session expired." });
  res.json({ user });
});

// ---------------- Workspace / monitors ----------------

app.get("/api/monitors", requireAuth, async (req, res) => {
  res.json({ monitors: await listMonitors((req as any).userId) });
});

app.post("/api/monitors", mutationLimiter, requireAuth, async (req, res) => {
  const { owner, repo, htmlUrl, events } = req.body || {};
  const validPart = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value);
  if (!validPart(owner) || !validPart(repo)) return res.status(400).json({ error: "Invalid repository owner or name." });

  const monitor = await createMonitor({
    userId: (req as any).userId,
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    htmlUrl: htmlUrl || `https://github.com/${owner}/${repo}`,
    enabled: true,
    events: Array.isArray(events) && events.length ? events : ["push", "pull_request"]
  });

  res.status(201).json({ monitor });
});

app.delete("/api/monitors/:id", mutationLimiter, requireAuth, async (req, res) => {
  const removed = await deleteMonitor((req as any).userId, req.params.id);
  res.json({ ok: removed });
});

// ---------------- Notifications ----------------

app.get("/api/notifications", requireAuth, async (req, res) => {
  res.json({ notifications: await listNotifications((req as any).userId) });
});

app.post("/api/notifications/:id/read", mutationLimiter, requireAuth, async (req, res) => {
  const item = await markNotificationRead((req as any).userId, req.params.id);
  if (!item) return res.status(404).json({ error: "Notification not found." });
  res.json({ notification: item });
});

// ---------------- Webhook foundation ----------------

function verifyWebhook(req: any) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return !isProduction;
  const signature = req.header("x-hub-signature-256") || "";
  const digest = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("hex");
  if (signature.length !== digest.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

app.post("/webhooks/github", (req: any, res) => {
  if (!verifyWebhook(req)) return res.status(401).json({ error: "Invalid webhook signature." });

  const event = req.header("x-github-event") || "unknown";
  const payload = req.body || {};
  const fullName = payload.repository?.full_name;
  if (!fullName) return res.status(202).json({ ok: true, ignored: true });

  // V6 stores events only when the repository is being monitored by a user.
  // A production GitHub App implementation will map installations -> repositories -> users.
  // For now, the webhook route is ready and safely verifies signatures.
  res.status(202).json({ ok: true, event, repository: fullName });
});

// ---------------- Search history ----------------

app.get("/api/history", requireAuth, async (req, res) => {
  res.json({ history: await listHistory((req as any).userId) });
});

app.delete("/api/history", mutationLimiter, requireAuth, async (req, res) => {
  const deleted = await clearHistory((req as any).userId);
  res.json({ ok: true, deleted });
});

app.delete("/api/history/:id", mutationLimiter, requireAuth, async (req, res) => {
  const removed = await deleteHistoryItem((req as any).userId, req.params.id);
  if (!removed) return res.status(404).json({ error: "History item not found." });
  res.json({ ok: true });
});

// ---------------- Analytics ----------------

app.get("/api/repos/:owner/:repo", repoLimiter, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const validPart = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value);
    if (!validPart(owner) || !validPart(repo)) return res.status(400).json({ error: "Invalid repository owner or name." });
    const range = typeof req.query.range === "string" ? req.query.range : "monthly";
    if (!["daily", "weekly", "monthly", "yearly"].includes(range)) {
      return res.status(400).json({ error: "Invalid activity range." });
    }
    const result = await fetchRepoAnalysis(owner, repo, range as any);
    const userId = getSessionUserId(req);
    if (userId) {
      await recordHistory({
        userId, owner: result.repository.owner.login, repo: result.repository.name,
        fullName: result.repository.full_name, htmlUrl: result.repository.html_url
      });
    }
    res.json(result);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      const payload: Record<string, unknown> = { error: error.message };
      if (error.rateLimitRemaining !== undefined) payload.rateLimitRemaining = Number(error.rateLimitRemaining);
      if (error.rateLimitReset !== undefined) payload.rateLimitReset = Number(error.rateLimitReset);
      return res.status(error.status).json(payload);
    }

    const message = error instanceof Error ? error.message : "GitHub request failed.";
    res.status(502).json({ error: message });
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { index: "index.html" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/auth/") || req.path.startsWith("/webhooks/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function start() {
  await initializeStore();
  const server = app.listen(PORT, () => console.log(`RepoLens running on port ${PORT}`));
  const shutdown = async () => {
    server.close(async () => { await closeStore(); process.exit(0); });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

start().catch(error => {
  console.error("RepoLens failed to start:", error);
  process.exit(1);
});
