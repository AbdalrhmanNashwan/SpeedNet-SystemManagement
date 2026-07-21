import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useT } from "@/i18n";
import { toast } from "@/lib/toast";

// Fallback view when the tower has no coordinates yet: roughly centered on Iraq.
const FALLBACK_CENTER: [number, number] = [34.5, 43.5];
const FALLBACK_ZOOM = 6;
const PICK_ZOOM = 15;

/** Round to ~1cm precision; keeps the stored string tidy. */
function fmt(n: number): string {
  return n.toFixed(6);
}

function parse(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Both must parse and fall inside valid earth ranges to seed the marker. */
function initialPoint(lat?: string | null, lng?: string | null): [number, number] | null {
  const la = parse(lat);
  const ln = parse(lng);
  if (la == null || ln == null) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if (la === 0 && ln === 0) return null;
  return [la, ln];
}

/** Captures map clicks and reports the clicked coordinate up to the picker. */
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Recenters the map when `target` changes (used after "use my location"). */
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  if (target) map.setView(target, Math.max(map.getZoom(), PICK_ZOOM));
  return null;
}

/**
 * Modal map for choosing a tower's GPS location. Click anywhere to drop / move
 * the marker; the live lat/lng update immediately. "Save" hands the two values
 * back to the caller, which persists them (subject to the same write scoping as
 * any other tower edit — this component never talks to the API directly).
 */
export function LocationPicker({
  lat, lng, onCancel, onSave,
}: {
  lat?: string | null;
  lng?: string | null;
  onCancel: () => void;
  onSave: (lat: string, lng: string) => Promise<void> | void;
}) {
  const t = useT();
  const seed = initialPoint(lat, lng);
  const [point, setPoint] = useState<[number, number] | null>(seed);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [saving, setSaving] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("Location is not available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPoint(p);
        setFlyTarget(p);
      },
      () => toast.error(t("Couldn't get your location")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async () => {
    if (!point) return;
    setSaving(true);
    try {
      await onSave(fmt(point[0]), fmt(point[1]));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="card w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h2 className="font-extrabold">{t("Pick location on map")}</h2>
          <button onClick={onCancel} className="text-muted hover:text-text text-lg leading-none" aria-label={t("Close")}>
            ✕
          </button>
        </div>

        <div style={{ height: "60vh" }}>
          <MapContainer
            center={seed ?? FALLBACK_CENTER}
            zoom={seed ? PICK_ZOOM : FALLBACK_ZOOM}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickCapture onPick={(la, ln) => setPoint([la, ln])} />
            <FlyTo target={flyTarget} />
            {point && (
              <CircleMarker
                center={point}
                radius={8}
                pathOptions={{ color: "#0b0f17", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.9 }}
              />
            )}
          </MapContainer>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-line">
          <span className="text-sm text-muted">
            {point ? (
              <span className="font-mono">{fmt(point[0])}, {fmt(point[1])}</span>
            ) : (
              t("Click the map to drop a marker")
            )}
          </span>
          <button onClick={useMyLocation} className="text-xs text-cyan hover:underline">
            {t("Use my current location")}
          </button>
          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-sm text-muted hover:text-text px-3 py-1.5"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={save}
              disabled={!point || saving}
              className="text-sm font-bold px-3 py-1.5 rounded-lg bg-blue text-white disabled:opacity-50"
            >
              {saving ? t("Saving…") : t("Save location")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
