// Pure layout decisions for the result panel, kept separate so they can be unit tested.

const BREAK_CHARS = /[\s\-/]/;

/**
 * True if `text`, laid out as `lines` (the line texts the device reported), fits in at most 2 lines
 * and every line break falls between words, never inside one.
 */
export function fitsTwoLines(text: string, lines: string[]) {
  if (lines.length > 2) return false;
  let offset = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    offset += lines[i].length;
    const before = text[offset - 1];
    const after = text[offset];
    if (before && after && !BREAK_CHARS.test(before) && !BREAK_CHARS.test(after)) return false;
  }
  return true;
}

export type MeasuredRow = { kind: 'verdict' | 'title' | 'items'; bottom: number; items: number };

/**
 * How many rows fit above `limit` (px from the panel top). If not all of them fit, room is kept for a
 * "+N more" pill of `moreHeight` after a `gap`, and a section title is never left without items under it.
 */
export function planCut(rows: MeasuredRow[], limit: number, moreHeight: number, gap: number) {
  if (rows.length === 0 || rows[rows.length - 1].bottom <= limit) return { visible: rows.length, hidden: 0 };
  let visible = rows.length;
  while (visible > 1 && rows[visible - 1].bottom + gap + moreHeight > limit) visible--;
  while (visible > 1 && rows[visible - 1].kind === 'title') visible--;
  const hidden = rows.slice(visible).reduce((n, r) => n + r.items, 0);
  return { visible, hidden };
}
