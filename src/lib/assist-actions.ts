// Assistant actions. Plain data so client components can import it without pulling in model code.

export const ASSIST_ACTIONS = {
  explain: { label: 'Explain this feedback', needsNote: true, rewrites: false, ask: 'Explain the selected feedback in plain terms: what the reader experiences in this passage, why it matters for this essay, and what a fix would accomplish. Do not rewrite the passage.' },
  brainstorm: { label: 'Help me brainstorm', needsNote: false, rewrites: false, ask: 'Help the student brainstorm directions for this passage: offer 3-4 angles drawn from what the essay already contains, each as a short idea, and the questions that would let them develop it. Do not write essay sentences.' },
  questions: { label: 'Ask me questions', needsNote: false, rewrites: false, ask: 'Ask 4-6 specific questions about the experience in this passage that would help the student recall concrete details, what they thought at the time, and what they think now. No rewrites.' },
  clarify: { label: 'Make this clearer', needsNote: false, rewrites: true, ask: 'Offer up to 3 clearer versions of the selected passage that keep its meaning, facts and voice.' },
  transition: { label: 'Improve this transition', needsNote: false, rewrites: true, ask: 'Offer up to 3 versions of the selected passage that move more naturally from what comes before to what comes after, using only material in the essay.' },
  tighten: { label: 'Cut unnecessary words', needsNote: false, rewrites: true, ask: 'Offer up to 3 shorter versions of the selected passage that cut filler and repetition while keeping every fact and the student\'s phrasing where it works.' },
  reflect: { label: 'Strengthen the reflection', needsNote: false, rewrites: false, ask: 'Help the student deepen reflection in this passage: point out where they state a lesson instead of examining it, and ask questions that would lead them to their own insight. Do not supply the insight.' },
  context: { label: 'What context is missing?', needsNote: false, rewrites: false, ask: 'Identify what a reader who does not know the student would need to understand this passage (who, where, when, stakes), and ask for each missing piece.' },
  alternatives: { label: 'Other ways to say this', needsNote: false, rewrites: true, ask: 'Offer up to 3 alternative ways to express the same idea as the selected passage, each with a different rhythm or emphasis, without adding facts.' },
  check: { label: 'Does my revision fix this?', needsNote: true, rewrites: false, ask: 'The student revised the passage the feedback was about. Compare the original passage with the current selection and say whether the revision addresses the feedback, partly addresses it, or does not, and what is still missing.' },
} as const;

export type AssistAction = keyof typeof ASSIST_ACTIONS;
export const ASSIST_ACTION_KEYS = Object.keys(ASSIST_ACTIONS) as [AssistAction, ...AssistAction[]];
