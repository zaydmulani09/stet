// Guards against suggestions that put new experiences in a student's mouth.
// Bracketed placeholders like [what she said] are allowed: they ask the student to fill in.

const STOP = new Set(
  'a an the and or but so of to in on at for with from by as is are was were be been being it its this that these those i me my mine you your we our they them their he him his she her who whom what which when where why how not no yes do did does done have has had can could would should will just also than then there here into onto about after before over under again once very really more most some any each every all both few many much such own same other only too out up down off now ever never always one two three'.split(' '),
);

function stripPlaceholders(s: string): string {
  return s.replace(/\[[^\]]*\]/g, ' ');
}

const tokens = (s: string) => s.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];

/** Numbers and capitalized words (not sentence-initial) in `s` that never appear in `source`. */
export function newSpecifics(s: string, source: string): string[] {
  const src = new Set(tokens(source).map((t) => t.toLowerCase()));
  const out = new Set<string>();
  const body = stripPlaceholders(s);
  // Capitalized words anywhere (common words like "After" are skipped via STOP or the essay's own vocabulary).
  for (const m of body.matchAll(/\b([A-Z][\p{L}'’]*)|(\$?\d+(?:[.,]\d+)*)/gu)) {
    const raw = m[1] ?? m[2];
    const word = raw.replace(/^\$/, '').toLowerCase();
    if (raw === 'I' || STOP.has(word) || src.has(word)) continue;
    out.add(raw);
  }
  return [...out];
}

/**
 * True when an illustrative example brings in material the essay does not contain: new names
 * or numbers, or mostly new content words (which usually means an invented anecdote).
 */
export function introducesNewMaterial(example: string, essay: string): boolean {
  if (newSpecifics(example, essay).length) return true;
  const src = new Set(tokens(essay).map((t) => t.toLowerCase()));
  const content = tokens(stripPlaceholders(example)).map((t) => t.toLowerCase()).filter((t) => t.length >= 4 && !STOP.has(t));
  if (content.length < 4) return false;
  const fresh = content.filter((t) => !src.has(t) && !src.has(t.replace(/(?:ing|ed|s)$/, '')));
  return fresh.length / content.length > 0.5;
}
