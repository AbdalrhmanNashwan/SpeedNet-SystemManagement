import { useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { useT } from "@/i18n";

const CUSTOM = "__custom__";

type CopyMsgs = { copied: string; unsupported: string; failed: string };

async function copy(text: string, m: CopyMsgs) {
  // navigator.clipboard only exists in a secure context (HTTPS or localhost).
  // Over plain HTTP on the LAN (e.g. a phone) it's undefined, so fall back to
  // a temporary <textarea> + execCommand("copy").
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast.success(m.copied);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) toast.success(m.copied);
    else toast.error(m.unsupported);
  } catch {
    toast.error(m.failed);
  }
}

/**
 * Single-click copies the value to the clipboard; double-click edits it inline.
 * Calls onSave(newValue) which should fire a mutation. Read-only when `canEdit`
 * is false (single-click still copies).
 *
 * When `options` is provided, the editor is a dropdown (reduces typos on fields
 * with a known set of values). Picking an option saves immediately. The list
 * always includes a "✎ custom…" escape so an unusual value can still be typed.
 */
export function EditableField({
  value, onSave, canEdit = true, mono = false, placeholder = "—", options,
}: {
  value: string | null | undefined;
  onSave: (v: string) => Promise<void> | void;
  canEdit?: boolean;
  mono?: boolean;
  placeholder?: string;
  options?: string[];
}) {
  const t = useT();
  const copyMsgs = { copied: t("Copied"), unsupported: t("Copy not supported here"), failed: t("Copy failed") };
  const [editing, setEditing] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startEdit = () => { setDraft(value ?? ""); setCustomMode(false); setEditing(true); };

  // Single click → copy (after a short delay so a double-click can cancel it).
  const onSingleClick = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { if (value) copy(value, copyMsgs); }, 220);
  };
  const onDoubleClick = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (canEdit) startEdit();
  };

  if (!canEdit) {
    return (
      <span
        onClick={onSingleClick}
        className={`cursor-pointer rounded px-1 -mx-1 hover:bg-panel2 ${mono ? "font-mono" : ""} ${!value ? "text-muted2" : ""}`}
        title={t("Click to copy")}
      >
        {value || placeholder}
      </span>
    );
  }
  if (!editing) {
    return (
      <span
        onClick={onSingleClick}
        onDoubleClick={onDoubleClick}
        className={`cursor-pointer rounded px-1 -mx-1 hover:bg-panel2 ${mono ? "font-mono" : ""} ${!value ? "text-muted2" : ""}`}
        title={t("Click to copy · double-click to edit")}
      >
        {value || placeholder}
      </span>
    );
  }

  const commit = async (v: string) => {
    setSaving(true);
    try { await onSave(v.trim()); setEditing(false); setCustomMode(false); }
    finally { setSaving(false); }
  };

  // Dropdown editor (unless the user chose the custom escape)
  if (options && !customMode) {
    const opts = value && !options.includes(value) ? [value, ...options] : options;
    return (
      <select
        autoFocus
        disabled={saving}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === CUSTOM) { setDraft(value ?? ""); setCustomMode(true); return; }
          commit(v);
        }}
        onBlur={() => setEditing(false)}
        className="bg-bg2 border border-blue rounded px-2 py-0.5 outline-none w-full"
      >
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={CUSTOM}>{t("✎ custom…")}</option>
      </select>
    );
  }

  // Free-text editor
  return (
    <input
      autoFocus
      disabled={saving}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(draft);
        if (e.key === "Escape") { setEditing(false); setCustomMode(false); }
      }}
      className="bg-bg2 border border-blue rounded px-2 py-0.5 outline-none w-full"
    />
  );
}
