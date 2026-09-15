// server.js
const express = require('express');
const path = require('path');
const { initDb, seedQuestions, buildExamBundles } = require('./db');

const db = initDb();
seedQuestions(db);
buildExamBundles(db);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PASS_SCORE = 850;
const TOTAL_SCORE = 1000;

/* ---------------- API ---------------- */

// List bundles
app.get('/api/bundles', (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.bundle_number, e.created_at, e.completed_at, e.score, e.total, e.passed,
      (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id AND eq.user_answer IS NOT NULL) as answered
    FROM exams e
    ORDER BY e.bundle_number
  `).all();
  res.json(rows);
});

// Start / fetch an exam
app.get('/api/exams/:id', (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const questions = db.prepare(`
    SELECT q.id, q.domain, q.question,
      q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
      eq.position, eq.user_answer
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.position
  `).all(exam.id);

  res.json({ exam, questions });
});

// Reset an exam (fresh attempt)
app.post('/api/exams/:id/reset', (req, res) => {
  db.prepare('UPDATE exam_questions SET user_answer = NULL WHERE exam_id = ?').run(req.params.id);
  db.prepare('UPDATE exams SET completed_at = NULL, score = NULL, passed = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Submit answers
app.post('/api/exams/:id/submit', (req, res) => {
  const { answers } = req.body; // { [questionId]: "A"|"B"|... }
  const examId = Number(req.params.id);

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const rows = db.prepare(`
    SELECT eq.question_id, q.answer AS correct, eq.position, q.domain
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
  `).all(examId);

  let correctCount = 0;
  const details = [];

  const update = db.prepare(
    'UPDATE exam_questions SET user_answer = ? WHERE exam_id = ? AND question_id = ?'
  );

  const tx = db.transaction(() => {
    for (const r of rows) {
      const ua = answers?.[r.question_id] ?? null;
      update.run(ua, examId, r.question_id);
      const isCorrect = ua && ua.toUpperCase() === r.correct.toUpperCase();
      if (isCorrect) correctCount++;
      details.push({
        question_id: r.question_id,
        domain: r.domain,
        user_answer: ua,
        correct_answer: r.correct,
        correct: !!isCorrect
      });
    }

    const score = Math.round((correctCount / rows.length) * TOTAL_SCORE);
    const passed = score >= PASS_SCORE ? 1 : 0;

    db.prepare(
      'UPDATE exams SET completed_at = CURRENT_TIMESTAMP, score = ?, passed = ? WHERE id = ?'
    ).run(score, passed, examId);
  });
  tx();

  const updated = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  res.json({
    score: updated.score,
    total: TOTAL_SCORE,
    passed: !!updated.passed,
    pass_threshold: PASS_SCORE,
    correct: correctCount,
    incorrect: rows.length - correctCount,
    details
  });
});

// Result page data
app.get('/api/exams/:id/result', (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const details = db.prepare(`
    SELECT eq.position, eq.user_answer, q.id as question_id, q.domain, q.question,
      q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.answer
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.position
  `).all(exam.id);

  // Domain breakdown
  const byDomain = {};
  for (const d of details) {
    byDomain[d.domain] ||= { correct: 0, total: 0 };
    byDomain[d.domain].total++;
    if ((d.user_answer || '').toUpperCase() === d.answer.toUpperCase()) {
      byDomain[d.domain].correct++;
    }
  }

  res.json({
    exam,
    total_score: TOTAL_SCORE,
    pass_threshold: PASS_SCORE,
    details,
    byDomain
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KCNA Prep running at http://localhost:${PORT}`));