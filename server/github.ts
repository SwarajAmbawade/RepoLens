const BASE = "https://api.github.com";

export type Range = "daily" | "weekly" | "monthly" | "yearly";
export const RANGES: Range[] = ["daily", "weekly", "monthly", "yearly"];

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  owner: { login: string; avatar_url: string; html_url: string };
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  subscribers_count?: number;
  size: number;
  language: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  default_branch: string;
  topics?: string[];
}

interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type?: string;
}

interface CommitActivityWeek { week: number; total: number; }

interface RecentCommit {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string | null } | null;
    message: string;
  };
  author: { login: string; avatar_url: string; html_url: string; type?: string } | null;
}

interface RepoIssue {
  id: number;
  number: number;
  title: string;
  created_at: string;
  updated_at: string;
  state: string;
  pull_request?: { url: string; html_url: string };
}

interface ActivityPoint {
  label: string;
  commits: number;
  pullRequests: number;
  issues: number;
  start: Date;
}

interface RawActivityData {
  weeks: CommitActivityWeek[];
  recentCommits: RecentCommit[];
  issues: RepoIssue[];
  issuesFetchedThrough: string;
  issuesTruncated: boolean;
}

interface RepoCacheEntry {
  expiresAt: number;
  repository: GitHubRepo;
  languages: Record<string, number>;
  contributors: Contributor[];
  raw: RawActivityData;
}

const repoCache = new Map<string, RepoCacheEntry>();
const repoInflight = new Map<string, Promise<RepoCacheEntry>>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const ISSUE_HISTORY_DAYS = 90;
// Keep repository analysis intentionally bounded. One 100-item page is enough
// to describe recent PR/issue activity without turning one analysis into a
// burst of paginated API calls. The cache is the source for all UI range views.
const MAX_ISSUE_PAGES = 1;

function tokenValue() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token || ["your_actual_token", "your_token_here", "YOUR_TOKEN", "your-github-token"].includes(token)) return undefined;
  return token;
}

function headers(includeAuth = true): Record<string, string> {
  const token = tokenValue();
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(includeAuth && token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export class GitHubApiError extends Error {
  status: number;
  rateLimitRemaining?: string;
  rateLimitReset?: string;

  constructor(status: number, body: string, response: Response) {
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.message === "string") detail = parsed.message;
    } catch {}
    super(`GitHub API returned ${status}: ${detail.slice(0, 300)}`);
    this.name = "GitHubApiError";
    this.status = status;
    this.rateLimitRemaining = response.headers.get("x-ratelimit-remaining") ?? undefined;
    this.rateLimitReset = response.headers.get("x-ratelimit-reset") ?? undefined;
  }
}

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function github<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: headers(true) });
  if (!response.ok) throw new GitHubApiError(response.status, await response.text(), response);
  return response.json() as Promise<T>;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function addUnit(date: Date, range: Range, amount: number) {
  const d = new Date(date);
  if (range === "daily") d.setDate(d.getDate() + amount);
  if (range === "weekly") d.setDate(d.getDate() + amount * 7);
  if (range === "monthly") d.setMonth(d.getMonth() + amount);
  if (range === "yearly") d.setFullYear(d.getFullYear() + amount);
  return d;
}

function pointsFor(range: Range) {
  return range === "daily" ? 7 : range === "weekly" ? 12 : range === "monthly" ? 12 : 5;
}

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function label(date: Date, range: Range) {
  if (range === "daily") return date.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
  if (range === "weekly") return `W${isoWeek(date)}`;
  if (range === "monthly") return date.toLocaleDateString("en", { month: "short", year: "2-digit" });
  return String(date.getFullYear());
}

function bucketIndex(date: Date, start: Date, range: Range) {
  for (let i = 0; i < pointsFor(range); i++) {
    const bucketStart = addUnit(start, range, i);
    const bucketEnd = i === pointsFor(range) - 1 ? new Date(8640000000000000) : addUnit(start, range, i + 1);
    if (date >= bucketStart && date < bucketEnd) return i;
  }
  return -1;
}

function emptyActivity(start: Date, range: Range): ActivityPoint[] {
  return Array.from({ length: pointsFor(range) }, (_, i) => {
    const date = addUnit(start, range, i);
    return { label: label(date, range), commits: 0, pullRequests: 0, issues: 0, start: date };
  });
}

async function getRecentCommits(owner: string, repo: string, start: Date, now: Date) {
  const params = new URLSearchParams({ since: start.toISOString(), until: now.toISOString(), per_page: "100", page: "1" });
  return github<RecentCommit[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params}`);
}

async function getParticipationActivity(owner: string, repo: string): Promise<CommitActivityWeek[]> {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/participation`;
  // Participation is the lightweight GitHub endpoint we actually need for
  // weekly/monthly/yearly commit views. Avoid commit_activity here because
  // GitHub may spend several seconds computing it and return 202 first.
  const delays = [0, 750, 1500];
  for (const delay of delays) {
    if (delay) await sleep(delay);
    const response = await fetch(`${BASE}${path}`, { headers: headers(true) });
    if (response.status === 202) continue;
    if (response.status === 204) return [];
    if (!response.ok) throw new GitHubApiError(response.status, await response.text(), response);
    const result = await response.json() as { all?: number[] };
    const values = Array.isArray(result.all) ? result.all : [];
    const currentWeek = startOfWeek(new Date());
    const firstWeek = new Date(currentWeek);
    firstWeek.setDate(firstWeek.getDate() - Math.max(0, values.length - 1) * 7);
    return values.map((total, index) => ({ week: Math.floor((firstWeek.getTime() + index * 7 * 86400000) / 1000), total }));
  }

  // GitHub is still calculating statistics. Returning an empty weekly set is
  // preferable to holding the entire repository analysis for 10+ seconds.
  return [];
}

async function getIssueHistory(owner: string, repo: string, now: Date) {
  const since = new Date(now.getTime() - ISSUE_HISTORY_DAYS * 86400000);
  const params = new URLSearchParams({
    state: "all",
    sort: "created",
    direction: "desc",
    since: since.toISOString(),
    per_page: "100",
    page: "1"
  });

  // Intentionally fetch a single bounded page. Historical PR/issue counts are
  // not worth making 10+ REST calls during every repository analysis. The
  // dashboard labels these as observed recent activity, while repository-level
  // open issue totals still come directly from repository metadata.
  const items = await github<RepoIssue[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params}`
  );

  return {
    items,
    fetchedThrough: items.at(-1)?.created_at ?? since.toISOString(),
    truncated: items.length >= 100
  };
}

async function fetchRawRepoData(owner: string, repo: string): Promise<RepoCacheEntry> {
  const now = new Date();
  const since = new Date(now.getTime() - 90 * 86400000);
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);

  // These sources are independent. Fetch them together so total load time is
  // close to the slowest GitHub request rather than the sum of every request.
  const [repository, languages, contributors, weeks, recentCommits, issueHistory] = await Promise.all([
    github<GitHubRepo>(`/repos/${encodedOwner}/${encodedRepo}`),
    github<Record<string, number>>(`/repos/${encodedOwner}/${encodedRepo}/languages`),
    github<Contributor[]>(`/repos/${encodedOwner}/${encodedRepo}/contributors?per_page=100`),
    getParticipationActivity(owner, repo),
    getRecentCommits(owner, repo, since, now),
    getIssueHistory(owner, repo, now)
  ]);

  return {
    expiresAt: Date.now() + CACHE_TTL_MS,
    repository,
    languages,
    contributors,
    raw: {
      weeks,
      recentCommits,
      issues: issueHistory.items,
      issuesFetchedThrough: issueHistory.fetchedThrough,
      issuesTruncated: issueHistory.truncated
    }
  };
}

async function getCachedRepoData(owner: string, repo: string) {
  const key = `${owner}/${repo}`.toLowerCase();
  const cached = repoCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const existing = repoInflight.get(key);
  if (existing) return existing;

  const request = fetchRawRepoData(owner, repo)
    .then(fresh => {
      repoCache.set(key, fresh);
      return fresh;
    })
    .finally(() => repoInflight.delete(key));

  repoInflight.set(key, request);
  return request;
}

function buildActivity(raw: RawActivityData, range: Range, now: Date): ActivityPoint[] {
  const start = range === "daily"
    ? startOfDay(addUnit(now, "daily", -6))
    : range === "weekly"
      ? startOfWeek(addUnit(now, "weekly", -11))
      : range === "monthly"
        ? startOfMonth(addUnit(now, "monthly", -11))
        : startOfYear(addUnit(now, "yearly", -4));

  const activity = emptyActivity(start, range);

  // Commit statistics are weekly. Re-bucket those same 52 weeks locally for
  // weekly/monthly/yearly views. No GitHub call happens when the UI toggles.
  for (const week of raw.weeks) {
    const date = new Date(week.week * 1000);
    const index = bucketIndex(date, start, range);
    if (index >= 0) activity[index].commits += week.total;
  }

  // Daily uses the already-fetched recent commit timestamps.
  if (range === "daily") {
    for (const item of raw.recentCommits) {
      const date = item.commit.author?.date;
      if (!date) continue;
      const index = bucketIndex(new Date(date), start, range);
      if (index >= 0) activity[index].commits++;
    }
  }

  // PRs and issues come from one bounded repository listing. We classify PRs
  // using GitHub's pull_request field instead of making Search API requests.
  for (const item of raw.issues) {
    const date = new Date(item.created_at);
    const index = bucketIndex(date, start, range);
    if (index < 0) continue;
    if (item.pull_request) activity[index].pullRequests++;
    else activity[index].issues++;
  }

  return activity;
}

function calculateHealth(repo: GitHubRepo, activity: Array<Omit<ActivityPoint, "start">>, contributors: Contributor[]) {
  const activePoints = activity.filter(x => x.commits + x.pullRequests + x.issues > 0).length;
  const activityConsistency = activity.length ? Math.round((activePoints / activity.length) * 100) : 0;
  const total = contributors.reduce((sum, c) => sum + c.contributions, 0);
  const topFive = [...contributors].sort((a, b) => b.contributions - a.contributions).slice(0, 5).reduce((sum, c) => sum + c.contributions, 0);
  const concentration = total ? Math.round((topFive / total) * 100) : 100;
  const daysSincePush = repo.pushed_at ? Math.max(0, Math.floor((Date.now() - new Date(repo.pushed_at).getTime()) / 86400000)) : null;
  const pushedRecently = daysSincePush !== null && daysSincePush <= 90;
  return {
    available: activity.length >= 5,
    activity: activityConsistency,
    maintenance: pushedRecently ? 100 : 40,
    community: Math.max(0, Math.min(100, 100 - Math.max(0, concentration - 50))),
    documentation: repo.description ? 80 : 30,
    concentration,
    activePoints,
    totalPoints: activity.length,
    daysSincePush,
    descriptionPresent: Boolean(repo.description)
  };
}

export async function fetchRepoAnalysis(owner: string, repo: string, requestedRange: Range) {
  const data = await getCachedRepoData(owner, repo);
  const now = new Date();

  const activityByRange = Object.fromEntries(
    RANGES.map(range => [range, buildActivity(data.raw, range, now).map(({ start: _start, ...point }) => point)])
  ) as Record<Range, Array<Omit<ActivityPoint, "start">>>;

  const activity = activityByRange[requestedRange];
  const recentLogins = new Set(data.raw.recentCommits.map(c => c.author?.login).filter(Boolean) as string[]);

  const totalLanguageBytes = Object.values(data.languages).reduce((a, b) => a + b, 0) || 1;
  const languageStats = Object.entries(data.languages)
    .map(([name, bytes]) => ({ name, bytes, percentage: Math.round((bytes / totalLanguageBytes) * 1000) / 10 }))
    .sort((a, b) => b.bytes - a.bytes);

  const recentContributionMap = new Map<string, { date: string; count: number }>();
  for (const commit of data.raw.recentCommits) {
    const login = commit.author?.login;
    const date = commit.commit.author?.date;
    if (!login || !date) continue;
    const existing = recentContributionMap.get(login);
    recentContributionMap.set(login, {
      date: existing && existing.date > date ? existing.date : date,
      count: (existing?.count ?? 0) + 1
    });
  }

  const totalContributions = data.contributors.reduce((sum, c) => sum + c.contributions, 0);
  const topFiveContributors = [...data.contributors].sort((a, b) => b.contributions - a.contributions).slice(0, 5);
  const topFive = topFiveContributors.reduce((sum, c) => sum + c.contributions, 0);
  const contributorView = data.contributors.map(c => ({
    ...c,
    recent: recentLogins.has(c.login),
    lastContributionDate: recentContributionMap.get(c.login)?.date ?? null,
    recentContributions: recentContributionMap.get(c.login)?.count ?? 0,
    bot: c.type === "Bot" || /bot|dependabot|renovate|github-actions|release/i.test(c.login)
  }));

  return {
    repository: data.repository,
    languages: languageStats,
    activity,
    activityByRange,
    contributors: contributorView,
    contributorStats: {
      total: data.contributors.length,
      humans: contributorView.filter(c => !c.bot).length,
      bots: contributorView.filter(c => c.bot).length,
      totalContributions,
      topFivePercentage: totalContributions ? Math.round((topFive / totalContributions) * 100) : 0,
      topFive: topFiveContributors.map(c => ({ login: c.login, avatar_url: c.avatar_url, contributions: c.contributions }))
    },
    health: calculateHealth(data.repository, activity, data.contributors),
    activityRange: requestedRange,
    activityMeta: {
      dailyPoints: 7,
      commitHistorySource: "GitHub participation statistics cached per repository; daily view uses cached recent commit timestamps",
      prIssueSource: "GitHub repository Issues endpoint; one bounded recent page cached per repository; pull requests identified from the pull_request field",
      limitedHistory: true,
      cacheTtlMinutes: CACHE_TTL_MS / 60000,
      issueHistoryDays: ISSUE_HISTORY_DAYS,
      issueHistoryPageSize: 100,
      issueHistoryTruncated: data.raw.issuesTruncated,
      issueHistoryFetchedThrough: data.raw.issuesFetchedThrough,
      rangeSwitchUsesCache: true
    }
  };
}
