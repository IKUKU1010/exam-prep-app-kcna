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
      option_e TEXT NOT NULL,
      answer TEXT NOT NULL
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
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO questions
    (id, domain, question, option_a, option_b, option_c, option_d, option_e, answer)
    VALUES (@id, @domain, @question, @a, @b, @c, @d, @e, @answer)
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
 * Build 5 exam bundles, each with 60 questions, weighted by KCNA blueprint.
 * Scoring: 1000 total points; pass mark = 850 (85%).
 * Distribution per bundle:
 *   K8s Fundamentals: 18, Container Orchestration: 12,
 *   Cloud Native Architecture: 12, Observability: 9, Delivery: 9  => 60
 */
function buildExamBundles(db) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM exams').get().c;
  if (existing > 0) return;

  const DISTRIBUTION = {
    "Kubernetes Fundamentals": 18,
    "Container Orchestration": 12,
    "Cloud Native Architecture": 12,
    "Cloud Native Observability": 9,
    "Cloud Native Application Delivery": 9
  };

  const byDomain = {};
  for (const q of db.prepare('SELECT id, domain FROM questions').all()) {
    (byDomain[q.domain] ||= []).push(q.id);
  }

  const createExam = db.prepare('INSERT INTO exams (bundle_number, total) VALUES (?, 60)');
  const linkQ = db.prepare('INSERT INTO exam_questions (exam_id, question_id, position) VALUES (?, ?, ?)');

  const tx = db.transaction(() => {
    for (let bundle = 1; bundle <= 5; bundle++) {
      const info = createExam.run(bundle);
      const examId = info.lastInsertRowid;
      let pos = 1;
      const used = new Set();

      for (const [domain, count] of Object.entries(DISTRIBUTION)) {
        const pool = [...byDomain[domain]].sort(() => Math.random() - 0.5);
        let picked = 0;
        for (const qid of pool) {
          if (picked >= count) break;
          if (used.has(qid)) continue;
          used.add(qid);
          linkQ.run(examId, qid, pos++);
          picked++;
        }
        if (picked < count) {
          throw new Error(`Not enough questions in domain ${domain} (need ${count}, have ${pool.length})`);
        }
      }
    }
  });

  tx();
  console.log('Created 5 exam bundles x 60 questions each.');
}

if (require.main === module) {
  const db = initDb();
  if (process.argv.includes('--reseed')) {
    db.exec('DELETE FROM exam_questions; DELETE FROM exams; DELETE FROM questions;');
  }
  seedQuestions(db);
  buildExamBundles(db);
  db.close();
  console.log('Database ready at', DB_PATH);
}

module.exports = { initDb, seedQuestions, buildExamBundles, DB_PATH };