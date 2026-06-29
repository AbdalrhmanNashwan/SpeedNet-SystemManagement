import { Fragment } from "react";
import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;          // omit on the last/current crumb
  icon?: string;
}

/**
 * Renders a clickable path trail (Home › Zone › Tower › Section › Device).
 * Every crumb except the current one is a link, so you can step back up the
 * tree one level at a time.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center flex-wrap gap-1 text-sm mb-6" aria-label="Breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        const body = (
          <span className={last ? "text-text font-bold" : "text-muted hover:text-cyan"}>
            {c.icon && <span className="mr-1">{c.icon}</span>}
            {c.label}
          </span>
        );
        return (
          <Fragment key={i}>
            {c.to && !last ? <Link to={c.to}>{body}</Link> : body}
            {!last && <span className="text-muted2 mx-0.5">›</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}
