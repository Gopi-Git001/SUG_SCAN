// Turns a sugar list from the server into clean ingredient names for the result panel.

const MAX_NAME_LENGTH = 40;

/** Not an ingredient name: amounts ("41 g added per serving"), units, or long sentences. */
function isIngredientName(item: string) {
  return !/\d/.test(item) && !/\bg\b/i.test(item) && !/per serving/i.test(item) && item.length <= MAX_NAME_LENGTH;
}

/**
 * "high fructose corn syrup" → "High Fructose Corn Syrup". Short all-caps words (HFCS, K) stay as printed,
 * unless the whole name is in capitals ("HIGH FRUCTOSE CORN SYRUP"), which is just how the label prints it.
 */
export function titleCase(name: string) {
  const words = name.trim().split(/\s+/);
  const allCaps = words.length > 1 && name === name.toUpperCase();
  const isAcronym = (w: string) => !allCaps && w.length <= 4 && w === w.toUpperCase();
  return words.map((w) => (isAcronym(w) ? w : w.replace(/\p{L}[^\s-]*/gu, cap))).join(' ');
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/** Ingredient names only, Title Case, no duplicates (case-insensitive, first spelling wins). */
export function ingredientNames(items: string[]) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of items) {
    const name = item.trim();
    if (!name || !isIngredientName(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(titleCase(name));
  }
  return names;
}
