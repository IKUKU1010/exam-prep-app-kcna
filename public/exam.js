// public/exam.js
const params = new URLSearchParams(location.search);
const EXAM_ID = params.get('id');
const DURATION_SECONDS = 70 * 60;

let exam, questions, currentIndex = 0;
const answers = {}; // questionId -> letter
let timeLeft = DURATION_SECONDS;
let timerHandle = null;
let locked = false;

const $ = (id) => document.getElementById(id);

async function load() {
  const res = await fetch(`/api/exams/${EXAM_ID}`);
  if (!res.ok) {
    document.body.innerHTML = '<div class="loading">Exam not found.</div>';
    return;
  }
  const data = await res.json();
  exam = data.exam;
  questions = data.questions;

  // Load any previously saved answers (for resume)
  for (const q of questions) if (q.user_answer) answers[q.id] = q.user_answer;

  $('bundle-title').textContent = `Bundle ${exam.bundle_number}`;

  if (exam.completed_at) {
    locked = true;
    $('timer').textContent = 'Completed';
    $('submit-btn').disabled = true;
  } else {
    startTimer();
  }

  renderQuestion();
  renderPalette();
}

function startTimer() {
  timerHandle = setInterval(() => {
    if (locked) return;
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerHandle);
      submitExam(true);
    }
  }, 1000);
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const s = (timeLeft % 60).toString().padStart(2, '0');
  const el = $('timer');
  el.textContent = `${m}:${s}`;
  el.classList.remove('warn', 'danger');
  if (timeLeft <= 60) el.classList.add('danger');
  else if (timeLeft <= 300) el.classList.add('warn');
}

function renderQuestion() {
  const q = questions[currentIndex];
  const selected = answers[q.id];

  $('progress-text').textContent = `Question ${currentIndex + 1} of ${questions.length}`;
  $('progress-fill').style.width = `${((currentIndex + 1) / questions.length) * 100}%`;

  // Build options list — skip empty ones
  const options = [
    ['A', q.option_a], ['B', q.option_b], ['C', q.option_c],
    ['D', q.option_d], ['E', q.option_e]
  ].filter(([, text]) => text && text.trim() !== '');

  $('question-container').innerHTML = `
    <div class="question-card">
      <div class="q-number">Question ${currentIndex + 1}</div>
      <div class="q-domain">${escapeHtml(q.domain)}</div>
      <div class="q-text">${escapeHtml(q.question)}</div>
      <div class="options">
        ${options.map(([letter, text]) => `
          <div class="option ${selected === letter ? 'selected' : ''}" data-letter="${letter}">
            <div class="option-letter">${letter}</div>
            <div>${escapeHtml(text)}</div>
          </div>`).join('')}
      </div>
    </div>
  `;

  document.querySelectorAll('.option').forEach(el => {
    el.addEventListener('click', () => {
      if (locked) return;
      answers[q.id] = el.dataset.letter;
      renderQuestion();
      renderPalette();
    });
  });

  $('prev-btn').disabled = currentIndex === 0 || locked;
  $('next-btn').disabled = currentIndex === questions.length - 1 || locked;

  renderPalette();
}

function renderPalette() {
  $('palette').innerHTML = questions.map((q, i) => {
    const cls = [
      answers[q.id] ? 'answered' : '',
      i === currentIndex ? 'current' : ''
    ].join(' ');
    return `<button class="${cls}" data-idx="${i}" ${locked ? 'disabled' : ''}>${i + 1}</button>`;
  }).join('');
  document.querySelectorAll('.palette button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (locked) return;
      currentIndex = Number(btn.dataset.idx);
      renderQuestion();
    });
  });
}

async function submitExam(auto = false) {
  if (locked) return;
  if (!auto) {
    const unanswered = questions.length - Object.keys(answers).length;
    const msg = unanswered > 0
      ? `You have ${unanswered} unanswered question(s). Submit anyway?`
      : 'Submit your exam?';
    if (!confirm(msg)) return;
  } else {
    alert('Time is up! Your exam has been submitted automatically.');
  }
  locked = true;
  clearInterval(timerHandle);

  // Ensure every question has a user_answer (null for unanswered)
  const payload = {};
  for (const q of questions) payload[q.id] = answers[q.id] || null;

  const res = await fetch(`/api/exams/${EXAM_ID}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: payload })
  });
  if (!res.ok) {
    alert('Failed to submit.');
    locked = false;
    return;
  }
  location.href = `result.html?id=${EXAM_ID}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

$('prev-btn').addEventListener('click', () => {
  if (currentIndex > 0 && !locked) { currentIndex--; renderQuestion(); }
});
$('next-btn').addEventListener('click', () => {
  if (currentIndex < questions.length - 1 && !locked) { currentIndex++; renderQuestion(); }
});
$('submit-btn').addEventListener('click', () => submitExam(false));

load();