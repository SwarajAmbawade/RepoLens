export interface Repository {
  id: number; name: string; full_name: string; description: string | null; html_url: string;
  homepage: string | null; private: boolean; fork: boolean; archived: boolean;
  owner: { login: string; avatar_url: string; html_url: string };
  stargazers_count: number; forks_count: number; watchers_count: number;
  open_issues_count: number; subscribers_count?: number; size: number;
  language: string | null; created_at: string; updated_at: string; pushed_at: string | null;
  default_branch: string; topics?: string[];
}
export interface LanguageStat { name: string; bytes: number; percentage: number; }
export interface ActivityPoint { label: string; commits: number; pullRequests: number; issues: number; }
export interface Contributor {
  login: string; avatar_url: string; html_url: string; contributions: number;
  type?: string; recent?: boolean; bot?: boolean; lastContributionDate?: string | null; recentContributions?: number;
}
export interface RepoAnalysis {
  repository: Repository;
  languages: LanguageStat[];
  activity: ActivityPoint[];
  activityByRange?: Record<"daily" | "weekly" | "monthly" | "yearly", ActivityPoint[]>;
  contributors: Contributor[];
  contributorStats?: {
    total: number; humans: number; bots: number; totalContributions: number; topFivePercentage: number; topFive?: Array<{ login: string; avatar_url: string; contributions: number }>;
  };
  health?: {
    available: boolean; activity?: number; maintenance?: number; community?: number;
    documentation?: number; concentration?: number; activePoints?: number; totalPoints?: number;
    daysSincePush?: number | null; descriptionPresent?: boolean;
  };
  activityRange: "daily" | "weekly" | "monthly" | "yearly";
  activityMeta?: {
    dailyPoints: number; commitHistorySource: string; prIssueSource: string; limitedHistory: boolean;
    cacheTtlMinutes?: number; issueHistoryDays?: number; issueHistoryTruncated?: boolean;
    issueHistoryFetchedThrough?: string; rangeSwitchUsesCache?: boolean;
  };
}
