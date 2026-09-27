import { AlertCircle, CalendarDays, CircleDot, GitPullRequest, GitCommitHorizontal, GitFork, Star } from "lucide-react";
import type { RepoAnalysis } from "../types/github";
import type { CurrentUser } from "../api/auth";
import { SearchBar } from "../components/SearchBar";
import { RepoHeader } from "../components/repository/RepoHeader";
import { StatCard } from "../components/StatCard";
import { ActivityChart } from "../components/charts/ActivityChart";
import { LanguageChart } from "../components/charts/LanguageChart";
import { Contributors } from "../components/repository/Contributors";
import { HealthPanel } from "../components/repository/HealthPanel";
import { compactNumber, formatDate } from "../utils/format";

type Range = "daily" | "weekly" | "monthly" | "yearly";

export function Dashboard({ data, loading, error, user, isPinned, onSearch, onRangeChange, onTogglePin, onRequestSignIn }: {
  data: RepoAnalysis; loading: boolean; error: string | null; user: CurrentUser | null; isPinned: boolean;
  onSearch: (v: string) => void; onRangeChange: (r: Range) => void; onTogglePin: () => void; onRequestSignIn: () => void;
}) {
  const repo = data.repository;
  const commits = data.activity.reduce((s, x) => s + x.commits, 0);
  const prs = data.activity.reduce((s, x) => s + x.pullRequests, 0);

  return <main className="container">
    <div className="top-search"><SearchBar onSearch={onSearch} loading={loading} /></div>
    {error && <div className="error-banner"><AlertCircle size={17} />{error}</div>}
    <RepoHeader repo={repo} isPinned={isPinned} onTogglePin={user ? onTogglePin : onRequestSignIn} />
    <div className="stats-grid">
      <StatCard icon={<Star size={18} />} label="Stars" value={compactNumber(repo.stargazers_count)} />
      <StatCard icon={<GitFork size={18} />} label="Forks" value={compactNumber(repo.forks_count)} />
      <StatCard icon={<GitCommitHorizontal size={18} />} label="Commits" value={commits.toLocaleString()} hint={`${data.activityRange} view`} />
      <StatCard icon={<GitPullRequest size={18} />} label="Pull requests" value={prs.toLocaleString()} hint={`${data.activityRange} view`} />
      <StatCard icon={<CircleDot size={18} />} label="Open issues" value={compactNumber(repo.open_issues_count)} />
      <StatCard icon={<CalendarDays size={18} />} label="Last push" value={formatDate(repo.pushed_at)} />
    </div>
    <div className="dashboard-grid">
      <ActivityChart data={data.activity} range={data.activityRange} onRangeChange={onRangeChange} loading={loading} />
      <LanguageChart data={data.languages} />
      <Contributors data={data.contributors} />
      <HealthPanel health={data.health ?? { available: false }} />
    </div>
  </main>;
}
