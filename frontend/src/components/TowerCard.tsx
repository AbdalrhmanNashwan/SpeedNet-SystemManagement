import { Link } from "react-router-dom";
import { useT } from "@/i18n";
import type { Tower } from "@/types";

export function TowerCard({ tower }: { tower: Tower }) {
  const t = useT();
  const sc = (tower.status || "Active").toLowerCase().replace(/[^a-z]/g, "-");
  const meta = [tower.area, tower.user_count && t("{n} users", { n: tower.user_count }), tower.link_type]
    .filter(Boolean).join(" · ");
  return (
    <Link to={`/tower/${tower.id}`} className="card p-4 block">
      <span className={`status ${sc}`}>{tower.status}</span>
      <div className="text-[15px] font-extrabold mt-2 mb-1 break-words">{tower.name}</div>
      <div className="text-[11px] text-muted min-h-[26px] leading-snug">{meta || "\u00A0"}</div>
    </Link>
  );
}
