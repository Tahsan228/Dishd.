export type TextPart = { text: string; href?: string; external?: boolean };
/** A small text format, never HTML. Mentions and kitchen links remain navigable. */
export function reviewText(text: string): TextPart[] {
  const pattern = /\[([^\]\n]{1,100})\]\((\/k\/[a-z0-9-]+)\)|https:\/\/[^\s<>]+|(?<![\w@])@[a-zA-Z0-9_]{3,30}\b/g;
  const result: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    if (index > cursor) result.push({ text: text.slice(cursor, index) });
    const value = match[0];
    if (match[1] && match[2]) result.push({ text: match[1], href: match[2] });
    else if (value.startsWith("@")) result.push({ text: value, href: "/u/" + encodeURIComponent(value.slice(1)) });
    else {
      const clean = value.replace(/[.,!?;:)]+$/, "");
      try {
        const url = new URL(clean);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error("Unsafe link");
        result.push({ text: clean, href: url.href, external: true });
        if (value.length > clean.length) result.push({ text: value.slice(clean.length) });
      } catch { result.push({ text: value }); }
    }
    cursor = index + value.length;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor) });
  return result;
}
