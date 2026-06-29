import { useState } from "react";
import { useCreateZone, useUpdateZone } from "@/hooks/useZones";
import { ZONE_COLOR_OPTIONS, ZONE_RULE_FIELD_OPTIONS } from "@/lib/fieldOptions";
import type { Zone } from "@/types";

// Maps a color token to a swatch background. The color is purely cosmetic — it
// tints the zone's bubble (border + label) on the Home screen. It is optional.
const SWATCH: Record<string, string> = {
  cyan: "bg-cyan", blue: "bg-blue", green: "bg-green", yellow: "bg-yellow",
  orange: "bg-orange", purple: "bg-purple", red: "bg-red",
};
const RULE_FIELDS = ["", ...ZONE_RULE_FIELD_OPTIONS];

/** Add (zone=null) or edit an existing zone. */
export function ZoneDialog({ zone, onClose }: { zone: Zone | null; onClose: () => void }) {
  const create = useCreateZone();
  const update = useUpdateZone();
  const [form, setForm] = useState<Partial<Zone>>(
    zone ?? { name: "", color: null, sort_order: 0 }
  );

  const set = (k: keyof Zone, v: string | number | null) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name ?? "",
      tag: form.tag ?? null,
      color: form.color ?? null,
      icon: form.icon ?? null,
      sort_order: form.sort_order ?? 0,
      rule_field: form.rule_field || null,
      rule_value: form.rule_value || null,
    };
    if (zone) await update.mutateAsync({ id: zone.id, patch: payload });
    else await create.mutateAsync(payload as Omit<Zone, "id">);
    onClose();
  };

  const busy = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-8 w-full max-w-md">
        <h2 className="text-lg font-extrabold mb-6">{zone ? "Edit Zone" : "Add Zone"}</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Name *" required value={form.name ?? ""} onChange={(v) => set("name", v)} />
          <Field label="Tag" value={form.tag ?? ""} onChange={(v) => set("tag", v)} />
          <Field label="Icon (emoji)" value={form.icon ?? ""} onChange={(v) => set("icon", v)} />
          <div>
            <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">
              Color <span className="text-muted2 normal-case font-normal">(optional — tints the bubble on Home)</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => set("color", null)}
                title="No color"
                className={`w-7 h-7 rounded-full border grid place-items-center text-[10px] text-muted ${!form.color ? "border-blue ring-2 ring-blue/40" : "border-line"}`}>✕</button>
              {ZONE_COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => set("color", c)} title={c}
                  className={`w-7 h-7 rounded-full ${SWATCH[c]} ${form.color === c ? "ring-2 ring-offset-2 ring-offset-bg ring-white" : ""}`} />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">Rule field</label>
              <select value={form.rule_field ?? ""} onChange={(e) => set("rule_field", e.target.value || null)}
                className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue">
                {RULE_FIELDS.map((r) => <option key={r} value={r}>{r || "— none —"}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <Field label="Rule value" value={form.rule_value ?? ""} onChange={(v) => set("rule_value", v)} />
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-line text-muted text-sm hover:border-line2">Cancel</button>
            <button type="submit" disabled={busy}
              className="flex-1 py-2 rounded-lg bg-blue text-white text-sm font-bold disabled:opacity-50">
              {busy ? "Saving…" : zone ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-xs text-muted2 uppercase tracking-wide font-bold mb-1 block">{label}</label>
      <input required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-blue" />
    </div>
  );
}
