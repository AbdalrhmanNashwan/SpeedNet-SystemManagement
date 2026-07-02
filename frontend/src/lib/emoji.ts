// Zone icons are free-text ("Icon (emoji)" field). Older rows contain plain
// words like "broadcast" that would render as giant text — only show the value
// when it actually looks like an emoji/pictograph, otherwise drop it.
export function emojiIcon(icon?: string | null): string | null {
  if (!icon) return null;
  const s = icon.trim();
  if (!s) return null;
  // plain ASCII word (letters/digits/space/dash/underscore) → not an emoji
  if (/^[A-Za-z0-9 _-]+$/.test(s)) return null;
  return s;
}
