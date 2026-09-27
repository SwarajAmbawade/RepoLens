import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE = "repolens_session";
const STATE_COOKIE = "repolens_oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function secret() {
  return process.env.SESSION_SECRET || "dev-only-change-this-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionCookie(userId: string) {
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionCookie(value?: string) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAtRaw, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!userId || !Number.isFinite(issuedAt) || !signature) return null;
  if (Date.now() - issuedAt < 0 || Date.now() - issuedAt > SESSION_TTL_MS) return null;
  const expected = sign(`${userId}.${issuedAtRaw}`);
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actual.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(actual, expectedBuffer)) return null;
  return userId;
}

export function setSession(res: Response, userId: string) {
  res.cookie(COOKIE, createSessionCookie(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/"
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
}

export function setOAuthState(res: Response, state: string) {
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
    path: "/"
  });
}

export function consumeOAuthState(req: Request, res: Response) {
  const state = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
  return state;
}

export function getSessionUserId(req: Request) {
  return verifySessionCookie(req.cookies?.[COOKIE]);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Sign in with GitHub to use this workspace." });
  (req as any).userId = userId;
  next();
}
