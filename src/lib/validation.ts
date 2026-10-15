import { z } from 'zod';
import { ESSAY_TYPE_KEYS } from './rubric';
import { LIBRARY_BY_ID } from './prompt-library';
import { ASSIST_ACTION_KEYS } from './assist-actions';

const MAX_TEXT = 40_000; // ~6,000 words: far above any application limit, below abuse territory
const shortText = (max: number) => z.string().max(max).nullable();
const limit = z.number().int().min(1).max(20_000).nullable();

export const EssayFieldsSchema = z
  .object({
    title: z.string().max(200).nullable(),
    essay_type: z.enum(ESSAY_TYPE_KEYS as [string, ...string[]]),
    prompt_id: z.string().max(60).nullable().refine((v) => v === null || LIBRARY_BY_ID.has(v), 'unknown prompt'),
    prompt_text: shortText(3000),
    word_limit: limit,
    min_words: limit,
    char_limit: limit,
    college: shortText(200),
    cycle: shortText(40),
    intent: shortText(600),
  })
  .partial()
  .strict();

export const CreateEssaySchema = EssayFieldsSchema.extend({
  content: z.string().max(MAX_TEXT).optional(),
  sample: z.boolean().optional(),
}).strict();

export const PatchEssaySchema = z
  .object({
    content: z.string().max(MAX_TEXT).optional(),
    rev: z.number().int().min(0).optional(),
    fields: EssayFieldsSchema.optional(),
  })
  .strict()
  .refine((b) => b.content === undefined || b.rev !== undefined, 'rev is required when saving content');

export const CredentialsSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(10, 'must be at least 10 characters').max(200),
  })
  .strict();

export const VersionPostSchema = z.union([
  z.object({ label: z.string().trim().min(1).max(80) }).strict(),
  z.object({ restore: z.string().uuid(), rev: z.number().int().min(0) }).strict(),
]);

export const ItemStatusSchema = z.object({ itemId: z.string().regex(/^[a-z]_[0-9a-f]{10}$/), status: z.enum(['open', 'dismissed', 'resolved']) }).strict();

export const AssistRequestSchema = z
  .object({
    action: z.enum(ASSIST_ACTION_KEYS),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    text: z.string().min(1).max(2500),
    rev: z.number().int().min(0),
    reviewId: z.string().uuid().nullable(),
    noteId: z.string().regex(/^n_[0-9a-f]{10}$/).nullable(),
    message: z.string().max(500).nullable(),
  })
  .strict()
  .refine((b) => b.end > b.start, 'empty selection');

export const CheckRequestSchema = z.object({ reviewId: z.string().uuid(), rev: z.number().int().min(0) }).strict();
