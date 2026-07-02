import { useEffect, useRef } from "react";

/**
 * Pointer-driven parallax. Returns a ref to attach to a container; on mouse
 * move it sets `--mx` / `--my` (-1..1) CSS variables, which child layers read
 * (see `.fx-par-*` in tokens.css). Cheap & reliable: updates are batched into a
 * single requestAnimationFrame, write only two CSS vars, and trigger no React
 * re-renders. Disabled on touch / coarse pointers and under reduced-motion.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calm) return;

    let raf = 0;
    let mx = 0, my = 0;

    const apply = () => {
      raf = 0;
      el.style.setProperty("--mx", mx.toFixed(3));
      el.style.setProperty("--my", my.toFixed(3));
    };
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 2 - 1;   // -1 .. 1
      my = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      mx = 0; my = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
