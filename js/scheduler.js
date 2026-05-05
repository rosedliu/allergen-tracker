const NUT_NAMES = ['Peanut', 'Almond', 'Cashew', 'Walnut'];

/**
 * Build a 7-day feeding schedule.
 * @param {object} opts
 * @param {Array}  opts.major - major allergen objects from Sheets
 * @param {Date}   opts.today - start date
 * @returns {object} { [isoDate]: { am: FoodSlot[], pm: FoodSlot[], isWeekday: bool } }
 *   FoodSlot = { name, isTest, testNumber? }
 */
function buildSchedule({ major, today }) {
  const days = getNext7Days(today);
  const schedule = {};
  days.forEach(d => {
    schedule[d.iso] = { am: [], pm: [], isWeekday: d.isWeekday };
  });

  const safe   = getSafeSlots(major);
  const toTest = major.filter(f => f.status === 'UNKNOWN' || f.status === 'UNSAFE');
  const weekdays = days.filter(d => d.isWeekday);

  // 1. Slot one test food per weekday AM, max one per day
  toTest.forEach((food, i) => {
    if (i >= weekdays.length) return;
    const testNum = countTestsDone(food) + 1;
    schedule[weekdays[i].iso].am.push({ name: food.name, isTest: true, testNumber: testNum });
  });

  // 2. Distribute safe foods across AM/PM slots (≥3x per week, no same-day overlap)
  distributeSafeFoods(schedule, safe, days);

  return schedule;
}

// ── Safe food distribution ────────────────────────────────────────────────

function distributeSafeFoods(schedule, safe, days) {
  if (safe.length === 0) return;

  // Each safe food needs at least 3 appearances in 7 days.
  // We have 14 slots (7 AM + 7 PM). Fill greedily in round-robin,
  // respecting: no same food twice on same day.

  // Build ordered slot list: [Mon-AM, Mon-PM, Tue-AM, Tue-PM, ...]
  const slots = [];
  days.forEach(d => {
    slots.push({ iso: d.iso, slot: 'am' });
    slots.push({ iso: d.iso, slot: 'pm' });
  });

  // Assign safe foods via round-robin to hit ≥3 per food
  // Cap total assignments so we don't overfill slots
  const assignments = []; // { iso, slot, name }
  const countMap = {};
  safe.forEach(f => { countMap[f] = 0; });

  // First pass: guarantee 3 for each
  for (let pass = 0; pass < 3; pass++) {
    safe.forEach(foodName => {
      for (const s of slots) {
        const day = schedule[s.iso];
        const alreadyThisDay = [...day.am, ...day.pm].map(f => f.name);
        const slotArr = day[s.slot];
        if (!alreadyThisDay.includes(foodName) && slotArr.length < 2) {
          slotArr.push({ name: foodName, isTest: false });
          countMap[foodName]++;
          break;
        }
      }
    });
  }

  // Second pass: fill remaining open slots for diversity
  slots.forEach(s => {
    const day = schedule[s.iso];
    const slotArr = day[s.slot];
    if (slotArr.length >= 2) return;
    const usedToday = [...day.am, ...day.pm].map(f => f.name);
    // Find safe food with fewest appearances not yet used today
    const candidate = safe
      .filter(n => !usedToday.includes(n))
      .sort((a, b) => (countMap[a] || 0) - (countMap[b] || 0))[0];
    if (candidate) {
      slotArr.push({ name: candidate, isTest: false });
      countMap[candidate]++;
    }
  });
}

// ── Nut grouping ─────────────────────────────────────────────────────────

/**
 * Returns the list of effective "safe slot names" to distribute.
 * If all 4 nuts are SAFE, collapse them into 'Nuts (mixed)'.
 * Otherwise each nut is listed individually.
 */
function getSafeSlots(major) {
  const safeNames = major.filter(f => f.status === 'SAFE').map(f => f.name);
  const allNutsSafe = NUT_NAMES.every(n => safeNames.includes(n));

  return safeNames
    .filter(n => !NUT_NAMES.includes(n))
    .concat(allNutsSafe ? ['Nuts (mixed)'] : safeNames.filter(n => NUT_NAMES.includes(n)));
}

// ── Date helpers ─────────────────────────────────────────────────────────

function getNext7Days(today) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const dow = d.getUTCDay(); // 0=Sun, 6=Sat
    days.push({
      iso: d.toISOString().slice(0, 10),
      isWeekday: dow >= 1 && dow <= 5,
    });
  }
  return days;
}

function countTestsDone(food) {
  return ['test1', 'test2', 'test3', 'test4'].filter(k => !!food[k]).length;
}

if (typeof module !== 'undefined') module.exports = { buildSchedule };
