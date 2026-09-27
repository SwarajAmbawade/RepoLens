const GITHUB = "https://github.com";
const API = "https://api.github.com";

export function githubOAuthConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function githubAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || "",
    redirect_uri: process.env.GITHUB_CALLBACK_URL || "http://localhost:8787/auth/github/callback",
    state,
    scope: "read:user"
  });
  return `${GITHUB}/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const response = await fetch(`${GITHUB}/login/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL || "http://localhost:8787/auth/github/callback"
    })
  });
  if (!response.ok) throw new Error(`GitHub token exchange failed (${response.status}).`);
  return response.json() as Promise<{ access_token?: string; error?: string }>;
}

export async function githubUser(accessToken: string) {
  const response = await fetch(`${API}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error(`GitHub identity lookup failed (${response.status}).`);
  return response.json() as Promise<{
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
  }>;
}
