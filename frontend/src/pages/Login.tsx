import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useParallax } from "@/hooks/useParallax";
import { useT } from "@/i18n";

export default function Login() {
  const { login } = useAuth();
  const t = useT();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const scene = useParallax<HTMLDivElement>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch {
      setError(t("Invalid email or password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding (desktop only) with animated 3D scene */}
      <div ref={scene}
        className="hidden lg:flex fx-scene flex-col justify-between w-[440px] shrink-0 p-12"
        style={{ background: "var(--panel)", borderRight: "1px solid var(--line)" }}>
        {/* GPU-cheap animated backdrop, layered for pointer-parallax depth */}
        <div className="fx-aurora fx-par fx-par-1" aria-hidden />
        <div className="fx-grid fx-par fx-par-2" aria-hidden />
        <div className="fx-particles" aria-hidden>
          <i /><i /><i /><i /><i /><i />
        </div>

        {/* rotating 3D network sphere */}
        <div className="absolute inset-x-0 top-[20%] flex justify-center fx-par fx-par-3 pointer-events-none" aria-hidden>
          <div className="sphere">
            <span className="ring" /><span className="ring" /><span className="ring" />
            <span className="ring" /><span className="ring" /><span className="ring" /><span className="ring" />
            <span className="core" />
          </div>
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="fx-emblem relative w-12 h-12 rounded-2xl bg-panel2 border border-line2 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" fill="var(--blue)" />
                <circle cx="8" cy="8" r="6.5" stroke="var(--blue)" strokeWidth="1" opacity=".4" />
                <circle cx="8" cy="8" r="9" stroke="var(--blue)" strokeWidth="0.5" opacity=".2" />
              </svg>
            </div>
            <span className="text-cyan font-extrabold text-2xl tracking-tight">SPEEDNeT</span>
          </div>
          <h2 className="text-3xl font-semibold leading-[1.2] text-text mb-4">
            {t("Network")}<br />{t("Management")}<br />
            <span className="text-cyan">{t("Console")}</span>
          </h2>
          <p className="text-muted text-sm leading-relaxed max-w-[20rem]">
            {t("Monitor and manage your tower network — switches, sectors, links and more — from a single interface.")}
          </p>
        </div>
        <div className="relative">
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[["175", "Towers"], ["403", "PTP Links"], ["914", "Sectors"]].map(([n, l]) => (
              <div key={l} className="bg-panel2 border border-line rounded-xl px-3 py-3 text-center">
                <div className="text-text font-semibold text-2xl leading-none font-mono">{n}</div>
                <div className="text-muted2 text-[11px] uppercase tracking-widest mt-1.5">{t(l)}</div>
              </div>
            ))}
          </div>
          <div className="pt-5 border-t border-line/60">
            <p className="text-muted2 text-[11px] uppercase tracking-widest mb-1">{t("Designed & developed by")}</p>
            <p className="text-text text-sm font-bold">Abdalrhman Nashwan Natheer</p>
            <a href="mailto:abdalrhmannash.dev@gmail.com"
              className="inline-flex items-center gap-1.5 mt-1.5 text-cyan text-xs hover:underline">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" />
                <path d="M2 4l6 4.5L14 4" stroke="currentColor" strokeLinecap="round" />
              </svg>
              abdalrhmannash.dev@gmail.com
            </a>
            <a href="https://t.me/Abdalrhman20dev" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1.5 ml-3 text-cyan text-xs hover:underline">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M14.5 2.2 1.8 7.1c-.6.24-.6.86 0 1.05l3.05.95 1.18 3.7c.16.42.5.5.82.24l1.7-1.4 3.35 2.47c.4.3.9.1 1-.42l1.9-9.1c.13-.6-.36-1.05-.8-.9Z" stroke="currentColor" strokeLinejoin="round" />
              </svg>
              @Abdalrhman20dev
            </a>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <span className="text-cyan font-extrabold text-lg">SPEEDNeT</span>
          </div>

          <h1 className="text-2xl font-extrabold text-text mb-1">{t("Sign in")}</h1>
          <p className="text-muted text-sm mb-8">{t("Enter your credentials to continue")}</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted2 uppercase tracking-widest mb-2">
                {t("Email address")}
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
                {t("Password")}
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
              className="w-full mt-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              style={{ background: "var(--blue)", color: "#fff" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
                    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {t("Signing in…")}
                </span>
              ) : t("Sign in")}
            </button>
          </form>

          <p className="text-center text-muted2 text-xs mt-10">
            {t("Designed & developed by")}{" "}
            <span className="text-muted font-semibold">Abdalrhman Nashwan Natheer</span>
            <br />
            <a href="mailto:abdalrhmannash.dev@gmail.com"
              className="text-cyan hover:underline">abdalrhmannash.dev@gmail.com</a>
            {" · "}
            <a href="https://t.me/Abdalrhman20dev" target="_blank" rel="noopener noreferrer"
              className="text-cyan hover:underline">@Abdalrhman20dev</a>
          </p>
        </div>
      </div>
    </div>
  );
}
