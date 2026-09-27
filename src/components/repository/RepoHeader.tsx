import { ExternalLink, GitFork, Globe, Lock, Pin, Star } from "lucide-react";
import type { Repository } from "../../types/github";
import { compactNumber } from "../../utils/format";

export function RepoHeader({ repo, isPinned, onTogglePin }: { repo: Repository; isPinned: boolean; onTogglePin: () => void }) {
  return (
    <div className="repo-header">
      <img className="owner-avatar" src={repo.owner.avatar_url} alt="" />
      <div className="repo-heading">
        <div className="breadcrumb">
          <a href={repo.owner.html_url} target="_blank" rel="noreferrer">{repo.owner.login}</a>
          <span>/</span>
          <strong>{repo.name}</strong>
          {repo.private ? <Lock size={13} /> : null}
        </div>
        <div className="repo-title-row"><h1>{repo.name}</h1><button className={`repo-pin ${isPinned ? "pinned" : ""}`} onClick={onTogglePin} title={isPinned ? "Unpin repository" : "Pin repository"}><Pin size={14} /> {isPinned ? "Pinned" : "Pin"}</button></div>
        <p>{repo.description || "No repository description provided."}</p>
        <div className="repo-meta">
          <span><Star size={15} /> {compactNumber(repo.stargazers_count)}</span>
          <span><GitFork size={15} /> {compactNumber(repo.forks_count)}</span>
          <a href={repo.html_url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> GitHub</a>
          {repo.homepage && <a href={repo.homepage} target="_blank" rel="noreferrer"><Globe size={15} /> Website</a>}
        </div>
        {repo.topics?.length ? (
          <div className="topics">{repo.topics.map(topic => <span key={topic}>{topic}</span>)}</div>
        ) : null}
      </div>
    </div>
  );
}