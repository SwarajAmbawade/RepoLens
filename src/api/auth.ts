export interface CurrentUser {
  id: string;
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

const API = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === "localhost" && window.location.port === "5173" ? "http://localhost:8787" : window.location.origin);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export function signInWithGitHub() {
  window.location.href = `${API}/auth/github`;
}

export async function getCurrentUser() {
  return request<{ user: CurrentUser }>("/api/me");
}

export async function logout() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export async function getMonitors() {
  return request<{ monitors: any[] }>("/api/monitors");
}

export async function pinRepository(repo: {
  owner: string; repo: string; htmlUrl?: string; events?: string[];
}) {
  return request<{ monitor: any }>("/api/monitors", {
    method: "POST",
    body: JSON.stringify(repo)
  });
}

export async function unpinRepository(id: string) {
  return request<{ ok: boolean }>(`/api/monitors/${id}`, { method: "DELETE" });
}

export async function getNotifications() {
  return request<{ notifications: any[] }>("/api/notifications");
}

export async function markNotificationRead(id: string) {
  return request<{ notification: any }>(`/api/notifications/${id}/read`, { method: "POST" });
}

export async function getHistory() {
  return request<{ history: any[] }>("/api/history");
}

export async function deleteHistoryItem(id: string) {
  return request<{ ok: boolean }>(`/api/history/${id}`, { method: "DELETE" });
}

export async function clearHistory() {
  return request<{ ok: boolean; deleted: number }>("/api/history", { method: "DELETE" });
}
