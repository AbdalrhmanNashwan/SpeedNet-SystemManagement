import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { useT } from "@/i18n";

type Backup = { name: string; size_bytes: number; mtime: number };
type BackupList = { dir: string; count: number; backups: Backup[] };

function useBackups() {
  return useQuery({
    queryKey: ["backups"],
    queryFn: async () => (await api.get<BackupList>("/backups")).data,
  });
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime(mtime: number) {
  return new Date(mtime * 1000).toLocaleString();
}

export default function Backups() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useBackups();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);

  const runBackup = useMutation({
    mutationFn: async () => (await api.post("/backups/run")).data,
    onSuccess: (d: { created: string }) => {
      toast.success(t("Backup created: {name}", { name: d.created }));
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: () => toast.error(t("Backup failed")),
  });

  const restore = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await api.post("/backups/restore?confirm=true", form)).data;
    },
    onSuccess: (d: { restored: Record<string, number> }) => {
      const total = Object.values(d.restored || {}).reduce((a, b) => a + b, 0);
      toast.success(t("Restored {n} rows from backup", { n: total }));
      qc.invalidateQueries();
      setPending(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || t("Restore failed")),
  });

  const download = async (name: string) => {
    try {
      // name goes in the query string, not the path: ad-blocker extensions
      // silently blank out XHRs whose URL path ends in ".zip"
      const res = await api.get("/backups/download", {
        params: { name }, responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      // delay revocation so the browser has started the download
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast.error(t("Download failed"));
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && !f.name.endsWith(".zip")) {
      toast.error(t("Please choose a backup .zip file"));
      e.target.value = "";
      return;
    }
    setPending(f);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text">{t("Backups")}</h1>
      <p className="text-muted text-sm mt-1">
        {t("Download a snapshot of all data, or restore the database from a backup archive. Archives are named by date & time")}
        {" "}(<code className="text-muted2">backup_YYYYMMDD_HHMMSS.zip</code>).
      </p>

      {/* Create */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => runBackup.mutate()}
          disabled={runBackup.isPending}
          className="px-4 py-2 rounded-lg bg-blue text-white text-sm font-semibold disabled:opacity-50">
          {runBackup.isPending ? t("Creating…") : t("Create backup now")}
        </button>
      </div>

      {/* Restore — destructive */}
      <div className="mt-8 rounded-xl border border-red/40 bg-red/5 p-4">
        <h2 className="text-sm font-bold text-red">{t("Restore from backup")}</h2>
        <p className="text-xs text-muted mt-1 leading-snug">
          <strong>{t("Destructive.")}</strong> {t("This wipes and reloads every data table (towers, devices, IP allocations…) from the uploaded archive. User accounts are left untouched. This cannot be undone — take a fresh backup first if unsure.")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            onChange={onPick}
            className="text-xs text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-bg2 file:text-text file:text-xs file:font-semibold"
          />
          <button
            onClick={() => {
              if (!pending) return;
              if (
                window.confirm(
                  t('Replace ALL current data with "{name}"? This cannot be undone.', { name: pending.name }),
                )
              )
                restore.mutate(pending);
            }}
            disabled={!pending || restore.isPending}
            className="px-4 py-2 rounded-lg bg-red text-white text-sm font-semibold disabled:opacity-40">
            {restore.isPending ? t("Restoring…") : t("Restore database")}
          </button>
        </div>
        {pending && (
          <p className="text-[11px] text-muted2 mt-2">{t("Selected: {name}", { name: pending.name })}</p>
        )}
      </div>

      {/* List */}
      <h2 className="text-sm font-bold text-text mt-8 mb-2">
        {t("Existing backups")} {data ? `(${data.count})` : ""}
      </h2>
      {isLoading ? (
        <div className="text-muted text-sm">{t("Loading…")}</div>
      ) : !data?.backups.length ? (
        <div className="text-muted text-sm">{t("No backups yet.")}</div>
      ) : (
        <div className="rounded-xl border border-line overflow-hidden">
          {data.backups.map((b) => (
            <div
              key={b.name}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-line/40 last:border-0 text-sm">
              <span className="font-mono text-text truncate">{b.name}</span>
              <span className="text-muted2 text-xs ms-auto whitespace-nowrap">
                {fmtTime(b.mtime)}
              </span>
              <span className="text-muted2 text-xs whitespace-nowrap w-16 text-end">
                {fmtSize(b.size_bytes)}
              </span>
              <button
                onClick={() => download(b.name)}
                className="text-xs text-cyan hover:underline whitespace-nowrap">
                {t("Download")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
