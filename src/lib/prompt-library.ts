// Prompt library. Wording is copied from each institution's own page (see docs/RESEARCH.md).
// To add or update prompts, edit this list; the review engine only reads type, text and limits.

import type { EssayType } from './rubric';

export interface LibraryPrompt {
  id: string;
  source: string;
  title: string;
  text: string;
  type: EssayType;
  wordLimit: number | null;
  minWords: number | null;
  charLimit: number | null;
  cycle: string | null; // as labelled by the source; null when the page shows no cycle
  url: string;
  checked: string; // date the wording was compared with the source
  note?: string;
}

interface SourceDef {
  source: string;
  cycle: string | null;
  url: string;
  checked: string;
}

function from(src: SourceDef, rows: Array<Omit<LibraryPrompt, keyof SourceDef | 'minWords' | 'charLimit'> & Partial<Pick<LibraryPrompt, 'minWords' | 'charLimit'>>>): LibraryPrompt[] {
  return rows.map((r) => ({ minWords: null, charLimit: null, ...src, ...r }));
}

const CHECKED = '2026-10-15';

const COMMON_APP = from(
  { source: 'Common App', cycle: '2026–2027', url: 'https://www.commonapp.org/apply/essay-prompts', checked: CHECKED },
  [
    ['ca-1', 'Background, identity, interest, or talent', 'Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.'],
    ['ca-2', 'Challenge, setback, or failure', 'The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?'],
    ['ca-3', 'Questioning a belief or idea', 'Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?'],
    ['ca-4', 'Gratitude', 'Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?'],
    ['ca-5', 'Accomplishment and personal growth', 'Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.'],
    ['ca-6', 'A topic you lose track of time in', 'Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?'],
    ['ca-7', 'Topic of your choice', "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design."],
  ].map(([id, title, text]) => ({
    id, title, text, type: 'personal_statement' as const, wordLimit: 650, minWords: 250,
    note: 'Common App essays are 250–650 words.',
  })),
);

const UC = from(
  { source: 'University of California', cycle: null, url: 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/personal-insight-questions.html', checked: CHECKED },
  ([
    ['uc-1', 'Leadership', 'Describe an example of your leadership experience in which you have positively influenced others, helped resolve disputes or contributed to group efforts over time.', 'extracurricular'],
    ['uc-2', 'Creative side', 'Every person has a creative side, and it can be expressed in many ways: problem solving, original and innovative thinking, and artistically, to name a few. Describe how you express your creative side.', 'supplement'],
    ['uc-3', 'Greatest talent or skill', 'What would you say is your greatest talent or skill? How have you developed and demonstrated that talent over time?', 'supplement'],
    ['uc-4', 'Educational opportunity or barrier', 'Describe how you have taken advantage of a significant educational opportunity or worked to overcome an educational barrier you have faced.', 'challenge'],
    ['uc-5', 'Most significant challenge', 'Describe the most significant challenge you have faced and the steps you have taken to overcome this challenge. How has this challenge affected your academic achievement?', 'challenge'],
    ['uc-6', 'Academic subject that inspires you', 'Think about an academic subject that inspires you. Describe how you have furthered this interest inside and/or outside of the classroom.', 'why_major'],
    ['uc-7', 'School or community', 'What have you done to make your school or your community a better place?', 'community'],
    ['uc-8', 'What makes you a strong candidate', 'Beyond what has already been shared in your application, what do you believe makes you a strong candidate for admissions to the University of California?', 'supplement'],
  ] as const).map(([id, title, text, type]) => ({
    id, title, text, type, wordLimit: 350, note: 'Answer 4 of the 8 questions. All are weighed equally.',
  })),
);

const YALE = from({ source: 'Yale', cycle: '2026–27', url: 'https://admissions.yale.edu/essays', checked: CHECKED }, [
  { id: 'yale-topic', title: 'A topic or idea that excites you', text: 'Tell us about a topic or idea that excites you and is related to one or more academic areas you selected above. Why are you drawn to it?', type: 'why_major', wordLimit: 200 },
  { id: 'yale-take-1', title: 'Short take: a course, book or work of art', text: 'If you could teach any college course, write a book, or create an original piece of art of any kind, what would it be?', type: 'short_answer', wordLimit: null, charLimit: 200 },
  { id: 'yale-take-2', title: 'Short take: how you hope to grow', text: 'What is one aspect of yourself that you hope to grow or develop during college?', type: 'short_answer', wordLimit: null, charLimit: 200 },
  { id: 'yale-take-3', title: 'Short take: not anywhere else', text: 'What is something about you that is not included anywhere else in your application?', type: 'short_answer', wordLimit: null, charLimit: 200 },
  { id: 'yale-essay-1', title: 'Essay: an opposing view', text: 'Reflect on a time you discussed an issue important to you with someone holding an opposing view. Why did you find the experience meaningful?', type: 'supplement', wordLimit: 400 },
  { id: 'yale-essay-2', title: 'Essay: a community', text: 'Reflect on your membership in a community to which you feel connected. Why is this community meaningful to you? You may define community however you like.', type: 'community', wordLimit: 400 },
  { id: 'yale-essay-3', title: 'Essay: your personal experience', text: 'Reflect on an element of your personal experience that you feel will enrich your college. How has it shaped you?', type: 'identity', wordLimit: 400 },
]);

const STANFORD = from({ source: 'Stanford', cycle: null, url: 'https://admission.stanford.edu/apply/first-year/apply.html', checked: CHECKED }, [
  ...[
    ['stanford-q1', 'Society’s most significant challenge', 'What is the most significant challenge that society faces today?'],
    ['stanford-q2', 'Your last two summers', 'How did you spend your last two summers?'],
    ['stanford-q3', 'A historical moment', 'What historical moment or event do you wish you could have witnessed?'],
    ['stanford-q4', 'An activity, job or responsibility', 'Briefly elaborate on one of your extracurricular activities, a job you hold, or responsibilities you have for your family.'],
    ['stanford-q5', 'Five things important to you', 'List five things that are important to you.'],
  ].map(([id, title, text]) => ({ id, title, text, type: 'short_answer' as const, wordLimit: 50, minWords: 3 })),
  { id: 'stanford-e1', title: 'Excited about learning', text: 'The Stanford community is deeply curious and driven to learn in and out of the classroom. Reflect on an idea or experience that makes you genuinely excited about learning.', type: 'supplement', wordLimit: 250, minWords: 100 },
  { id: 'stanford-e2', title: 'Note to your future roommate', text: "Virtually all of Stanford's undergraduates live on campus. Write a note to your future roommate that reveals something about you or that will help your roommate—and us—get to know you better.", type: 'supplement', wordLimit: 250, minWords: 100 },
  { id: 'stanford-e3', title: 'A distinctive contribution', text: 'Please describe what aspects of your life experiences, interests, and character would help you make a distinctive contribution as an undergraduate to Stanford University.', type: 'identity', wordLimit: 250, minWords: 100 },
]);

const MIT = from({ source: 'MIT', cycle: '2026–2027', url: 'https://mitadmissions.org/apply/firstyear/essays-activities-academics/', checked: CHECKED }, [
  { id: 'mit-e1', title: 'Field of study', text: 'What field of study appeals to you the most right now? (Note: Applicants select from a drop-down list.) Reflect on what has led you to this interest.', type: 'why_major', wordLimit: 200, note: 'MIT asks for approximately 100–200 words.' },
  { id: 'mit-e2', title: 'Different than expected', text: 'While some reach their goals following well-trodden paths, others blaze their own trails achieving the unexpected. In what ways have you done something different than what was expected in your educational journey?', type: 'supplement', wordLimit: 200, note: 'MIT asks for approximately 100–200 words.' },
  { id: 'mit-e3', title: 'Problems you would tackle', text: 'How have your personal and academic experiences influenced the types of problems you would want to tackle with an MIT education and the impact you aim to make on your community?', type: 'why_major', wordLimit: 200, note: 'MIT asks for approximately 100–200 words.' },
  { id: 'mit-e4', title: 'An unexpected situation', text: "How did you manage a situation or challenge that you didn't expect? What did you learn from it?", type: 'challenge', wordLimit: 200, note: 'MIT asks for approximately 100–200 words.' },
  { id: 'mit-s1', title: 'Just for fun', text: 'What do you do just for fun?', type: 'short_answer', wordLimit: 50 },
  { id: 'mit-s2', title: 'Someone you admire', text: 'Who is someone you admire, whether you know them personally or look up to them from afar? Tell us why.', type: 'short_answer', wordLimit: 50 },
  { id: 'mit-s3', title: 'A topic you could talk about for hours', text: 'What’s a topic, academic or non-academic, that you could talk about for hours?', type: 'short_answer', wordLimit: 50 },
  { id: 'mit-s4', title: 'Generalist or specialist', text: 'MIT values both “generalists” with varied interests and “specialists” who focus deeply on one or a few passions. Which do you think best describes you, and why?', type: 'short_answer', wordLimit: 50 },
]);

const PRINCETON = from({ source: 'Princeton', cycle: null, url: 'https://admission.princeton.edu/apply/princeton-specific-questions', checked: CHECKED }, [
  { id: 'princeton-ab', title: 'A.B. or undecided: academic interests', text: 'As a research institution that also prides itself on its liberal arts curriculum, Princeton allows students to explore areas across the humanities and the arts, the natural sciences, and the social sciences. What academic areas most pique your curiosity, and how do the programs offered at Princeton suit your particular interests?', type: 'why_major', wordLimit: 250 },
  { id: 'princeton-bse', title: 'B.S.E.: why engineering', text: 'Please describe why you are interested in studying engineering at Princeton. Include any of your experiences in or exposure to engineering, and how you think the programs offered at the University suit your particular interests.', type: 'why_major', wordLimit: 250 },
  { id: 'princeton-voice-1', title: 'Your voice: lived experience', text: 'Princeton values community and encourages students, faculty, staff and leadership to engage in respectful conversations that can expand their perspectives and challenge their ideas and beliefs. As a prospective member of this community, reflect on how your lived experiences will impact the conversations you will have in the classroom, the dining hall or other campus spaces. What lessons have you learned in life thus far? What will your classmates learn from you? In short, how has your lived experience shaped you?', type: 'identity', wordLimit: 500, minWords: 400 },
  { id: 'princeton-voice-2', title: 'Your voice: service and civic engagement', text: 'Princeton has a longstanding commitment to understanding our responsibility to society through service and civic engagement. How does your own story intersect with these ideals?', type: 'community', wordLimit: 250 },
  { id: 'princeton-m1', title: 'A new skill', text: 'What is a new skill you would like to learn in college?', type: 'short_answer', wordLimit: 50 },
  { id: 'princeton-m2', title: 'What brings you joy', text: 'What brings you joy?', type: 'short_answer', wordLimit: 50 },
  { id: 'princeton-m3', title: 'Your soundtrack', text: 'What song represents the soundtrack of your life at this moment?', type: 'short_answer', wordLimit: 50 },
]);

const UCHICAGO = from({ source: 'UChicago', cycle: '2026–2027', url: 'https://collegeadmissions.uchicago.edu/apply/essay/', checked: CHECKED }, [
  { id: 'uchicago-why', title: 'Why UChicago', text: 'How does the University of Chicago, as you know it now, satisfy your desire for a particular kind of learning, community, and future? Please address with some specificity your own wishes and how they relate to UChicago.', type: 'why_college', wordLimit: null },
  ...[
    ['uchicago-x1', 'How do thoughts eat?', 'Food for thought: How do thoughts eat?'],
    ['uchicago-x2', 'An artistic practice as a solution', 'The James Webb Space Telescope, launched in 2021, utilized origami-inspired techniques to compactly store and deploy its sunshield in space. Choose an artistic practice and use its principles to propose an elegant solution to a problem.'],
    ['uchicago-x3', 'A mixed metaphor', 'Sometimes metaphors get mixed up. For one reason or another, one could say, “we\'ll burn that bridge when we get there” or “the world is your china shop”. Make up your own mixed metaphor. Explain how it could make sense, be understood, or even applied.'],
    ['uchicago-x4', 'An Olympics of the mundane', 'The Olympics have long celebrated the pinnacle of human athletic achievement. But what if they expanded to honor the mundane? Imagine a new Olympic event built around an everyday activity like speed dishwashing or competitive grocery bagging. How is it scored, officiated, and judged? Why is it a worthy addition?'],
    ['uchicago-x5', 'Mistaken Identity of Acronym', 'AI: Allen Iverson. NASA, or the North American Saxophone Alliance. Share a potentially confounding, comedic, or captivating example of MIA (Mistaken Identity of Acronym) and tell us its backstory.'],
    ['uchicago-x6', 'Choose your own adventure', 'In the spirit of adventurous inquiry, choose one of our past prompts (or create a question of your own). Be original, creative, thought provoking. Draw on your best qualities as a writer, thinker, visionary, social critic, sage, citizen of the world, or future citizen of the University of Chicago; take a little risk, and have fun!'],
  ].map(([id, title, text]) => ({ id, title, text, type: 'supplement' as const, wordLimit: null, note: 'Extended essay (required; choose one). UChicago does not set a hard limit on this page.' })),
]);

const DUKE = from({ source: 'Duke', cycle: '2026–27', url: 'https://admissions.duke.edu/apply/', checked: CHECKED }, [
  { id: 'duke-why', title: 'Why Duke', text: 'What is your impression of Duke as a university and community, and why do you believe it is a good match for your goals, values, and interests? If there is something specific that attracts you to our academic offerings in Trinity College of Arts and Sciences or the Pratt School of Engineering, or to our co-curricular opportunities, feel free to include that, too.', type: 'why_college', wordLimit: 250 },
  { id: 'duke-community', title: 'Communities', text: 'We all belong to communities defined by place, faith, family, culture, interests or shared experience. Tell us about a community that has shaped who you are, any way it has set you apart, and what you’ve learned from being part of it that you hope to bring to Duke.', type: 'community', wordLimit: 250 },
  { id: 'duke-opt-1', title: 'Optional: viewpoints and experiences', text: 'We believe a wide range of viewpoints and experiences is essential to maintaining Duke’s vibrant living and learning community. Please share anything in this context that might help us better understand you and your potential contributions to Duke.', type: 'identity', wordLimit: 250, note: 'Optional; answer at most one of the three.' },
  { id: 'duke-opt-2', title: 'Optional: difference of opinion', text: 'Meaningful dialogue often involves respectful disagreement. Provide an example of a difference of opinion you’ve had with someone you care about. What did you learn from it?', type: 'supplement', wordLimit: 250, note: 'Optional; answer at most one of the three.' },
  { id: 'duke-opt-3', title: 'Optional: something you are excited about', text: 'What’s the last thing that you’ve been really excited about?', type: 'supplement', wordLimit: 250, note: 'Optional; answer at most one of the three.' },
]);

const COLUMBIA = from({ source: 'Columbia', cycle: '2026–2027', url: 'https://undergrad.admissions.columbia.edu/apply/process/columbia-questions', checked: CHECKED }, [
  { id: 'columbia-list', title: 'Texts and resources (list)', text: 'List the titles of texts, resources and outlets that have contributed to your intellectual development outside of academic courses, including but not limited to books, journals, websites, podcasts, essays, plays, presentations, videos, museums and other content that you enjoy.', type: 'short_answer', wordLimit: 100, note: 'A list separated by commas or semicolons; no author names or commentary.' },
  { id: 'columbia-1', title: 'Lived experience', text: "Tell us about an aspect of your life so far or your lived experience that is important to you, and describe how it has shaped the way you would learn from and contribute to Columbia's multidimensional and collaborative environment.", type: 'identity', wordLimit: 150 },
  { id: 'columbia-2', title: 'A disagreement', text: 'At Columbia, students representing a wide range of perspectives are invited to live and learn together. In such a community, questions and debates naturally arise. Please describe a time when you did not agree with someone and discuss how you engaged with them and what you took away from the interaction.', type: 'supplement', wordLimit: 150 },
  { id: 'columbia-3', title: 'Navigating adversity', text: 'In college/university, students are often challenged in ways that they could not anticipate. Please describe a situation in which you have navigated through adversity and discuss how you changed as a result.', type: 'challenge', wordLimit: 150 },
  { id: 'columbia-4', title: 'Why Columbia', text: 'Why are you interested in attending Columbia University? We encourage you to consider the aspect(s) that you find unique and compelling about Columbia.', type: 'why_college', wordLimit: 150 },
  { id: 'columbia-5', title: 'Areas of study', text: 'What attracts you to your preferred areas of study at Columbia College or Columbia Engineering?', type: 'why_major', wordLimit: 150 },
]);

const HARVARD = from({ source: 'Harvard', cycle: null, url: 'https://college.harvard.edu/resources/faq/what-included-harvard-supplement', checked: CHECKED }, [
  { id: 'harvard-1', title: 'Contributing to Harvard', text: 'Harvard has long recognized the importance of enrolling a student body with a diversity of perspectives and experiences. How will the life experiences that shaped who you are today enable you to contribute to Harvard?', type: 'identity', wordLimit: 150 },
  { id: 'harvard-2', title: 'A strong disagreement', text: 'Describe a time when you strongly disagreed with someone about an idea or issue. How did you communicate or engage with this person? What did you learn from this experience?', type: 'supplement', wordLimit: 150 },
  { id: 'harvard-3', title: 'Activities and responsibilities', text: 'Briefly describe any of your extracurricular activities, employment experience, travel, or family responsibilities that have shaped who you are.', type: 'extracurricular', wordLimit: 150 },
  { id: 'harvard-4', title: 'Using your Harvard education', text: 'How do you hope to use your Harvard education in the future?', type: 'why_college', wordLimit: 150 },
  { id: 'harvard-5', title: 'Top 3 things for your roommates', text: 'Top 3 things your roommates might like to know about you.', type: 'short_answer', wordLimit: 150 },
]);

export const LIBRARY: LibraryPrompt[] = [
  ...COMMON_APP, ...UC, ...YALE, ...STANFORD, ...MIT, ...PRINCETON, ...UCHICAGO, ...DUKE, ...COLUMBIA, ...HARVARD,
];

export const LIBRARY_BY_ID = new Map(LIBRARY.map((p) => [p.id, p]));

export const SOURCES = [...new Set(LIBRARY.map((p) => p.source))];
