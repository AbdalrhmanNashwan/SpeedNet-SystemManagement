import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar } from "./ar";

export type Lang = "en" | "ar";
const KEY = "speednet:lang";

type Ctx = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Translate a source (English) string. Falls back to the key itself.
   *  Supports {var} interpolation: t("{n} towers", { n: 5 }). */
  t: (s: string, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<Ctx | null>(null);

function interpolate(out: string, vars?: Record<string, string | number>) {
  if (!vars) return out;
  for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem(KEY) as Lang) || "en",
  );
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = dir;
  }, [lang, dir]);

  const value = useMemo<Ctx>(() => {
    const setLang = (l: Lang) => {
      setLangState(l);
      localStorage.setItem(KEY, l);
    };
    const t = (s: string, vars?: Record<string, string | number>) => {
      const out = lang === "ar" ? ar[s] ?? s : s;
      return interpolate(out, vars);
    };
    return { lang, dir, setLang, toggle: () => setLang(lang === "ar" ? "en" : "ar"), t };
  }, [lang, dir]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used within <LanguageProvider>");
  return ctx;
}

/** Convenience: just the translate function. */
export function useT() {
  return useI18n().t;
}
