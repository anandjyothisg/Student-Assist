import recorded from './recordedAnswers.json';

/*
 * Everything on the landing page that looks like product output is real:
 * answers and passages were recorded from the running demo library (see
 * recordedAnswers.json), numbers come from config/settings/base.py and the
 * course manifests in server/demo_content.
 */

export const RECORDED = recorded;
export const ANSWERS = Object.fromEntries(recorded.answers.map((a) => [a.id, a]));

export const LIBRARY = { courses: 6, topics: 36, documents: 52 };
export const RAG = { chunk: 1000, overlap: 200, topK: 6, maxDistance: 0.45, coverage: 0.6 };

/*
 * Hero loop: three recorded answers. `cite` is the citation the thread ties to,
 * `highlight` the exact sentence of that passage that supports the answer, and
 * `lead` how much of the verbatim answer fits on the card.
 */
export const HERO_SCENES = [
  {
    id: 'pk',
    cite: 1,
    highlight: 'Primary key: the candidate key chosen by the designer to identify tuples.',
    lead: 'A primary key is the candidate key chosen by the designer to identify tuples in a relation. Its attributes may not be NULL (entity integrity). [1]',
  },
  {
    id: 'heap',
    cite: 2,
    highlight: "Max-heap: every node's key is greater than or equal to the keys of its children, so the maximum is at the root.",
    lead: "A heap guarantees the Heap Property, which states that every node's key is either greater than or equal to (in a max-heap) or less than or equal to (in a min-heap) the keys of its children. [1][2]",
  },
  {
    id: 'bcnf',
    cite: 3,
    highlight: 'BCNF X is a superkey',
    lead: 'BCNF stands for Boyce-Codd Normal Form. It is a normal form that requires every non-trivial functional dependency to have a key as its determinant. [1][2][3]',
  },
];

/* Answer lab: the order of the question chips. */
export const LAB_ORDER = ['pk', 'gd', 'heap', 'bcnf', 'worldcup'];

/* Course → unit → topic → document, from server/demo_content/database-systems/manifest.json. */
export const COURSE_TREE = {
  code: 'CS-305',
  title: 'Database Management Systems',
  teacher: 'Ravi Menon',
  units: [
    { title: 'Relational Model and SQL', topics: ['Relational Model and ER Modelling', 'SQL Fundamentals'] },
    { title: 'Database Design and Query Processing', topics: ['Functional Dependencies and Normal Forms', 'Relational Algebra and Query Processing'] },
    { title: 'Transactions, Concurrency and Storage', topics: ['Transactions and Concurrency Control', 'Indexing, Storage and Recovery'] },
  ],
};

/* The six demo courses, from the manifests in server/demo_content. */
export const COURSES = [
  { code: 'CS-201', title: 'Data Structures and Algorithms', teacher: 'Ananya Rao', docs: 9 },
  { code: 'CS-304', title: 'Operating Systems', teacher: 'Ravi Menon', docs: 9 },
  { code: 'CS-305', title: 'Database Management Systems', teacher: 'Ravi Menon', docs: 10 },
  { code: 'CS-308', title: 'Computer Networks', teacher: 'Elena Fischer', docs: 8 },
  { code: 'ML-302', title: 'Machine Learning', teacher: 'Daniel Reyes', docs: 8 },
  { code: 'AI-301', title: 'Artificial Intelligence', teacher: 'Daniel Reyes', docs: 8 },
];

/* Real passages the thread band weaves through (titles and pages from the recorded retrievals). */
export const BAND_CARDS = [
  { n: 1, code: 'CS-305', title: 'Relational Model and ER Modelling', page: 1 },
  { n: 2, code: 'ML-302', title: 'Gradient Descent Worked Example', page: 1 },
  { n: 3, code: 'CS-201', title: 'Heaps and Priority Queues', page: 1 },
  { n: 4, code: 'CS-305', title: 'Functional Dependencies and Normal Forms', page: 3 },
];
