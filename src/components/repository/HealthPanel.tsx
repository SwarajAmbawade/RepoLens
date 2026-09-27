import { Activity, BookOpen, GitCommitHorizontal, UsersRound } from "lucide-react";
import { Card } from "../ui/Card";

type Health = {
  available: boolean;
  activity?: number;
  maintenance?: number;
  community?: number;
  documentation?: number;
  concentration?: number;
  activePoints?: number;
  totalPoints?: number;
  daysSincePush?: number | null;
  descriptionPresent?: boolean;
};

function activityText(health: Health) {
  if (!health.totalPoints) return "No activity history";
  return `${health.activePoints ?? 0} of ${health.totalPoints} periods had activity`;
}

function maintenanceText(days: number | null | undefined) {
  if (days === null || days === undefined) return "No push date available";
  if (days === 0) return "Pushed today";
  if (days === 1) return "Pushed yesterday";
  if (days <= 7) return `Pushed ${days} days ago`;
  if (days <= 30) return `Pushed ${days} days ago`;
  if (days <= 90) return `Pushed ${Math.round(days / 7)} weeks ago`;
  if (days <= 365) return `Pushed ${Math.round(days / 30)} months ago`;
  return `No push in ${Math.round(days / 365)}+ years`;
}

function communityText(concentration?: number) {
  if (concentration === undefined) return "Contributor data unavailable";
  if (concentration <= 30) return "Work is spread across many contributors";
  if (concentration <= 60) return "Several contributors share the workload";
  return "A small group accounts for most contributions";
}

export function HealthPanel({ health }: { health: Health }) {
  if (!health.available) {
    return <Card>
      <div className="card-title">
        <div><Activity size={17} /><span>Repository snapshot</span></div>
        <span className="badge">What this means</span>
      </div>
      <div className="snapshot-empty">
        <strong>Not enough activity yet</strong>
        <p>RepoLens needs more history before it can summarize how consistently this repository is being worked on.</p>
      </div>
    </Card>;
  }

  const rows = [
    { icon: Activity, label: "Activity", value: health.activity !== undefined ? `${health.activity}% active` : "—", detail: activityText(health) },
    { icon: GitCommitHorizontal, label: "Maintenance", value: maintenanceText(health.daysSincePush), detail: "Based on the repository's latest push" },
    { icon: UsersRound, label: "Contributors", value: health.concentration !== undefined ? `${health.concentration}% from top 5` : "—", detail: communityText(health.concentration) },
    { icon: BookOpen, label: "Documentation", value: health.descriptionPresent ? "Description present" : "No description", detail: health.descriptionPresent ? "The repository has a public description" : "The repository has not provided a description" }
  ];

  return <Card className="snapshot-card">
    <div className="card-title">
      <div><Activity size={17} /><span>Repository snapshot</span></div>
      <span className="badge">At a glance</span>
    </div>
    <div className="snapshot-grid">
      {rows.map(({ icon: Icon, label, value, detail }) => (
        <div className="snapshot-row" key={label}>
          <div className="snapshot-icon"><Icon size={15} /></div>
          <div className="snapshot-main">
            <div><span>{label}</span><strong>{value}</strong></div>
            <p>{detail}</p>
          </div>
        </div>
      ))}
    </div>
    <p className="snapshot-note">These are descriptive repository facts, not a quality score.</p>
  </Card>;
}
