/**
 * Renders the 7-day schedule calendar into #section-schedule.
 * @param {object} schedule - from buildSchedule()
 * @param {function} openLog - callback(name, sub, status)
 */
function renderSchedule(schedule, openLog) {
  const el = document.getElementById('section-schedule');
  if (!el) return;

  const dates = Object.keys(schedule).sort();
  const today = new Date().toISOString().slice(0, 10);

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Header row
  let headerCells = '<div></div>';
  dates.forEach(iso => {
    const d = new Date(iso + 'T12:00:00Z');
    const dayLabel = DAY_LABELS[d.getUTCDay()];
    const num = d.getUTCDate();
    const isToday = iso === today;
    headerCells += `
      <div class="cal-day${isToday ? ' today' : ''}">
        ${dayLabel}<span class="num">${isToday ? `<span style="background:var(--accent);color:white;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">${num}</span>` : num}</span>
      </div>`;
  });

  // AM row
  let amCells = '<div class="cal-slot">AM</div>';
  dates.forEach(iso => {
    const slots = schedule[iso].am;
    amCells += `<div class="cal-cell">${slots.map(f => foodChip(f, openLog, iso)).join('')}</div>`;
  });

  // PM row
  let pmCells = '<div class="cal-slot">PM</div>';
  dates.forEach(iso => {
    const slots = schedule[iso].pm;
    pmCells += `<div class="cal-cell">${slots.map(f => foodChip(f, openLog, iso)).join('')}</div>`;
  });

  el.innerHTML = `
    <div class="section-label">Schedule · Week of ${formatWeekLabel(dates[0])}</div>
    <div class="cal-scroll-wrap">
      <div class="calendar">
        <div class="cal-header">${headerCells}</div>
        <div class="cal-row">${amCells}</div>
        <div class="cal-row">${pmCells}</div>
      </div>
    </div>
    <div class="cal-legend">
      <strong style="color:var(--text)">Key</strong> · <span style="background:var(--never-light);color:#dc2626;font-weight:700;border-radius:4px;padding:1px 4px;font-size:11px;">Red</span> = allergen test · Plain text = safe food in rotation
    </div>`;

  // Attach click handlers for test slots
  el.querySelectorAll('.cal-food[data-test="true"]').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();
      openLog(chip.dataset.name, `Test ${chip.dataset.testnum} · Log today's feeding`, 'unknown');
    });
  });
}

function foodChip(food, openLog, iso) {
  if (food.isTest) {
    return `<span class="cal-food test" data-test="true" data-name="${food.name}" data-testnum="${food.testNumber || ''}" style="cursor:pointer">${food.name} T${food.testNumber || ''}</span>`;
  }
  return `<span class="cal-food">${food.name}</span>`;
}

function formatWeekLabel(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

if (typeof module !== 'undefined') module.exports = { renderSchedule };
