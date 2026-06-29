import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-12"
        style={{ background: "linear-gradient(160deg,#0d1f3c 0%,#071528 100%)", borderRight: "1px solid var(--line)" }}>
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-8 h-8 rounded-lg bg-cyan/20 border border-cyan/40 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" fill="#22d3ee" />
                <circle cx="8" cy="8" r="6.5" stroke="#22d3ee" strokeWidth="1" opacity=".4" />
                <circle cx="8" cy="8" r="9" stroke="#22d3ee" strokeWidth="0.5" opacity=".2" />
              </svg>
            </div>
            <span className="text-cyan font-extrabold text-xl tracking-tight">SPEEDNeT</span>
          </div>
          <h2 className="text-3xl font-extrabold leading-snug text-text mb-4">
            Network<br />Management<br />Console
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            Monitor and manage your tower network — switches, sectors, links and more — from a single interface.
          </p>
        </div>
        <div className="space-y-3">
          {[["175", "Towers"], ["403", "PTP Links"], ["914", "Sectors"]].map(([n, l]) => (
            <div key={l} className="flex items-center gap-3">
              <span className="text-cyan font-extrabold text-lg w-12">{n}</span>
              <span className="text-muted text-sm">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-cyan/20 border border-cyan/40 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" fill="#22d3ee" />
                <circle cx="8" cy="8" r="6.5" stroke="#22d3ee" strokeWidth="1" opacity=".4" />
              </svg>
            </div>
            <span className="text-cyan font-extrabold text-lg">SPEEDNeT</span>
          </div>

          <h1 className="text-2xl font-extrabold text-text mb-1">Sign in</h1>
          <p className="text-muted text-sm mb-8">Enter your credentials to continue</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted2 uppercase tracking-widest mb-2">
                Email address
              </label>
              <input
                type="email" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@speednet.iq"
                className="w-full bg-panel border border-line rounded-xl px-4 py-3 text-sm text-text placeholder-muted2 outline-none transition-colors focus:border-blue focus:bg-panel2"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted2 uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-panel border border-line rounded-xl px-4 py-3 text-sm text-text placeholder-muted2 outline-none transition-colors focus:border-blue focus:bg-panel2"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red/10 border border-red/30 rounded-xl px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                  <circle cx="7" cy="7" r="6.5" stroke="#fb7185" />
                  <path d="M7 4v3.5M7 9.5v.5" stroke="#fb7185" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span className="text-red text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full mt-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              style={{ background: loading ? "var(--blue)" : "linear-gradient(135deg,#3b82f6,#22d3ee)", color: "#fff" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
                    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
