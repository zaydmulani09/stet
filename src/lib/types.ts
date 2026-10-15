// Shapes stored in reviews.result and sent to the browser. Every passage reference is an
// Anchor that was verified against the reviewed text on the server.

import type { Anchor } from './anchor';
import type { Analysis } from './analysis';
import type { DimensionKey, Rating } from './rubric';
import type { LimitStatus } from './text';

export type Severity = 'high' | 'medium' | 'low';
export type Confidence = 'high' | 'medium' | 'low';

export interface Note {
  id: string;
  dimension: DimensionKey;
  severity: Severity;
  title: string;
  why: string;
  action: string;
  example: string | null;
  question: string | null;
  confidence: Confidence;
  anchor: Anchor;
}

export interface Strength {
  id: string;
  why: string;
  anchor: Anchor;
}

export interface ReviewResult {
  overall: string;
  takeaway: string;
  promptFit: { verdict: 'answers' | 'partly' | 'drifts' | 'no_prompt'; explanation: string };
  strengths: Strength[];
  dimensions: Array<{ key: DimensionKey; rating: Rating; rationale: string }>;
  notes: Note[];
  plan: Array<{ step: string; why: string; noteIds: string[] }>;
  questions: string[];
  caveats: string[];
  dropped: number; // model quotes that were not found in the essay and were discarded
  model: string;
}

export const VOICE_SIGNALS = {
  abstract_without_detail: 'Abstract statement without detail',
  generic_motivation: 'Generic motivational phrasing',
  predictable_transition: 'Predictable transition',
  repetitive_structure: 'Repetitive sentence pattern',
  unnecessary_formality: 'Unnecessary formality',
  repeated_growth_claim: 'Repeated claim of growth',
  emotion_told: 'Emotion or motive stated, not shown',
  summary_without_perspective: 'Summary without your perspective',
  perspective_fades: 'Your perspective fades',
} as const;
export type VoiceSignal = keyof typeof VOICE_SIGNALS;

export const PATTERNS = {
  formulaic_transition: 'Formulaic transition',
  repeated_structure: 'Repeated sentence structure',
  generic_abstraction: 'Generic or abstract phrasing',
  uniform_rhythm: 'Uniform rhythm',
  repetitive_conclusion: 'Repetitive or summary conclusion',
  style_shift: 'Sudden change in style',
  stock_phrase: 'Stock phrase',
  list_of_three: 'Reflexive list of three',
  contrast_template: '"Not X, but Y" template',
  inflated_vocabulary: 'Inflated vocabulary',
} as const;
export type PatternKind = keyof typeof PATTERNS;

export interface VoiceResult {
  summary: string;
  keep: Array<{ id: string; why: string; anchor: Anchor }>;
  generic: Array<{ id: string; signal: VoiceSignal; why: string; suggestion: string; question: string | null; anchor: Anchor }>;
  patterns: Array<{ id: string; pattern: PatternKind; observation: string; why: string; suggestion: string; anchor: Anchor }>;
  shift: { detected: boolean; explanation: string; anchor: Anchor | null };
  dropped: number;
  model: string;
}

export interface StoredReview {
  review: ReviewResult | null;
  voice: VoiceResult | null;
  errors: { review?: string; voice?: string };
  analysis: Analysis;
  limits: LimitStatus;
  promptText: string | null;
  essayType: string;
  durationMs: number;
  generatedAt?: string; // set only on the stored sample review
}

export interface ReviewPayload {
  id: string;
  versionId: string;
  createdAt: string;
  reviewedText: string;
  result: StoredReview;
  itemStatus: Record<string, string>;
}
