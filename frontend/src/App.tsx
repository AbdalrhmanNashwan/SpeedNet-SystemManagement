import { useState, type ReactNode } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import ZonePage from "@/pages/ZonePage";
import TowerList from "@/pages/TowerList";
import TowerDetail from "@/pages/TowerDetail";
import DeviceList from "@/pages/DeviceList";
import SearchResults from "@/pages/SearchResults";
import Monitor from "@/pages/Monitor";
import IpAllocations from "@/pages/IpAllocations";
import History from "@/pages/History";
import Users from "@/pages/Users";
import { Toaster } from "@/components/Toaster";
import { ThemeToggle } from "@/components/ThemeToggle";

function Guard({ children, adminOnly, editorOnly }: { children: ReactNode; adminOnly?: boolean; editorOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  if (editorOnly && user.role !== "admin" && user.role !== "editor") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const links = [
    { to: "/towers", label: "Towers" },
    { to: "/devices/links", label: "P2P" },
    { to: "/devices/switches", label: "Switches" },
    { to: "/devices/sectors", label: "Sectors" },
    { to: "/monitor", label: "Monitor" },
    ...(user.role === "admin" ? [{ to: "/history", label: "History" }, { to: "/users", label: "Users" }] : []),
  ];

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm ${isActive ? "text-text" : "text-muted"} hover:text-text`;

  const search = (extra = "") => (
    <form className={`flex gap-2 ${extra}`}
      onSubmit={(e) => { e.preventDefault(); setOpen(false); nav(`/search?q=${encodeURIComponent(q)}`); }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search anything…"
        className="bg-bg2 border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue w-full sm:w-52" />
    </form>
  );

  return (
    <header className="border-b border-line bg-panel sticky top-0 z-40">
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3">
        <NavLink to="/" onClick={() => setOpen(false)} className="text-cyan font-extrabold text-lg tracking-tight">SPEEDNeT</NavLink>

        {/* desktop links */}
        <nav className="hidden md:flex items-center gap-4">
          {links.map((l) => <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>)}
        </nav>

        {/* desktop right cluster */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          {search()}
          <ThemeToggle />
          <button onClick={logout} className="text-xs text-muted hover:text-red whitespace-nowrap">{user.email} · Sign out</button>
        </div>

        {/* mobile controls */}
        <div className="flex items-center gap-2 ml-auto md:hidden">
          <ThemeToggle />
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-line2 text-text">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* mobile dropdown menu */}
      {open && (
        <div className="md:hidden px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-line">
          <nav className="flex flex-col">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
                className={({ isActive }) => `py-2.5 text-sm border-b border-line/40 ${isActive ? "text-cyan font-bold" : "text-muted"}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          {search("mt-1")}
          <button onClick={() => { setOpen(false); logout(); }}
            className="text-left text-sm text-red py-1">{user.email} · Sign out</button>
        </div>
      )}
    </header>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<Guard><Home /></Guard>} />
        <Route path="/zone/:id" element={<Guard><ZonePage /></Guard>} />
        <Route path="/towers" element={<Guard><TowerList /></Guard>} />
        <Route path="/tower/:id" element={<Guard><TowerDetail /></Guard>} />
        <Route path="/devices/:type" element={<Guard><DeviceList /></Guard>} />
        <Route path="/search" element={<Guard><SearchResults /></Guard>} />
        <Route path="/monitor" element={<Guard><Monitor /></Guard>} />
        <Route path="/ip-allocations" element={<Guard editorOnly><IpAllocations /></Guard>} />
        <Route path="/history" element={<Guard adminOnly><History /></Guard>} />
        <Route path="/users" element={<Guard adminOnly><Users /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster />
    </AuthProvider>
  );
}
