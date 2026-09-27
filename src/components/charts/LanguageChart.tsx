import { Card } from "../ui/Card";
import { Code2 } from "lucide-react";
import type { LanguageStat } from "../../types/github";

export function LanguageChart({ data }: { data: LanguageStat[] }) {
  return (
    <Card>
      <div className="card-title"><div><Code2 size={17} /><span>Languages</span></div></div>
      <div className="language-list">
        {data.slice(0, 7).map(language => (
          <div className="language-row" key={language.name}>
            <div className="language-line">
              <span>{language.name}</span><strong>{language.percentage}%</strong>
            </div>
            <div className="bar"><span style={{ width: `${Math.max(language.percentage, 2)}%` }} /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}