import { Github, LogOut, UserRound, LayoutDashboard, Bell, X, ShieldCheck, LockKeyhole, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { Workspace } from "./pages/Workspace";
import { useRepository } from "./hooks/useRepository";
import { getCurrentUser, getMonitors, logout, pinRepository, signInWithGitHub, unpinRepository } from "./api/auth";
import type { CurrentUser } from "./api/auth";

export default function App() {
  const { data, loading, error, range, analyze, changeRange } = useRepository();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [workspace, setWorkspace] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [pinnedRepos, setPinnedRepos] = useState<string[]>([]);

  async function refreshAuth() {
    try {
      const result = await getCurrentUser();
      setUser(result.user);
      getMonitors()
        .then(monitors => setPinnedRepos(monitors.monitors.map(x => x.fullName.toLowerCase())))
        .catch(() => {});
    } catch {
      setUser(null);
      setPinnedRepos([]);
    }
  }

  useEffect(() => {
    void refreshAuth();

    const handlePageShow = () => { void refreshAuth(); };
    window.addEventListener("pageshow", handlePageShow);

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) setAuthMessage(authError);
    if (params.get("signed_in")) {
      setSignInOpen(false);
      window.history.replaceState({}, "", window.location.pathname);
    }

    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const search = (value: string) => {
    setShowHome(false);
    setWorkspace(false);
    analyze(value, range);
  };
  async function signOut() {
    await logout().catch(() => {});
    setUser(null);
    setPinnedRepos([]);
    setAccountOpen(false);
    setWorkspace(false);
  }
  const currentRepoKey = data?.repository.full_name.toLowerCase() || "";
  async function togglePinCurrent() {
    if (!data || !user) return;
    try {
      if (pinnedRepos.includes(currentRepoKey)) {
        const monitors = await getMonitors();
        const match = monitors.monitors.find((m: any) => m.fullName.toLowerCase() === currentRepoKey);
        if (match) await unpinRepository(match.id);
        setPinnedRepos(prev => prev.filter(x => x !== currentRepoKey));
      } else {
        await pinRepository({ owner: data.repository.owner.login, repo: data.repository.name, htmlUrl: data.repository.html_url });
        setPinnedRepos(prev => prev.includes(currentRepoKey) ? prev : [...prev, currentRepoKey]);
      }
    } catch (e) {
      setAuthMessage(e instanceof Error ? e.message : "Could not update pinned repository.");
    }
  }

  return <div className="app-shell">
    <header className="navbar">
      <div className="nav-inner">
        <button className="brand" onClick={() => { setWorkspace(false); setShowHome(true); setAuthMessage(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="RepoLens home">
          <span className="brand-mark"><span className="brand-line" /></span>
          <span>Repo<span>Lens</span></span>
        </button>
        <div className="nav-right">
          {user ? (
            <div className="account-wrap">
              <button className="account-button" onClick={() => setAccountOpen(v => !v)}>
                <img src={user.avatarUrl} alt="" />
                <span>{user.login}</span>
              </button>
              {accountOpen && <div className="account-menu">
                <div className="account-summary">
                  <img src={user.avatarUrl} alt="" />
                  <div><strong>{user.name || user.login}</strong><span>@{user.login}</span></div>
                </div>
                <button onClick={() => { setWorkspace(true); setAccountOpen(false); }}><LayoutDashboard size={15} /> My workspace</button>
                <a href={user.htmlUrl} target="_blank" rel="noreferrer"><UserRound size={15} /> GitHub profile ↗</a>
                <div className="menu-divider" />
                <button onClick={signOut}><LogOut size={15} /> Sign out</button>
              </div>}
            </div>
          ) : (
            <button className="sign-in" onClick={() => setSignInOpen(true)}><Github size={16} /> Sign in with GitHub</button>
          )}
        </div>
      </div>
    </header>

    {signInOpen && !user && (
      <div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="signin-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSignInOpen(false); }}>
        <div className="auth-modal">
          <button className="auth-close" onClick={() => setSignInOpen(false)} aria-label="Close sign in"><X size={16} /></button>
          <div className="auth-icon"><Github size={22} /></div>
          <span className="auth-kicker">REPOLENS ACCESS</span>
          <h2 id="signin-title">Sign in with GitHub</h2>
          <p className="auth-copy">Create a small RepoLens workspace to pin repositories and keep an eye on projects you care about.</p>
          <div className="auth-points">
            <div><ShieldCheck size={15} /><span>GitHub handles your password and authentication.</span></div>
            <div><LockKeyhole size={15} /><span>RepoLens requests <strong>profile read access only</strong>.</span></div>
            <div><Github size={15} /><span>Your GitHub access token is not stored in RepoLens's local student-project database.</span></div>
          </div>
          <button className="auth-continue" onClick={signInWithGitHub}><Github size={17} /> Continue with GitHub <ArrowRight size={15} /></button>
          <p className="student-note">RepoLens is a student-built project. Sign in is only used to identify your GitHub account and unlock the personal workspace.</p>
          <div className="auth-source-links"><a href="https://github.com/SwarajAmbawade/RepoLens" target="_blank" rel="noreferrer">View source ↗</a><span>·</span><button onClick={() => setSignInOpen(false)}>Cancel</button></div>
        </div>
      </div>
    )}

    {authMessage && (
      <div className="auth-notice">
        <Bell size={15} />
        <span>{authMessage}</span>
        <button onClick={() => setAuthMessage(null)}><X size={14} /></button>
      </div>
    )}

    {workspace && user ? (
      <Workspace user={user} onAnalyze={search} />
    ) : showHome || !data ? (
      <Home onSearch={search} loading={loading} error={error} />
    ) : (
      <Dashboard data={data} loading={loading} error={error} user={user} isPinned={pinnedRepos.includes(currentRepoKey)} onSearch={search} onRangeChange={changeRange} onTogglePin={togglePinCurrent} onRequestSignIn={() => setSignInOpen(true)} />
    )}

    <footer>
      <div className="footer-main">
        <span>RepoLens</span><b>·</b><span>GitHub repository intelligence</span><b>·</b><span>Built in 2026</span>
      </div>
      <div className="footer-links">
        <a href="https://github.com/SwarajAmbawade" target="_blank" rel="noreferrer"><Github size={13} /> GitHub</a>
        {import.meta.env.VITE_PORTFOLIO_URL && <a href={import.meta.env.VITE_PORTFOLIO_URL} target="_blank" rel="noreferrer">Portfolio ↗</a>}
        <a href="https://github.com/SwarajAmbawade/RepoLens" target="_blank" rel="noreferrer">RepoLens source ↗</a>
      </div>
    </footer>
  </div>;
}
