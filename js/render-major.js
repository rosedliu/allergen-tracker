/**
 * Groups major allergens and returns the three display buckets.
 * Pure function — testable without DOM.
 */
function groupMajorAllergens(major) {
  const inProgress = major.filter(f =>
    (f.status === 'UNSAFE' || f.status === 'UNKNOWN') &&
    ['test1','test2','test3','test4'].some(k => !!f[k])
  );
  const safe       = major.filter(f => f.status === 'SAFE');
  const notStarted = major.filter(f =>
    f.status === 'UNKNOWN' && !['test1','test2','test3','test4'].some(k => !!f[k])
  );
  return { inProgress, safe, notStarted };
}

function countTestsDone(food) {
  return ['test1','test2','test3','test4'].filter(k => !!food[k]).length;
}

/**
 * Renders the Major Allergens section into #section-major.
 * @param {Array}  major    - from fetchAll()
 * @param {object} schedule - from buildSchedule()
 * @param {function} openLog - callback(name, sub, status)
 */
function renderMajorAllergens(major, schedule, openLog) {
  const el = document.getElementById('section-major');
  if (!el) return;

  const { inProgress, safe, notStarted } = groupMajorAllergens(major);

  let html = '';

  if (inProgress.length) {
    html += subLabel('In progress');
    html += '<div class="card">';
    inProgress.forEach(f => { html += allergenRow(f, schedule, true, openLog); });
    html += '</div>';
  }

  if (safe.length) {
    html += subLabel('Safe · In rotation');
    html += '<div class="card">';
    safe.forEach(f => { html += allergenRow(f, schedule, false, openLog); });
    html += '</div>';
  }

  if (notStarted.length) {
    html += subLabel('Not yet started · Weekday AM only');
    html += '<div class="card">';
    notStarted.forEach(f => { html += allergenRow(f, schedule, false, openLog); });
    html += '</div>';
  }

  el.innerHTML = html;

  // Attach click handlers after render
  el.querySelectorAll('.allergen-row').forEach(row => {
    row.addEventListener('click', () => {
      const name   = row.dataset.name;
      const sub    = row.dataset.sub;
      const status = row.dataset.status;
      openLog(name, sub, status);
    });
  });
}

function allergenRow(food, schedule, inProgress, openLog) {
  const done    = countTestsDone(food);
  const isSafe  = food.status === 'SAFE';
  const nextServe = isSafe ? getNextServe(food.name, schedule) : null;
  const sub     = isSafe
    ? 'Log consumption'
    : done === 0 ? 'First introduction' : `Test ${done + 1} of 4`;

  const dots = isSafe
    ? '<div class="dot filled"></div>'.repeat(4)
    : '<div class="dot filled"></div>'.repeat(done) + '<div class="dot empty"></div>'.repeat(4 - done);

  return `
    <div class="allergen-row${inProgress ? ' in-progress' : ''}"
         data-name="${food.name}" data-sub="${sub}" data-status="${food.status.toLowerCase()}">
      <div class="row-icon">${allergenIcon(food.name)}</div>
      <div class="row-body">
        <div class="row-name">${food.name}</div>
        ${isSafe ? '' : `<div class="dots">${dots}</div>`}
        ${!isSafe && food.last_consumed ? `<div class="row-meta">Last: ${food.last_consumed}</div>` : ''}
      </div>
      <div class="row-right">
        <span class="badge ${food.status.toLowerCase()}">${food.status}</span>
        ${nextServe ? `<span class="next-chip">${nextServe}</span>` : ''}
      </div>
    </div>`;
}

function getNextServe(name, schedule) {
  const days = Object.entries(schedule);
  for (const [iso, day] of days) {
    const allSlots = [...day.am, ...day.pm];
    if (allSlots.some(f => f.name === name || f.name === 'Nuts (mixed)')) {
      const date = new Date(iso + 'T12:00:00Z');
      const today = new Date();
      today.setUTCHours(12,0,0,0);
      const diff = Math.round((date - today) / 86400000);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }
  return null;
}

const ICONS = {
  Peanut: '🥜', Almond: '🌰', Sesame: '🌱', Egg: '🥚',
  Cashew: '🥜', Walnut: '🌰', Soy: '🫘', Dairy: '🥛',
  Whitefish: '🐟', Shellfish: '🦐',
};
function allergenIcon(name) {
  return ICONS[name] || '🍽';
}

if (typeof module !== 'undefined') module.exports = { groupMajorAllergens, renderMajorAllergens };
