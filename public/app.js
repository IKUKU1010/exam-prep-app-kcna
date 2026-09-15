async function loadBundles() {
  const res = await fetch('/api/bundles');
  const bundles = await res.json();
  const container = document.getElementById('bundles');

  container.innerHTML = bundles.map(b => {
    let badge, action;
    if (b.completed_at) {
      badge = b.passed
        ? `<span class="badge pass">Passed · ${b.score}/1000</span>`
        : `<span class="badge fail">Failed · ${b.score}/1000</span>`;
      action = `<button class="btn btn-ghost" data-action="review" data-id="${b.id}">Review</button>
                <button class="btn btn-primary" data-action="start" data-id="${b.id}">Retake</button>`;
    } else if (b.answered > 0) {
      badge = `<span class="badge progress">In progress · ${b.answered}/60</span>`;
      action = `<button class="btn btn-primary" data-action="start" data-id="${b.id}">Resume</button>`;
    } else {
      badge = `<span class="badge new">Not started</span>`;
      action = `<button class="btn btn-primary" data-action="start" data-id="${b.id}">Start Exam</button>`;
    }

    return `
      <div class="bundle-card" data-action="start" data-id="${b.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3>Exam Bundle ${b.bundle_number}</h3>
          ${badge}
        </div>
        <div class="hint">60 questions · 70 minutes · Weighted by KCNA domains</div>
        <div style="display:flex;gap:8px;margin-top:auto;">${action}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = el.dataset.id;
      const action = el.dataset.action;
      if (action === 'start') {
        location.href = `exam.html?id=${id}`;
      } else if (action === 'review') {
        location.href = `result.html?id=${id}`;
      }
    });
  });
}
loadBundles();