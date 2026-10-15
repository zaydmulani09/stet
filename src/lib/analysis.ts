// Deterministic, reproducible text measurements. Every finding is a regex or
// arithmetic fact about the draft. None of them says who wrote it.

import { countChars, countWords, paragraphs, sentences, wordsIn, type Sentence } from './text';

export type MeasureKind =
  | 'stock_phrase'
  | 'ai_vocab'
  | 'transition'
  | 'contrast_frame'
  | 'repeated_opener'
  | 'growth_claim'
  | 'emotion_label'
  | 'intensifier'
  | 'em_dash'
  | 'opening_formula'
  | 'closing_formula';

export interface Measure {
  id: string;
  kind: MeasureKind;
  start: number;
  end: number;
  text: string;
}

export interface MeasureGroup {
  kind: MeasureKind;
  label: string;
  count: number;
  flagged: boolean;
  explanation: string;
  suggestion: string;
  items: Measure[];
}

export interface Analysis {
  words: number;
  chars: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceWords: number;
  sentenceLengthCv: number; // stdev / mean of words per sentence
  longestSentence: { n: number; words: number } | null;
  iStartShare: number; // share of sentences whose first word is "I"
  rhythmFlagged: boolean;
  groups: MeasureGroup[];
}

const A = "['’]"; // straight or curly apostrophe

const STOCK = [
  `ever since I was (?:a (?:little )?(?:kid|child)|young|little)`,
  `for as long as I can remember`,
  `from a young age`,
  `I have always been (?:passionate|fascinated|interested)`,
  `(?:my|a) passion for`,
  `make a (?:positive )?difference`,
  `make the world a better place`,
  `changed my life`,
  `(?:step(?:ped|ping)? )?out(?:side)? of my comfort zone`,
  `at the end of the day`,
  `hard work (?:pays|paid) off`,
  `(?:taught|showed) me the (?:importance|value) of`,
  `(?:a|an) (?:valuable|important) lesson`,
  `(?:made|shaped) me (?:into )?(?:who|the person) I am(?: today)?`,
  `the person I am today`,
  `never give up`,
  `follow(?:ing)? my dreams?`,
  `opened my eyes`,
  `little did I know`,
  `think(?:ing)? outside the box`,
  `in today${A}s (?:society|world)`,
  `give back to (?:my|the) community`,
  `I want to help (?:people|others)`,
  `it${A}s not about the destination`,
  `everything happens for a reason`,
  `a whole new (?:world|level)`,
  `(?:blood,? )?sweat,? and tears`,
];

const AI_VOCAB = [
  'delve[sd]?', 'delving', 'tapestry', 'testament', 'multifaceted', 'intricate', 'pivotal', 'showcas(?:e|es|ed|ing)',
  'underscor(?:e|es|ed|ing)', 'foster(?:s|ed|ing)?', 'realm', 'resonat(?:e|es|ed|ing)', 'embark(?:s|ed|ing)?',
  'invaluable', 'unwavering', 'meticulous(?:ly)?', 'commendable', 'interplay', 'ever-evolving', 'beacon',
  'transformative', 'holistic', 'nuanced', 'harness(?:es|ed|ing)?', 'elevat(?:e|es|ed|ing)', 'unlock(?:s|ed|ing)?',
  'navigat(?:e|es|ed|ing) the complexit(?:y|ies)', 'a testament to', 'plays? a (?:pivotal|crucial|vital) role',
  'serves? as a (?:reminder|testament|catalyst)',
];

const TRANSITIONS = [
  'Moreover', 'Furthermore', 'Additionally', 'In addition', 'Consequently', 'Ultimately', 'In conclusion', 'Overall',
  'To sum up', 'In summary', 'Thus', 'Therefore', 'Notably', 'Importantly', 'Indeed', 'Subsequently', 'Hence',
];

const CONTRAST = [
  `not (?:just|only|merely|simply) (?:about )?[^.?!;]{1,60}?,? but(?: also)?`,
  `(?:it|this|that)(?: ${A}s| is| was|${A}s) not (?:about )?[^.?!;]{1,40}?[;,—–-]+\\s*(?:it|this|that)(?: ${A}s| is| was|${A}s)`,
  `isn${A}t (?:just |only )?[^.?!;]{1,40}?[—–-]+\\s*it${A}s`,
];

const GROWTH = [
  `I (?:have )?learned`, `taught me`, `I (?:finally |soon )?realized`, `made me realize`, `I (?:have )?grown`,
  `I grew (?:as|into)`, `I now (?:understand|know|see)`, `I discovered that`, `this experience`, `helped me (?:grow|become|understand)`,
];

const EMOTION = [
  `I (?:felt|feel|was|became|got) (?:so |very |really |extremely |incredibly )?(?:happy|sad|nervous|anxious|scared|excited|proud|angry|frustrated|overwhelmed|grateful|thankful|terrified|devastated|confused|ecstatic)`,
];

const INTENSIFIERS = ['very', 'really', 'truly', 'extremely', 'incredibly', 'deeply', 'absolutely', 'genuinely', 'utterly'];

function rx(parts: string[], flags = 'giu'): RegExp {
  return new RegExp(`(?<![\\p{L}])(?:${parts.join('|')})(?![\\p{L}])`, flags);
}

const RE = {
  stock: rx(STOCK),
  ai: rx(AI_VOCAB),
  contrast: rx(CONTRAST),
  growth: rx(GROWTH),
  emotion: rx(EMOTION),
  intens: rx(INTENSIFIERS),
  transition: new RegExp(`^(?:${TRANSITIONS.join('|')})\\b,?`, 'iu'),
};

function scan(text: string, re: RegExp, kind: MeasureKind): Measure[] {
  const out: Measure[] = [];
  for (const m of text.matchAll(re)) {
    const start = m.index!;
    out.push({ id: `${kind}:${start}`, kind, start, end: start + m[0].length, text: m[0] });
  }
  return out;
}

function firstWord(s: Sentence): string {
  return (wordsIn(s.text)[0] ?? '').toLowerCase();
}

const INFO: Record<MeasureKind, { label: string; explanation: string; suggestion: string }> = {
  stock_phrase: {
    label: 'Stock phrases',
    explanation: 'Phrases that appear in a great many application essays. Readers have seen them so often that they slide past without registering anything about you.',
    suggestion: 'Replace the phrase with the specific moment, object or words that made you feel this way.',
  },
  ai_vocab: {
    label: 'Words that became common in AI-assisted text',
    explanation: 'These words rose sharply in published writing after 2023 (Kobak et al., Science Advances 2025). People use them too; several in one short essay can make it read as generic.',
    suggestion: 'Use the plainer word you would say out loud, or name the concrete thing instead.',
  },
  transition: {
    label: 'Formal connectors',
    explanation: 'Sentence-opening connectors like "Moreover" and "Ultimately" belong to reports. In a personal essay, several of them make the draft sound like it is following a template.',
    suggestion: 'Let the ideas connect on their own, or use a time or place ("Two weeks later", "Back home") to move the reader.',
  },
  contrast_frame: {
    label: '"Not X, but Y" framing',
    explanation: 'The "it is not about X, it is about Y" move is a common rhetorical template. Used more than once it becomes predictable.',
    suggestion: 'State what you think directly, then support it with what happened.',
  },
  repeated_opener: {
    label: 'Repeated sentence openings',
    explanation: 'Three or more sentences in a row start with the same word. The rhythm flattens and the reader notices the pattern instead of the content.',
    suggestion: 'Vary how a sentence enters: start with a time, a place, an action or a line of dialogue.',
  },
  growth_claim: {
    label: 'Statements of growth',
    explanation: 'Phrases like "I learned" and "this experience taught me" announce growth instead of showing it. Several of them can stand in for reflection that is not on the page.',
    suggestion: 'Keep the one that matters most and show the change through what you now do differently.',
  },
  emotion_label: {
    label: 'Named emotions',
    explanation: 'Naming a feeling ("I was so nervous") tells the reader what to feel. A detail usually carries the emotion better.',
    suggestion: 'Describe what you did or noticed in that moment (your hands, what you said, what you could not stop thinking about).',
  },
  intensifier: {
    label: 'Intensifiers',
    explanation: 'Words like "very", "really" and "truly" add emphasis without information. Frequent use weakens the sentences around them.',
    suggestion: 'Cut the intensifier, or replace the word pair with a more precise word.',
  },
  em_dash: {
    label: 'Em dash density',
    explanation: 'Em dashes are common in edited prose and in AI-generated text. Many in one essay can make the rhythm feel uniform. This is a style observation only.',
    suggestion: 'Keep the dashes that set off something surprising; turn the rest into commas, periods or parentheses.',
  },
  opening_formula: {
    label: 'Formula opening',
    explanation: 'Dictionary definitions, famous quotations and "Have you ever..." questions are among the most common essay openings.',
    suggestion: 'Start inside a specific moment or with a line only you could write.',
  },
  closing_formula: {
    label: 'Summary ending',
    explanation: 'Ending with "In conclusion" or a lesson statement restates the essay instead of finishing it.',
    suggestion: 'End on an image, action or thought that shows where you are now.',
  },
};

export function analyze(text: string): Analysis {
  const sents = sentences(text);
  const words = countWords(text);
  const lens = sents.map((s) => wordsIn(s.text).length);
  const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const sd = lens.length ? Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length) : 0;
  const cv = mean ? sd / mean : 0;
  const longestIdx = lens.length ? lens.indexOf(Math.max(...lens)) : -1;

  const found: Record<MeasureKind, Measure[]> = {
    stock_phrase: scan(text, RE.stock, 'stock_phrase'),
    ai_vocab: scan(text, RE.ai, 'ai_vocab'),
    transition: [],
    contrast_frame: scan(text, RE.contrast, 'contrast_frame'),
    repeated_opener: [],
    growth_claim: scan(text, RE.growth, 'growth_claim'),
    emotion_label: scan(text, RE.emotion, 'emotion_label'),
    intensifier: scan(text, RE.intens, 'intensifier'),
    em_dash: scan(text, /—|(?<=\s)--(?=\s)/gu, 'em_dash'),
    opening_formula: [],
    closing_formula: [],
  };

  for (const s of sents) {
    const m = RE.transition.exec(s.text);
    if (m) found.transition.push({ id: `transition:${s.start}`, kind: 'transition', start: s.start, end: s.start + m[0].replace(/,$/, '').length, text: m[0].replace(/,$/, '') });
  }

  // Runs of 3+ consecutive sentences with the same first word.
  for (let i = 0; i < sents.length; ) {
    let j = i + 1;
    const w = firstWord(sents[i]);
    while (j < sents.length && w && firstWord(sents[j]) === w) j++;
    if (j - i >= 3)
      for (let k = i; k < j; k++) {
        const s = sents[k];
        const len = wordsIn(s.text)[0].length;
        const off = s.text.search(/[\p{L}\p{N}]/u);
        found.repeated_opener.push({ id: `repeated_opener:${s.start}`, kind: 'repeated_opener', start: s.start + off, end: s.start + off + len, text: s.text.slice(off, off + len) });
      }
    i = j;
  }

  const first = sents[0];
  if (first && /^(?:(?:merriam-)?webster|the (?:oxford )?dictionary)|\bdefines\b|^["“][^"”]{10,}["”]\s*[—–-]|^have you ever\b/iu.test(first.text))
    found.opening_formula.push({ id: `opening_formula:${first.start}`, kind: 'opening_formula', start: first.start, end: first.end, text: first.text });

  const lastPara = paragraphs(text).at(-1);
  if (lastPara) {
    const tail = text.slice(lastPara.start, lastPara.end);
    const m = /\b(?:in conclusion|to conclude|in summary|all in all|overall,|this experience (?:taught|showed) me|I (?:have )?learned that)/iu.exec(tail);
    if (m) found.closing_formula.push({ id: `closing_formula:${lastPara.start + m.index}`, kind: 'closing_formula', start: lastPara.start + m.index, end: lastPara.start + m.index + m[0].length, text: m[0] });
  }

  const per100 = (n: number) => (words ? (n * 100) / words : 0);
  const distinct = (ms: Measure[]) => new Set(ms.map((m) => m.text.toLowerCase())).size;
  const flagged: Record<MeasureKind, boolean> = {
    stock_phrase: found.stock_phrase.length > 0,
    ai_vocab: distinct(found.ai_vocab) >= 2,
    transition: found.transition.length >= 3 || (found.transition.length >= 2 && per100(found.transition.length) >= 0.6),
    contrast_frame: found.contrast_frame.length >= 2,
    repeated_opener: found.repeated_opener.length > 0,
    growth_claim: found.growth_claim.length >= 3,
    emotion_label: found.emotion_label.length >= 3,
    intensifier: found.intensifier.length >= 4 && per100(found.intensifier.length) >= 0.8,
    em_dash: found.em_dash.length >= 4 && per100(found.em_dash.length) >= 0.8,
    opening_formula: found.opening_formula.length > 0,
    closing_formula: found.closing_formula.length > 0,
  };

  const groups = (Object.keys(found) as MeasureKind[])
    .filter((k) => found[k].length)
    .map((k) => ({ kind: k, ...INFO[k], count: found[k].length, flagged: flagged[k], items: found[k] }))
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.count - a.count);

  return {
    words,
    chars: countChars(text),
    sentenceCount: sents.length,
    paragraphCount: paragraphs(text).length,
    avgSentenceWords: Math.round(mean * 10) / 10,
    sentenceLengthCv: Math.round(cv * 100) / 100,
    longestSentence: longestIdx >= 0 ? { n: sents[longestIdx].n, words: lens[longestIdx] } : null,
    iStartShare: sents.length ? sents.filter((s) => firstWord(s) === 'i').length / sents.length : 0,
    // ponytail: fixed 0.35 threshold is a heuristic, not a validated cut-off; tune against real drafts.
    rhythmFlagged: sents.length >= 10 && cv < 0.35,
    groups,
  };
}

/** Compact summary the voice model gets, so it does not re-derive counts. */
export function analysisBrief(a: Analysis): string {
  const lines = [
    `${a.words} words, ${a.sentenceCount} sentences, ${a.paragraphCount} paragraphs; mean ${a.avgSentenceWords} words/sentence; length variation (CV) ${a.sentenceLengthCv}.`,
    `${Math.round(a.iStartShare * 100)}% of sentences start with "I".`,
  ];
  for (const g of a.groups.filter((g) => g.flagged)) lines.push(`${g.label}: ${g.items.slice(0, 6).map((m) => `"${m.text}"`).join(', ')}`);
  return lines.join('\n');
}
