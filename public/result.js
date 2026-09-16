// public/result.js
const params = new URLSearchParams(location.search);
const EXAM_ID = params.get('id');

async function load() {
  const res = await fetch(`/api/exams/${EXAM_ID}/result`);
  if (!res.ok) {
    document.getElementById('content').innerHTML =
      '<div class="loading">Result not found.</div>';
    return;
  }
  const data = await res.json();
  render(data);
}

function render(data) {
  const { exam, details, byDomain, pass_threshold, total_score } = data;
  const passed = !!exam.passed;

  const domainRows = Object.entries(byDomain).map(([domain, s]) => {
    const pct = Math.round((s.correct / s.total) * 100);
    const color = pct >= 85 ? 'var(--green)'
                : pct >= 60 ? 'var(--yellow)'
                : 'var(--red)';
    return `
      <div class="domain-row" style="border-left-color:${color}">
        <span>${escapeHtml(domain)}</span>
        <span><strong style="color:${color}">${s.correct}/${s.total}</strong> · ${pct}%</span>
      </div>`;
  }).join('');

  const reviewItems = details.map((d, i) => {
    const isCorrect = (d.user_answer || '').toUpperCase() === d.answer.toUpperCase();

    const optionLetters = ['A', 'B', 'C', 'D', 'E'];
    const optionsHtml = optionLetters.map(letter => {
      const text = d['option_' + letter.toLowerCase()];
      if (!text || text.trim() === '') return '';
      let cls = '';
      let tag = '';
      if (letter === d.answer) {
        cls = 'correct';
        tag = '✓ correct';
      } else if (letter === d.user_answer && !isCorrect) {
        cls = 'incorrect';
        tag = '✗ your answer';
      }
      return `
        <div class="answer-row ${cls}">
          <strong>${letter}.</strong> ${escapeHtml(text)}
          ${tag ? `<em style="opacity:.8;margin-left:8px;">(${tag})</em>` : ''}
        </div>`;
    }).join('');

    const userTag = d.user_answer
      ? (isCorrect
          ? `<span style="color:var(--green)">You answered: ${d.user_answer} ✓</span>`
          : `<span style="color:var(--red)">You answered: ${d.user_answer}</span>`)
      : `<span style="color:var(--muted)">Not answered</span>`;

    return `
      <div class="review-item ${isCorrect ? 'correct' : 'incorrect'}">
        <div class="q-number">Question ${i + 1} · ${escapeHtml(d.domain)}</div>
        <div class="q-text" style="font-size:1rem;">${escapeHtml(d.question)}</div>
        <div style="margin:8px 0 12px;">${userTag}</div>
        ${optionsHtml}
      </div>`;
  }).join('');

  document.getElementById('content').innerHTML = `
    <div class="result-hero ${passed ? 'pass' : 'fail'}">
      <div class="score-label">Your Score</div>
      <div class="score-big ${passed ? 'pass' : 'fail'}">${exam.score}</div>
      <div class="score-label">out of ${total_score} · Pass mark ${pass_threshold}</div>
      <h2 style="margin-top:16px;color:${passed ? 'var(--green)' : 'var(--red)'}">
        ${passed ? '🎉 PASSED' : '❌ NOT PASSED'}
      </h2>
      <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;">
        <button class="btn btn-primary" id="retake-btn">Retake Exam</button>
        <a href="index.html" class="btn btn-ghost">Back to Dashboard</a>
      </div>
    </div>

    <h2>Performance by Domain</h2>
    ${domainRows}

    <h2 style="margin-top:32px;">Full Review</h2>
    ${reviewItems}
  `;

  document.getElementById('retake-btn').addEventListener('click', async () => {
    await fetch(`/api/exams/${exam.id}/reset`, { method: 'POST' });
    location.href = `exam.html?id=${exam.id}`;
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

load();