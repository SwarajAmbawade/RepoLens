import { Bell, ExternalLink, GitBranch, History, Pin, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clearHistory, deleteHistoryItem, getHistory, getMonitors, getNotifications, pinRepository, unpinRepository, type CurrentUser } from "../api/auth";

export function Workspace({ user, onAnalyze }: { user: CurrentUser; onAnalyze: (value: string) => void }) {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [m, n, h] = await Promise.all([getMonitors(), getNotifications(), getHistory()]);
    setMonitors(m.monitors);
    setNotifications(n.notifications);
    setHistory(h.history);
  }

  useEffect(() => { refresh().catch(() => {}); }, []);

  async function pin() {
    const match = input.trim().match(/^(?:https?:\/\/github\.com\/)?([^/]+)\/([^/]+)\/?$/i);
    if (!match) {
      setMessage("Enter a repository as owner/repository.");
      return;
    }
    try {
      await pinRepository({ owner: match[1], repo: match[2].replace(/\.git$/, "") });
      setInput("");
      setMessage("Repository added to your workspace.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not pin repository.");
    }
  }

  async function remove(id: string) {
    await unpinRepository(id);
    await refresh();
  }

  async function removeHistory(id: string) {
    await deleteHistoryItem(id);
    await refresh();
  }

  async function removeAllHistory() {
    if (!history.length || !window.confirm("Clear your RepoLens search history?")) return;
    await clearHistory();
    await refresh();
  }

  return <main className="container workspace-page">
    <div className="workspace-head">
      <div>
        <span className="eyebrow">WORKSPACE</span>
        <h1>{user.name || user.login}'s repositories</h1>
        <p>Keep the repositories you care about and revisit projects you've analyzed before.</p>
      </div>
      <img src={user.avatarUrl} alt="" />
    </div>

    <section className="workspace-add card">
      <div><Pin size={17} /><strong>Pin a repository</strong></div>
      <div className="workspace-input">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="owner/repository" onKeyDown={e => e.key === "Enter" && pin()} />
        <button onClick={pin}>Pin</button>
      </div>
      {message && <span className="workspace-message">{message}</span>}
    </section>

    <div className="workspace-grid">
      <section className="card">
        <div className="card-title"><div><GitBranch size={17} /><span>Pinned repositories</span></div><span className="badge">{monitors.length}</span></div>
        {monitors.length ? monitors.map(m => (
          <div className="monitor-row" key={m.id}>
            <div className="monitor-main">
              <strong>{m.fullName}</strong>
              <span>Watching: {m.events.join(" · ")}</span>
            </div>
            <div className="monitor-actions">
              <button title="Analyze" onClick={() => onAnalyze(m.fullName)}><ExternalLink size={14} /></button>
              <button title="Remove" onClick={() => remove(m.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        )) : <div className="workspace-empty">No repositories pinned yet.</div>}
      </section>

      <section className="card">
        <div className="card-title"><div><Bell size={17} /><span>Notifications</span></div><span className="badge">{notifications.filter(n => !n.read).length} unread</span></div>
        {notifications.length ? notifications.slice(0, 8).map(n => (
          <div className={`notification-row ${n.read ? "" : "unread"}`} key={n.id}>
            <strong>{n.title}</strong><span>{n.body}</span>
          </div>
        )) : <div className="workspace-empty">No repository events yet.</div>}
      </section>
    </div>

    <section className="card history-card">
      <div className="card-title">
        <div><History size={17} /><span>Search history</span></div>
        {history.length > 0 && <button className="clear-history" onClick={removeAllHistory}><X size={13} /> Clear all</button>}
      </div>
      <p className="history-description">Repositories you've successfully analyzed while signed in. History is private to your account.</p>
      {history.length ? history.slice(0, 30).map(item => (
        <div className="history-row" key={item.id}>
          <button className="history-link" onClick={() => onAnalyze(item.fullName)}>
            <strong>{item.fullName}</strong>
            <span>Last visited {new Date(item.visitedAt).toLocaleString()}</span>
          </button>
          <div className="history-actions">
            <button title="Pin repository" onClick={async () => { await pinRepository({ owner: item.owner, repo: item.repo, htmlUrl: item.htmlUrl }); await refresh(); }}><Pin size={14} /></button>
            <button title="Remove from history" onClick={() => removeHistory(item.id)}><Trash2 size={14} /></button>
          </div>
        </div>
      )) : <div className="workspace-empty history-empty">No search history yet.</div>}
    </section>

  </main>;
}
