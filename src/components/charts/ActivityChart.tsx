import { Activity } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Card } from "../ui/Card";
import type { ActivityPoint } from "../../types/github";

type Range = "daily" | "weekly" | "monthly" | "yearly";
const options: { id: Range; label: string }[] = [
  { id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" }, { id: "yearly", label: "Yearly" }
];

export function ActivityChart({ data, range, onRangeChange, loading }: {
  data: ActivityPoint[]; range: Range; onRangeChange: (r: Range) => void; loading?: boolean;
}) {
  return <Card className="chart-card">
    <div className="card-title activity-title">
      <div><Activity size={17} /><span>Development activity</span></div>
      <div className="range-tabs">
        {options.map(o => <button key={o.id} className={range === o.id ? "active" : ""} disabled={loading} onClick={() => onRangeChange(o.id)}>{o.label}</button>)}
      </div>
    </div>
    <div className={`chart-wrap ${loading ? "chart-loading" : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#24292d" vertical={false} />
          <XAxis dataKey="label" stroke="#747b80" tickLine={false} axisLine={false} />
          <YAxis stroke="#747b80" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "#101316", border: "1px solid #343a3f", borderRadius: 8 }} />
          <Legend />
          <Line type="monotone" dataKey="commits" stroke="#c7c9c8" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="pullRequests" stroke="#a9a18a" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="issues" stroke="#b9775f" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>;
}
