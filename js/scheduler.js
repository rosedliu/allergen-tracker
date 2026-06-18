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

  const safeNames = major.filter(f => f.status === 'SAFE' && isScheduled(f)).map(f => f.name);

  const dairyUnblocked = ['Shellfish', 'Whitefish'].every(name => {
    const food = major.find(f => f.name === name);
    return !food || food.status === 'SAFE';
  });

  const unsafeFoods  = major.filter(f => f.status === 'UNSAFE'  && (f.name !== 'Dairy' || dairyUnblocked));
  const unknownFoods = major.filter(f => f.status === 'UNKNOWN' && (f.name !== 'Dairy' || dairyUnblocked));
  const weekdays = days.filter(d => d.isWeekday);
  let weekdayIdx = 0;

  // Complete all remaining tests for each UNSAFE allergen before starting any UNKNOWN
  for (const food of unsafeFoods) {
    const done      = countTestsDone(food);
    const remaining = 4 - done;
    for (let t = 0; t < remaining && weekdayIdx < weekdays.length; t++) {
      const slot = { name: food.name, isTest: true, testNumber: done + t + 1 };
      schedule[weekdays[weekdayIdx].iso].am.push({ ...slot });
      schedule[weekdays[weekdayIdx].iso].pm.push({ ...slot });
      weekdayIdx++;
    }
  }

  // Fill remaining weekday slots with first tests for UNKNOWN allergens
  for (const food of unknownFoods) {
    if (weekdayIdx >= weekdays.length) break;
    const slot = { name: food.name, isTest: true, testNumber: 1 };
    schedule[weekdays[weekdayIdx].iso].am.push({ ...slot });
    schedule[weekdays[weekdayIdx].iso].pm.push({ ...slot });
    weekdayIdx++;
  }

  // Safe foods: PM-only on weekdays, both meals on weekends, ≤3x/week
  distributeSafeFoods(schedule, safeNames, days);

  return schedule;
}

// ── Safe food distribution ────────────────────────────────────────────────

function distributeSafeFoods(schedule, safe, days) {
  if (safe.length === 0) return;

  const weekends    = days.filter(d => !d.isWeekday);
  const weekdaysArr = days.filter(d => d.isWeekday);

  // Peanut+Almond are scheduled as an atomic pair (always together or not at all)
  const pairActive = safe.includes('Peanut') && safe.includes('Almond');
  const soloFoods  = pairActive
    ? safe.filter(n => n !== 'Peanut' && n !== 'Almond')
    : safe;

  const countMap = {};
  safe.forEach(n => { countMap[n] = 0; });

  // Place Peanut+Almond together into an empty slot (pair needs 2 spaces)
  function tryPlacePair(iso, slot) {
    if (countMap['Peanut'] >= 3) return false;
    const day = schedule[iso];
    const slotArr = day[slot];
    if (slotArr.length > 0) return false; // needs a fully empty slot
    const usedToday = [...day.am, ...day.pm].map(f => f.name);
    if (usedToday.includes('Peanut') || usedToday.includes('Almond')) return false;
    slotArr.push({ name: 'Peanut', isTest: false });
    slotArr.push({ name: 'Almond', isTest: false });
    countMap['Peanut']++;
    countMap['Almond']++;
    return true;
  }

  // Place a single safe food; can share only with a test food (fills the second spot)
  function tryPlace(name, iso, slot) {
    if (countMap[name] >= 3) return false;
    const day = schedule[iso];
    const slotArr = day[slot];
    const usedToday = [...day.am, ...day.pm].map(f => f.name);
    if (usedToday.includes(name)) return false;
    if (slotArr.length >= 2) return false;
    if (slotArr.length === 1 && !slotArr[0].isTest) return false;
    slotArr.push({ name, isTest: false });
    countMap[name]++;
    return true;
  }

  const fillSlots = [
    ...weekdaysArr.map(d => ({ iso: d.iso, slot: 'pm' })),
    ...weekends.flatMap(d => [{ iso: d.iso, slot: 'am' }, { iso: d.iso, slot: 'pm' }]),
  ];

  // Schedule pair
  if (pairActive) {
    for (const d of weekends) {
      if (tryPlacePair(d.iso, 'am') || tryPlacePair(d.iso, 'pm')) break;
    }
    for (const s of fillSlots) {
      if (countMap['Peanut'] >= 3) break;
      tryPlacePair(s.iso, s.slot);
    }
  }

  // Schedule solo foods
  soloFoods.forEach(name => {
    for (const d of weekends) {
      if (tryPlace(name, d.iso, 'am')) break;
      if (tryPlace(name, d.iso, 'pm')) break;
    }
  });

  soloFoods.forEach(name => {
    for (const s of fillSlots) {
      if (countMap[name] >= 3) break;
      tryPlace(name, s.iso, s.slot);
    }
  });
}

// ── Date helpers ─────────────────────────────────────────────────────────

function getNext7Days(today) {
  const days = [];
  // Anchor on today's *local* calendar date, then do the 7-day walk in UTC
  // (toISOString() alone would shift "today" to tomorrow once UTC has
  // rolled over past local midnight, e.g. evenings in US timezones).
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    const dow = d.getUTCDay(); // 0=Sun, 6=Sat
    days.push({
      iso: d.toISOString().slice(0, 10),
      isWeekday: dow >= 1 && dow <= 5,
    });
  }
  return days;
}

function localISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isScheduled(food) {
  const v = food.in_schedule;
  if (v === undefined || v === null || v === '') return true;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() !== 'false';
}

function countTestsDone(food) {
  return ['test1', 'test2', 'test3', 'test4'].filter(k => !!food[k]).length;
}

if (typeof module !== 'undefined') module.exports = { buildSchedule, localISODate };
