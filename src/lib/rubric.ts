// The review rubric. Each dimension has a question and written level descriptors so a rating
// means the same thing on every essay. Ratings are qualitative on purpose: there is no
// validated mapping from essay scores to admission outcomes, so Stet does not invent one.

export const ESSAY_TYPES = {
  personal_statement: 'Personal statement',
  why_college: 'Why this college',
  why_major: 'Why this major',
  community: 'Community',
  extracurricular: 'Activity or extracurricular',
  identity: 'Identity and background',
  challenge: 'Challenge, failure and growth',
  scholarship: 'Scholarship',
  supplement: 'Other supplement',
  short_answer: 'Short answer',
} as const;

export type EssayType = keyof typeof ESSAY_TYPES;
export const ESSAY_TYPE_KEYS = Object.keys(ESSAY_TYPES) as EssayType[];

export const RATINGS = ['strong', 'developing', 'needs_work', 'not_assessable'] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABEL: Record<Rating, string> = {
  strong: 'Working',
  developing: 'Developing',
  needs_work: 'Needs work',
  not_assessable: 'Not assessable',
};

interface Dimension {
  name: string;
  question: string;
  strong: string;
  developing: string;
  needs_work: string;
}

export const DIMENSIONS = {
  prompt_alignment: {
    name: 'Answers the prompt',
    question: 'Does the essay respond to every part of the prompt it was written for?',
    strong: 'Every part of the prompt is answered, and the answer is central rather than tacked on.',
    developing: 'The main question is answered but a part is thin, implied, or arrives late.',
    needs_work: 'The essay mostly answers a different question or skips a required part.',
  },
  specificity: {
    name: 'Specific detail',
    question: 'Are claims carried by concrete, particular details only this writer would know?',
    strong: 'Names, objects, actions, numbers or dialogue make scenes and claims particular to this writer.',
    developing: 'Some vivid details, but key moments are described in general terms.',
    needs_work: 'Mostly abstractions and summaries that could describe many applicants.',
  },
  voice: {
    name: 'Voice',
    question: 'Does it sound like a particular person thinking, rather than a template?',
    strong: 'Word choice, humor or rhythm are recognisably this writer\'s; reads like a person talking.',
    developing: 'The voice comes through in places but flattens into formal or generic prose elsewhere.',
    needs_work: 'Reads as generic or impersonal throughout; little sense of who is writing.',
  },
  reflection: {
    name: 'Reflection',
    question: 'Does the writer interpret their experience: why it mattered, what they think now?',
    strong: 'Insight is specific and earned; the writer explains their thinking, not just the moral.',
    developing: 'Some reflection, but it states lessons more than it examines them.',
    needs_work: 'Little or no interpretation, or reflection limited to stock lessons.',
  },
  structure: {
    name: 'Structure',
    question: 'Is the order of ideas easy to follow and purposeful?',
    strong: 'Each paragraph has a job; the sequence builds and transitions are clear.',
    developing: 'Mostly followable, with a section that stalls, repeats or jumps.',
    needs_work: 'Hard to follow; ideas are out of order or disconnected.',
  },
  agency: {
    name: 'Personal agency',
    question: 'Do we see the writer\'s own choices and actions, not only what happened to them or what others did?',
    strong: 'The writer\'s decisions and actions drive the essay.',
    developing: 'The writer acts, but others or circumstances take up much of the space.',
    needs_work: 'The writer is mostly a bystander in their own essay.',
  },
  growth: {
    name: 'Growth or changed understanding',
    question: 'Is there a believable change in thinking or behavior, shown rather than announced?',
    strong: 'A change is visible in what the writer now does or sees differently.',
    developing: 'Growth is claimed but only partly demonstrated.',
    needs_work: 'Growth is asserted with no evidence, or absent where the prompt asks for it.',
  },
  clarity: {
    name: 'Clarity',
    question: 'Can a reader understand every sentence on the first read?',
    strong: 'Sentences are clear; meaning is never in doubt.',
    developing: 'A few sentences are confusing, overloaded or ambiguous.',
    needs_work: 'Frequent confusion about what is happening or what is meant.',
  },
  opening: {
    name: 'Opening',
    question: 'Does the opening give the reader a reason to keep going and point toward the essay\'s subject?',
    strong: 'Opens with something particular that sets up the essay.',
    developing: 'Serviceable but slow, generic, or loosely connected to the rest.',
    needs_work: 'Opens with a cliché, a definition, or material unrelated to the essay.',
  },
  ending: {
    name: 'Ending',
    question: 'Does the ending land without simply summarizing?',
    strong: 'Ends with a resonant image, action or thought that completes the essay.',
    developing: 'Ends adequately but leans on summary or a general statement.',
    needs_work: 'Stops abruptly, repeats the essay, or ends on a moral that is not supported.',
  },
  pacing: {
    name: 'Pacing',
    question: 'Is space spent in proportion to importance?',
    strong: 'Important moments get room; background is brief.',
    developing: 'Some imbalance, such as a long setup or a rushed key moment.',
    needs_work: 'Most of the space goes to context while the central moment is skimmed.',
  },
  cliche: {
    name: 'Clichés and generic statements',
    question: 'Does the essay avoid stock phrases and statements that could appear in anyone\'s essay?',
    strong: 'Language is fresh; any familiar idea is made particular.',
    developing: 'A few stock phrases or generic sentences.',
    needs_work: 'Generic statements carry key points.',
  },
  concision: {
    name: 'Concision',
    question: 'Does every sentence earn its place, without redundancy or filler?',
    strong: 'Tight; little to cut.',
    developing: 'Some repetition, filler or wordy phrasing.',
    needs_work: 'Significant redundancy that costs space the essay needs.',
  },
  unsupported_claims: {
    name: 'Supported claims',
    question: 'Are claims about the writer (qualities, impact, passion) backed by evidence on the page?',
    strong: 'Claims are shown through actions or results.',
    developing: 'Some claims rest on assertion alone.',
    needs_work: 'Key claims ("I am a leader", "I am passionate") have no supporting evidence.',
  },
  meaning: {
    name: 'What it reveals',
    question: 'After reading, does a reader learn something meaningful about who this applicant is?',
    strong: 'A clear, particular sense of the person: values, how they think, what they care about.',
    developing: 'Some sense of the person, but blurred by topic or generality.',
    needs_work: 'Reader learns about events or other people, little about the writer.',
  },
  event_vs_reflection: {
    name: 'Story versus reflection',
    question: 'Does the essay balance what happened with what the writer makes of it?',
    strong: 'Narration and reflection are balanced and interleaved.',
    developing: 'Leans heavily on recounting events; reflection is packed into the end.',
    needs_work: 'Almost entirely description of events with little perspective.',
  },
  development: {
    name: 'Development of the central idea',
    question: 'Does the central idea deepen as the essay goes on, rather than being restated?',
    strong: 'The idea evolves; later paragraphs add something earlier ones did not.',
    developing: 'The idea is clear but mostly restated.',
    needs_work: 'No clear central idea, or it changes without explanation.',
  },
  earned_ending: {
    name: 'Earned conclusion',
    question: 'Is the conclusion supported by what came before, rather than artificially inspirational?',
    strong: 'The final insight follows from the essay\'s own material.',
    developing: 'Mostly earned, with some uplift that outruns the evidence.',
    needs_work: 'The ending claims transformation or inspiration the essay has not shown.',
  },
  school_specificity: {
    name: 'Specific to the school',
    question: 'Does the essay name particular programs, people, practices or traits of this school, accurately and for a reason?',
    strong: 'Specific, relevant details that would not fit another school\'s essay.',
    developing: 'Some specifics, but they read like a list or could fit several schools.',
    needs_work: 'Generic praise (prestige, location, "diverse community") that fits any school.',
  },
  fit: {
    name: 'Connection to the writer',
    question: 'Does the essay connect the opportunity (school, major, scholarship) to the writer\'s own history and goals?',
    strong: 'Clear, specific links between the writer\'s past, the opportunity and what they would do with it.',
    developing: 'Connection asserted but thin on the writer\'s own evidence.',
    needs_work: 'Describes the opportunity without connecting it to the writer.',
  },
} as const satisfies Record<string, Dimension>;

export type DimensionKey = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as [DimensionKey, ...DimensionKey[]];

const CORE: DimensionKey[] = [
  'prompt_alignment', 'specificity', 'voice', 'reflection', 'structure', 'agency', 'growth', 'clarity', 'opening',
  'ending', 'pacing', 'cliche', 'concision', 'unsupported_claims', 'meaning', 'event_vs_reflection', 'development',
  'earned_ending',
];

export const DIMENSIONS_FOR: Record<EssayType, DimensionKey[]> = {
  personal_statement: CORE,
  why_college: ['prompt_alignment', 'school_specificity', 'fit', 'specificity', 'voice', 'reflection', 'clarity', 'concision', 'cliche', 'opening', 'ending'],
  why_major: ['prompt_alignment', 'fit', 'specificity', 'agency', 'reflection', 'development', 'school_specificity', 'clarity', 'concision', 'cliche'],
  community: ['prompt_alignment', 'specificity', 'agency', 'reflection', 'voice', 'meaning', 'clarity', 'concision', 'cliche', 'ending'],
  extracurricular: ['prompt_alignment', 'specificity', 'agency', 'reflection', 'growth', 'event_vs_reflection', 'unsupported_claims', 'clarity', 'concision', 'cliche'],
  identity: ['prompt_alignment', 'specificity', 'voice', 'reflection', 'meaning', 'structure', 'development', 'clarity', 'concision', 'cliche', 'earned_ending'],
  challenge: ['prompt_alignment', 'specificity', 'agency', 'reflection', 'growth', 'event_vs_reflection', 'pacing', 'structure', 'clarity', 'concision', 'earned_ending', 'cliche'],
  scholarship: ['prompt_alignment', 'specificity', 'agency', 'meaning', 'fit', 'unsupported_claims', 'structure', 'clarity', 'concision', 'ending'],
  supplement: ['prompt_alignment', 'specificity', 'voice', 'reflection', 'structure', 'meaning', 'clarity', 'concision', 'cliche', 'opening', 'ending'],
  short_answer: ['prompt_alignment', 'specificity', 'voice', 'clarity', 'concision', 'cliche'],
};

/** Rubric text for the model: only the dimensions that apply to this essay type. */
export function rubricText(type: EssayType): string {
  return DIMENSIONS_FOR[type]
    .map((k) => {
      const d = DIMENSIONS[k];
      return `- ${k} (${d.name}): ${d.question} strong = ${d.strong} developing = ${d.developing} needs_work = ${d.needs_work}`;
    })
    .join('\n');
}
