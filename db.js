// db.js
const Database = require('better-sqlite3');
const path = require('path');
const { QUESTIONS, DOMAIN_WEIGHTS } = require('./questions');

const DB_PATH = path.join(__dirname, 'kcna.db');

function initDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      domain TEXT NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      option_e TEXT NOT NULL DEFAULT '',
      answer TEXT NOT NULL,
      multi_select INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bundle_number INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      score INTEGER,
      total INTEGER,
      passed INTEGER
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      exam_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      user_answer TEXT,
      PRIMARY KEY (exam_id, position),
      FOREIGN KEY (exam_id) REFERENCES exams(id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );
  `);
  return db;
}

function seedQuestions(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
  if (count > 0) {
    console.log(`Questions already seeded (${count} rows). Skipping.`);
    return;
  }

  const insert = db.prepare(`
    INSERT INTO questions
    (id, domain, question, option_a, option_b, option_c, option_d, option_e, answer, multi_select)
    VALUES (@id, @domain, @question, @a, @b, @c, @d, @e, @answer, 0)
  `);

  const tx = db.transaction((rows) => {
    for (const q of rows) {
      insert.run({
        id: q.id,
        domain: q.domain,
        question: q.q,
        a: q.options[0] || '',
        b: q.options[1] || '',
        c: q.options[2] || '',
        d: q.options[3] || '',
        e: q.options[4] || '',
        answer: q.answer
      });
    }
  });

  tx(QUESTIONS);
  console.log(`Seeded ${QUESTIONS.length} questions.`);
}

/**
 * Build 12 exam bundles, each with 60 questions, weighted by KCNA blueprint.
 * Scoring: 1000 total points; pass mark = 850 (85%).
 * Distribution per bundle:
 *   K8s Fundamentals: 18, Container Orchestration: 12,
 *   Cloud Native Architecture: 12, Observability: 9, Delivery: 9  => 60
 */
const NUM_BUNDLES = 12;
const QUESTIONS_PER_BUNDLE = 60;
const DISTRIBUTION = {
  "Kubernetes Fundamentals": 18,
  "Container Orchestration": 12,
  "Cloud Native Architecture": 12,
  "Cloud Native Observability": 9,
  "Cloud Native Application Delivery": 9
};

function buildExamBundles(db) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM exams').get().c;
  if (existing > 0) {
    console.log(`Exams already exist (${existing}). Skipping.`);
    return;
  }

  // Load all questions grouped by domain
  const byDomain = {};
  for (const row of db.prepare('SELECT id, domain FROM questions').all()) {
    (byDomain[row.domain] ||= []).push(row.id);
  }

  // For non-overlapping bundles across 12 exams, we need
  // per-domain count * NUM_BUNDLES unique questions.
  for (const [domain, perBundle] of Object.entries(DISTRIBUTION)) {
    const need = perBundle * NUM_BUNDLES;
    const have = (byDomain[domain] || []).length;
    if (have < need) {
      throw new Error(
        `Not enough unique questions in "${domain}" for ${NUM_BUNDLES} non-overlapping bundles. ` +
        `Need ${need}, have ${have}.`
      );
    }
  }

  // Shuffle the pool per domain once, then slice sequentially — this guarantees
  // no question is reused across bundles.
  const shuffledByDomain = {};
  for (const [domain, ids] of Object.entries(byDomain)) {
    shuffledByDomain[domain] = [...ids].sort(() => Math.random() - 0.5);
  }

  const createExam = db.prepare('INSERT INTO exams (bundle_number, total) VALUES (?, ?)');
  const linkQ = db.prepare('INSERT INTO exam_questions (exam_id, question_id, position) VALUES (?, ?, ?)');

  const tx = db.transaction(() => {
    // Track cursor per domain
    const cursors = {};
    for (const d of Object.keys(DISTRIBUTION)) cursors[d] = 0;

    for (let bundle = 1; bundle <= NUM_BUNDLES; bundle++) {
      const info = createExam.run(bundle, QUESTIONS_PER_BUNDLE);
      const examId = info.lastInsertRowid;

      // Build this bundle's question list
      const bundleQuestions = [];
      for (const [domain, perBundle] of Object.entries(DISTRIBUTION)) {
        const pool = shuffledByDomain[domain];
        const start = cursors[domain];
        bundleQuestions.push(...pool.slice(start, start + perBundle));
        cursors[domain] += perBundle;
      }

      // Shuffle the final bundle so domains are interleaved
      const shuffled = [...bundleQuestions].sort(() => Math.random() - 0.5);

      // Insert with position 1..60
      shuffled.forEach((qid, i) => linkQ.run(examId, qid, i + 1));
    }
  });

  tx();
  console.log(`Created ${NUM_BUNDLES} exam bundles × ${QUESTIONS_PER_BUNDLE} questions each.`);
}

if (require.main === module) {
  const db = initDb();
  if (process.argv.includes('--reseed')) {
    db.exec('DELETE FROM exam_questions; DELETE FROM exams; DELETE FROM questions;');
    console.log('Cleared existing data.');
  }
  seedQuestions(db);
  buildExamBundles(db);
  db.close();
  console.log('Database ready at', DB_PATH);
}

module.exports = { initDb, seedQuestions, buildExamBundles, DB_PATH };