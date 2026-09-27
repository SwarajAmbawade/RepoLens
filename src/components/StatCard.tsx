import type { ReactNode } from "react";

export function StatCard({ icon, label, value, hint }: {
  icon: ReactNode; label: string; value: string; hint?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="eyebrow">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="muted">{hint}</div>}
      </div>
    </div>
  );
}