import { useI18n } from "@/i18n";

/** EN ⇄ AR switch. Shows the language you'll switch TO. */
export function LanguageToggle() {
  const { lang, toggle } = useI18n();
  return (
    <button
      onClick={toggle}
      title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      aria-label="Toggle language"
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-line2 text-muted hover:text-text text-xs font-extrabold">
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}
