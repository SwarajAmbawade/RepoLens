import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";

export interface UserRecord {
  id: string;
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorRecord {
  id: string;
  userId: string;
  owner: string;
  repo: string;
  fullName: string;
  htmlUrl: string;
  enabled: boolean;
  events: string[];
  createdAt: string;
  updatedAt: string;
  lastEventAt: string | null;
}

export interface HistoryRecord {
  id: string;
  userId: string;
  owner: string;
  repo: string;
  fullName: string;
  htmlUrl: string;
  visitedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  monitorId: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  read: boolean;
}

interface StoreData {
  users: UserRecord[];
  monitors: MonitorRecord[];
  history: HistoryRecord[];
  notifications: NotificationRecord[];
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 }) : null;
const file = path.resolve(process.env.DATA_FILE || "./data/repolens.json");

function empty(): StoreData {
  return { users: [], monitors: [], history: [], notifications: [] };
}

function readFile(): StoreData {
  try {
    if (!fs.existsSync(file)) return empty();
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      monitors: Array.isArray(parsed?.monitors) ? parsed.monitors : [],
      history: Array.isArray(parsed?.history) ? parsed.history : [],
      notifications: Array.isArray(parsed?.notifications) ? parsed.notifications : []
    };
  } catch {
    return empty();
  }
}

function writeFile(data: StoreData) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export async function initializeStore() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      github_id BIGINT NOT NULL UNIQUE,
      login TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT NOT NULL,
      html_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      full_name TEXT NOT NULL,
      html_url TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      last_event_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS monitors_user_full_name_idx
      ON monitors (user_id, LOWER(full_name));

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      full_name TEXT NOT NULL,
      html_url TEXT NOT NULL,
      visited_at TIMESTAMPTZ NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS history_user_full_name_idx
      ON history (user_id, LOWER(full_name));
    CREATE INDEX IF NOT EXISTS history_user_visited_idx
      ON history (user_id, visited_at DESC);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      monitor_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS notifications_user_created_idx
      ON notifications (user_id, created_at DESC);
  `);
}

export async function closeStore() {
  if (pool) await pool.end();
}

export async function upsertUser(input: Omit<UserRecord, "id" | "createdAt" | "updatedAt">) {
  if (!pool) {
    const data = readFile();
    const now = new Date().toISOString();
    const existing = data.users.find(u => u.githubId === input.githubId);
    if (existing) {
      Object.assign(existing, input, { updatedAt: now });
      writeFile(data);
      return existing;
    }
    const user: UserRecord = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    data.users.push(user);
    writeFile(data);
    return user;
  }

  const now = new Date().toISOString();
  const result = await pool.query<UserRecord>(
    `INSERT INTO users (id, github_id, login, name, avatar_url, html_url, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
     ON CONFLICT (github_id) DO UPDATE SET login=$3, name=$4, avatar_url=$5, html_url=$6, updated_at=$7
     RETURNING id, github_id::double precision AS "githubId", login, name, avatar_url AS "avatarUrl", html_url AS "htmlUrl", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [crypto.randomUUID(), input.githubId, input.login, input.name, input.avatarUrl, input.htmlUrl, now]
  );
  return result.rows[0];
}

export async function getUser(id: string) {
  if (!pool) return readFile().users.find(u => u.id === id) || null;
  const result = await pool.query<UserRecord>(
    `SELECT id, github_id::double precision AS "githubId", login, name, avatar_url AS "avatarUrl", html_url AS "htmlUrl", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE id=$1`, [id]
  );
  return result.rows[0] || null;
}

export async function getMonitorForUser(userId: string, monitorId: string) {
  if (!pool) return readFile().monitors.find(m => m.id === monitorId && m.userId === userId) || null;
  const result = await pool.query<MonitorRecord>(
    `SELECT id, user_id AS "userId", owner, repo, full_name AS "fullName", html_url AS "htmlUrl", enabled, events,
            created_at AS "createdAt", updated_at AS "updatedAt", last_event_at AS "lastEventAt"
     FROM monitors WHERE id=$1 AND user_id=$2`, [monitorId, userId]
  );
  return result.rows[0] || null;
}

export async function listMonitors(userId: string) {
  if (!pool) return readFile().monitors.filter(m => m.userId === userId).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  const result = await pool.query<MonitorRecord>(
    `SELECT id, user_id AS "userId", owner, repo, full_name AS "fullName", html_url AS "htmlUrl", enabled, events,
            created_at AS "createdAt", updated_at AS "updatedAt", last_event_at AS "lastEventAt"
     FROM monitors WHERE user_id=$1 ORDER BY updated_at DESC`, [userId]
  );
  return result.rows;
}

export async function createMonitor(input: Omit<MonitorRecord, "id" | "createdAt" | "updatedAt" | "lastEventAt">) {
  if (!pool) {
    const data = readFile();
    const existing = data.monitors.find(m => m.userId === input.userId && m.fullName.toLowerCase() === input.fullName.toLowerCase());
    if (existing) return existing;
    const now = new Date().toISOString();
    const monitor: MonitorRecord = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now, lastEventAt: null };
    data.monitors.push(monitor); writeFile(data); return monitor;
  }
  const now = new Date().toISOString();
  const result = await pool.query<MonitorRecord>(
    `INSERT INTO monitors (id,user_id,owner,repo,full_name,html_url,enabled,events,created_at,updated_at,last_event_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9,NULL)
     ON CONFLICT (user_id, LOWER(full_name)) DO UPDATE SET updated_at=EXCLUDED.updated_at
     RETURNING id, user_id AS "userId", owner, repo, full_name AS "fullName", html_url AS "htmlUrl", enabled, events,
               created_at AS "createdAt", updated_at AS "updatedAt", last_event_at AS "lastEventAt"`,
    [crypto.randomUUID(), input.userId, input.owner, input.repo, input.fullName, input.htmlUrl, input.enabled, JSON.stringify(input.events), now]
  );
  return result.rows[0];
}

export async function deleteMonitor(userId: string, monitorId: string) {
  if (!pool) {
    const data = readFile(); const before = data.monitors.length;
    data.monitors = data.monitors.filter(m => !(m.id === monitorId && m.userId === userId)); writeFile(data);
    return data.monitors.length !== before;
  }
  const result = await pool.query(`DELETE FROM monitors WHERE id=$1 AND user_id=$2`, [monitorId, userId]);
  return (result.rowCount || 0) > 0;
}

export async function setMonitorLastEvent(monitorId: string) {
  const now = new Date().toISOString();
  if (!pool) {
    const data = readFile(); const monitor = data.monitors.find(m => m.id === monitorId);
    if (!monitor) return; monitor.lastEventAt = now; monitor.updatedAt = now; writeFile(data); return;
  }
  await pool.query(`UPDATE monitors SET last_event_at=$1, updated_at=$1 WHERE id=$2`, [now, monitorId]);
}

export async function recordHistory(input: Omit<HistoryRecord, "id" | "visitedAt">) {
  const now = new Date().toISOString();
  if (!pool) {
    const data = readFile(); const key = input.fullName.toLowerCase();
    const existing = data.history.find(h => h.userId === input.userId && h.fullName.toLowerCase() === key);
    if (existing) Object.assign(existing, input, { visitedAt: now });
    else data.history.unshift({ ...input, id: crypto.randomUUID(), visitedAt: now });
    const userHistory = data.history.filter(h => h.userId === input.userId).sort((a,b) => b.visitedAt.localeCompare(a.visitedAt)).slice(0,100);
    data.history = [...userHistory, ...data.history.filter(h => h.userId !== input.userId)]; writeFile(data);
    return data.history.find(h => h.userId === input.userId && h.fullName.toLowerCase() === key) || null;
  }
  const result = await pool.query<HistoryRecord>(
    `INSERT INTO history (id,user_id,owner,repo,full_name,html_url,visited_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, LOWER(full_name)) DO UPDATE SET owner=EXCLUDED.owner, repo=EXCLUDED.repo, html_url=EXCLUDED.html_url, visited_at=EXCLUDED.visited_at
     RETURNING id, user_id AS "userId", owner, repo, full_name AS "fullName", html_url AS "htmlUrl", visited_at AS "visitedAt"`,
    [crypto.randomUUID(), input.userId, input.owner, input.repo, input.fullName, input.htmlUrl, now]
  );
  await pool.query(
    `DELETE FROM history WHERE user_id=$1 AND id NOT IN (SELECT id FROM history WHERE user_id=$1 ORDER BY visited_at DESC LIMIT 100)`,
    [input.userId]
  );
  return result.rows[0] || null;
}

export async function listHistory(userId: string) {
  if (!pool) return readFile().history.filter(h => h.userId === userId).sort((a,b) => b.visitedAt.localeCompare(a.visitedAt));
  const result = await pool.query<HistoryRecord>(
    `SELECT id, user_id AS "userId", owner, repo, full_name AS "fullName", html_url AS "htmlUrl", visited_at AS "visitedAt"
     FROM history WHERE user_id=$1 ORDER BY visited_at DESC`, [userId]
  );
  return result.rows;
}

export async function deleteHistoryItem(userId: string, historyId: string) {
  if (!pool) {
    const data = readFile(); const before = data.history.length;
    data.history = data.history.filter(h => !(h.id === historyId && h.userId === userId)); writeFile(data);
    return data.history.length !== before;
  }
  const result = await pool.query(`DELETE FROM history WHERE id=$1 AND user_id=$2`, [historyId, userId]);
  return (result.rowCount || 0) > 0;
}

export async function clearHistory(userId: string) {
  if (!pool) {
    const data = readFile(); const before = data.history.length;
    data.history = data.history.filter(h => h.userId !== userId); writeFile(data); return before - data.history.length;
  }
  const result = await pool.query(`DELETE FROM history WHERE user_id=$1`, [userId]);
  return result.rowCount || 0;
}

export async function createNotification(input: Omit<NotificationRecord, "id" | "createdAt" | "read">) {
  const now = new Date().toISOString();
  if (!pool) {
    const data = readFile(); const notification: NotificationRecord = { ...input, id: crypto.randomUUID(), createdAt: now, read: false };
    data.notifications.unshift(notification); data.notifications = data.notifications.slice(0,250); writeFile(data); return notification;
  }
  const result = await pool.query<NotificationRecord>(
    `INSERT INTO notifications (id,user_id,monitor_id,type,title,body,url,created_at,read)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE)
     RETURNING id,user_id AS "userId",monitor_id AS "monitorId",type,title,body,url,created_at AS "createdAt",read`,
    [crypto.randomUUID(), input.userId, input.monitorId, input.type, input.title, input.body, input.url, now]
  );
  return result.rows[0];
}

export async function listNotifications(userId: string) {
  if (!pool) return readFile().notifications.filter(n => n.userId === userId);
  const result = await pool.query<NotificationRecord>(
    `SELECT id,user_id AS "userId",monitor_id AS "monitorId",type,title,body,url,created_at AS "createdAt",read
     FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 250`, [userId]
  );
  return result.rows;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  if (!pool) {
    const data = readFile(); const item = data.notifications.find(n => n.userId === userId && n.id === notificationId);
    if (!item) return null; item.read = true; writeFile(data); return item;
  }
  const result = await pool.query<NotificationRecord>(
    `UPDATE notifications SET read=TRUE WHERE user_id=$1 AND id=$2
     RETURNING id,user_id AS "userId",monitor_id AS "monitorId",type,title,body,url,created_at AS "createdAt",read`,
    [userId, notificationId]
  );
  return result.rows[0] || null;
}
