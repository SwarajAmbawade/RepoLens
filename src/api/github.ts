import type { RepoAnalysis } from "../types/github";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === "localhost" && window.location.port === "5173" ? "http://localhost:8787" : window.location.origin);

export function parseRepoInput(input: string) {
  const cleaned = input.trim().replace(/\/+$/, "");
  const url = cleaned.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (url) return { owner: url[1], repo: url[2].replace(/\.git$/, "") };
  const short = cleaned.match(/^([^/]+)\/([^/]+)$/);
  return short ? { owner: short[1], repo: short[2].replace(/\.git$/, "") } : null;
}

export async function analyzeRepository(
  owner: string, repo: string, range: "daily" | "weekly" | "monthly" | "yearly"
): Promise<RepoAnalysis> {
  const response = await fetch(`${API_BASE}/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}?range=${range}`, {
    credentials: "include"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: body.error || "The repository request is invalid.",
      401: "GitHub authentication failed. Check the server-side GitHub token.",
      403: "GitHub denied this request. It may be rate-limited or the token may not have access.",
      404: "We couldn't find that GitHub repository, or you don't have permission to view it.",
      422: body.error || "GitHub rejected the request. The repository may not be searchable with the current token configuration.",
      429: "GitHub rate limit reached. Please wait before trying again."
    };
    const message = messages[response.status] || body.error || `The repository could not be analyzed (HTTP ${response.status}).`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}
