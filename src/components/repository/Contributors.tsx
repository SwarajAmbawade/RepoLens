import { useMemo, useState } from "react";
import { Users, Bot, Clock3, Sparkles, BarChart3 } from "lucide-react";
import { Card } from "../ui/Card";
import type { Contributor } from "../../types/github";

type Tab = "top" | "recent" | "active" | "new" | "bots";

function formatRecentDate(value?: string | null) {
  if (!value) return "recent activity";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function Contributors({ data }: { data: Contributor[] }) {
  const [tab, setTab] = useState<Tab>("top");

  const sorted = useMemo(() => {
    const humans = data.filter(person => !person.bot);
    const bots = data.filter(person => person.bot);
    const recent = humans.filter(person => person.recent);
    const newInWindow = humans.filter(person => person.recent && person.contributions <= 5);

    switch (tab) {
      case "bots": return [...bots].sort((a, b) => b.contributions - a.contributions);
      case "recent": return [...recent].sort((a, b) => (b.lastContributionDate ?? "").localeCompare(a.lastContributionDate ?? ""));
      case "active": return [...humans].sort((a, b) => b.contributions - a.contributions);
      case "new": return [...newInWindow].sort((a, b) => (b.lastContributionDate ?? "").localeCompare(a.lastContributionDate ?? ""));
      default: return [...humans].sort((a, b) => b.contributions - a.contributions);
    }
  }, [data, tab]);

  const total = data.reduce((sum, item) => sum + item.contributions, 0);
  const topFiveContributors = [...data].sort((a, b) => b.contributions - a.contributions).slice(0, 5);
  const topFive = topFiveContributors.reduce((sum, item) => sum + item.contributions, 0);
  const concentration = total ? Math.round((topFive / total) * 100) : 0;

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "top", label: "Top", icon: Users },
    { id: "recent", label: "Recent", icon: Clock3 },
    { id: "active", label: "Most active", icon: BarChart3 },
    { id: "new", label: "New", icon: Sparkles },
    { id: "bots", label: "Bots", icon: Bot }
  ];

  const descriptions: Record<Tab, string> = {
    top: "Highest contribution counts returned by GitHub.",
    recent: "People who appeared in the cached recent commit window, with their latest observed commit date.",
    active: "Highest contribution counts returned by GitHub.",
    new: "Low-contribution accounts seen in the cached recent commit window.",
    bots: "Accounts GitHub identifies as bots or common automation accounts."
  };

  return <Card className="contributors-card">
    <div className="card-title contributor-title">
      <div><Users size={17} /><span>Contributors</span></div>
      <span className="badge">{data.length} shown</span>
    </div>

    <div className="contributor-tabs" role="tablist">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>

    <div className="contributor-description">{descriptions[tab]}</div>

    <div className="contributors-layout">
      <div className="contributors-list">
        {sorted.slice(0, 8).map(person => (
          <a className="contributor" href={person.html_url} target="_blank" rel="noreferrer" key={person.login}>
            <img src={person.avatar_url} alt="" />
            <div className="contributor-main">
              <strong>{person.login}</strong>
              {tab === "recent" || tab === "new" ? (
                <span>
                  {person.recentContributions ? `${person.recentContributions} observed commit${person.recentContributions === 1 ? "" : "s"}` : "Recent activity"}
                  {person.lastContributionDate ? ` · last ${formatRecentDate(person.lastContributionDate)}` : ""}
                </span>
              ) : (
                <span>{person.contributions.toLocaleString()} contributions{person.recent ? " · seen recently" : ""}</span>
              )}
            </div>
            <span className="contributor-arrow">↗</span>
          </a>
        ))}
        {!sorted.length && <div className="empty-contributors"><Bot size={18} /><span>No contributors match this category in the available GitHub data.</span></div>}
      </div>

      <aside className="contribution-insight">
        <div className="insight-label">CONTRIBUTION DISTRIBUTION</div>
        <div className="concentration-number">{concentration}%</div>
        <strong>from the top 5</strong>
        <p>The five highest-contribution accounts represent this share of the contribution count returned by GitHub.</p>
        <div className="concentration-bar"><span style={{ width: `${Math.max(concentration, 2)}%` }} /></div>
        <div className="insight-meta"><span>{data.length} contributors</span><span>{total.toLocaleString()} total</span></div>

        <div className="top-five-list">
          <div className="top-five-label">TOP CONTRIBUTORS</div>
          {topFiveContributors.map(person => (
            <a href={person.html_url} target="_blank" rel="noreferrer" key={person.login} className="top-five-person">
              <img src={person.avatar_url} alt="" />
              <span>{person.login}</span>
              <strong>{person.contributions.toLocaleString()}</strong>
            </a>
          ))}
        </div>
      </aside>
    </div>
  </Card>;
}
