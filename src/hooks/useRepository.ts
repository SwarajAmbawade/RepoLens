import { useMemo, useState } from "react";
import { analyzeRepository, parseRepoInput } from "../api/github";
import type { RepoAnalysis } from "../types/github";

type Range = "daily" | "weekly" | "monthly" | "yearly";

export function useRepository() {
  const [rawData, setRawData] = useState<RepoAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("monthly");

  async function analyze(input: string, requestedRange = range) {
    const parsed = parseRepoInput(input);
    if (!parsed) {
      setError("Enter a GitHub repository as owner/repository or a GitHub URL.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRange(requestedRange);
      setRawData(await analyzeRepository(parsed.owner, parsed.repo, requestedRange));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repository could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  // Range switching is now a pure local operation. The backend sends all
  // activity views with the initial analysis, so clicking Daily/Weekly/
  // Monthly/Yearly does not make another GitHub request.
  const data = useMemo(() => {
    if (!rawData) return null;
    const localActivity = rawData.activityByRange?.[range] ?? rawData.activity;
    return { ...rawData, activity: localActivity, activityRange: range };
  }, [rawData, range]);

  function changeRange(next: Range) {
    if (!rawData) return;
    setRange(next);
  }

  return { data, loading, error, range, analyze, changeRange };
}
