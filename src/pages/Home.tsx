import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AlertCircle, BarChart3, GitBranch, ShieldCheck } from "lucide-react";
import { SearchBar } from "../components/SearchBar";

export function Home({
  onSearch,
  loading,
  error
}: {
  onSearch: (value: string) => void;
  loading: boolean;
  error?: string | null;
}) {
  const featureRef = useRef<HTMLDivElement>(null);
  const [featuresVisible, setFeaturesVisible] = useState(false);

  useEffect(() => {
    const node = featureRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setFeaturesVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const featureClass = (index: number) => `feature-card reveal-card ${featuresVisible ? "is-visible" : ""}`;

  return (
    <main className="home">
      <div className="container">
        <div className="hero-kicker"><span className="pulse" /> GitHub repository intelligence</div>

        <h1>
          See what a repository<br />
          <span>is actually doing.</span>
        </h1>

        <p className="hero-copy">
          RepoLens turns GitHub data into a clean developer dashboard for understanding
          open-source projects, activity, contributors, and engineering signals.
        </p>

        <SearchBar onSearch={onSearch} loading={loading} />

        {error && (
          <div className="search-error" role="alert">
            <div className="search-error-icon"><AlertCircle size={17} /></div>
            <div>
              <strong>Unable to analyze repository</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="examples">
          <span>Try</span>
          <button onClick={() => onSearch("facebook/react")}>facebook/react</button>
          <button onClick={() => onSearch("vercel/next.js")}>vercel/next.js</button>
        </div>

        <div className="feature-grid" ref={featureRef}>
          <div className={featureClass(0)} style={{ "--reveal-delay": "0ms" } as CSSProperties}>
            <BarChart3 />
            <strong>Activity, not just stars</strong>
            <p>See commits, pull requests, issues, and development activity over different time ranges.</p>
          </div>
          <div className={featureClass(1)} style={{ "--reveal-delay": "130ms" } as CSSProperties}>
            <GitBranch />
            <strong>Understand contributors</strong>
            <p>See who is contributing, when they were last active, and how the work is distributed.</p>
          </div>
          <div className={featureClass(2)} style={{ "--reveal-delay": "260ms" } as CSSProperties}>
            <ShieldCheck />
            <strong>Read the repository at a glance</strong>
            <p>Turn raw GitHub activity into simple signals that explain what is happening in the project.</p>
          </div>
        </div>

        <div className="home-note">
          Public repositories can be analyzed without signing in.
        </div>
      </div>
    </main>
  );
}
