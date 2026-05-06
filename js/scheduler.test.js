const { buildSchedule } = require('./scheduler');

const MONDAY = new Date('2026-05-04T12:00:00Z');

function makeSafe(name) {
  return { name, status: 'SAFE', test1: 'x', test2: 'x', test3: 'x', test4: 'x', last_consumed: '2026-05-01' };
}
function makeUnknown(name) {
  return { name, status: 'UNKNOWN', test1: '', test2: '', test3: '', test4: '', last_consumed: '' };
}
function makeUnsafe(name) {
  return { name, status: 'UNSAFE', test1: '2026-04-01', test2: '', test3: '', test4: '', last_consumed: '2026-04-01' };
}

// ── Test allergen rules ───────────────────────────────────────────────────

test('test allergen appears in BOTH AM and PM on test day', () => {
  const major = [makeUnknown('Sesame')];
  const schedule = buildSchedule({ major, today: MONDAY });
  const testDay = Object.values(schedule).find(d =>
    d.am.some(f => f.isTest && f.name === 'Sesame')
  );
  expect(testDay).toBeDefined();
  expect(testDay.pm.some(f => f.isTest && f.name === 'Sesame')).toBe(true);
});

test('test allergen never appears on weekends', () => {
  const major = [makeUnknown('Sesame')];
  const schedule = buildSchedule({ major, today: MONDAY });
  ['2026-05-09', '2026-05-10'].forEach(date => {
    expect(schedule[date].am.some(f => f.isTest)).toBe(false);
    expect(schedule[date].pm.some(f => f.isTest)).toBe(false);
  });
});

test('no more than 1 test allergen per day', () => {
  const major = [makeUnknown('Sesame'), makeUnknown('Walnut'), makeUnsafe('Egg')];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    const testNames = new Set([...day.am, ...day.pm].filter(f => f.isTest).map(f => f.name));
    expect(testNames.size).toBeLessThanOrEqual(1);
  });
});

test('UNSAFE allergen fills all remaining test slots before UNKNOWN allergens start', () => {
  // Egg is UNSAFE with 1 test done → needs 3 more (T2, T3, T4)
  // Sesame and Walnut are UNKNOWN → should not appear until Egg is done
  const major = [makeUnknown('Sesame'), makeUnknown('Walnut'), makeUnsafe('Egg')];
  const schedule = buildSchedule({ major, today: MONDAY });
  const weekdayEntries = Object.entries(schedule).filter(([, d]) => d.isWeekday);

  // First 3 weekdays should be Egg (T2, T3, T4)
  [0, 1, 2].forEach(i => {
    const [, day] = weekdayEntries[i];
    expect(day.am.every(f => f.name === 'Egg')).toBe(true);
  });

  // UNKNOWN allergens only appear from weekday 4 onward
  const unknownDays = weekdayEntries.slice(3);
  const hasUnknownEarly = weekdayEntries.slice(0, 3).some(([, d]) =>
    [...d.am, ...d.pm].some(f => f.isTest && f.name !== 'Egg')
  );
  expect(hasUnknownEarly).toBe(false);
});

// ── SAFE allergen rules ───────────────────────────────────────────────────

test('SAFE allergen never appears in weekday AM', () => {
  const major = [makeSafe('Dairy')];
  const schedule = buildSchedule({ major, today: MONDAY });
  ['2026-05-04','2026-05-05','2026-05-06','2026-05-07','2026-05-08'].forEach(date => {
    expect(schedule[date].am.some(f => f.name === 'Dairy')).toBe(false);
  });
});

test('SAFE allergen appears at most 3 times per week', () => {
  const major = [makeSafe('Dairy')];
  const schedule = buildSchedule({ major, today: MONDAY });
  const count = Object.values(schedule)
    .flatMap(d => [...d.am, ...d.pm])
    .filter(f => f.name === 'Dairy').length;
  expect(count).toBeLessThanOrEqual(3);
});

test('SAFE allergen appears at least once on a weekend', () => {
  const major = [makeSafe('Dairy')];
  const schedule = buildSchedule({ major, today: MONDAY });
  const weekendSlots = ['2026-05-09','2026-05-10']
    .flatMap(d => [...schedule[d].am, ...schedule[d].pm]);
  expect(weekendSlots.some(f => f.name === 'Dairy')).toBe(true);
});

test('multiple SAFE allergens each appear at most 3 times', () => {
  const major = [makeSafe('Dairy'), makeSafe('Soy'), makeSafe('Egg')];
  const schedule = buildSchedule({ major, today: MONDAY });
  ['Dairy', 'Soy', 'Egg'].forEach(name => {
    const count = Object.values(schedule)
      .flatMap(d => [...d.am, ...d.pm])
      .filter(f => f.name === name).length;
    expect(count).toBeLessThanOrEqual(3);
  });
});

test('SAFE allergen does not appear in same slot as test allergen same day (unless test is also in PM)', () => {
  const major = [makeUnknown('Sesame'), makeSafe('Dairy')];
  const schedule = buildSchedule({ major, today: MONDAY });
  // On the test day, AM should only have the test food (no safe foods in weekday AM)
  Object.entries(schedule).forEach(([iso, day]) => {
    if (day.isWeekday) {
      const safeInAM = day.am.filter(f => !f.isTest);
      expect(safeInAM).toHaveLength(0);
    }
  });
});

// ── Peanut/Almond pairing ─────────────────────────────────────────────────

test('Peanut and Almond always appear together — never one without the other', () => {
  const major = [makeSafe('Peanut'), makeSafe('Almond')];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    ['am', 'pm'].forEach(slot => {
      const hasPeanut = day[slot].some(f => f.name === 'Peanut');
      const hasAlmond = day[slot].some(f => f.name === 'Almond');
      expect(hasPeanut).toBe(hasAlmond);
    });
  });
});

test('non-paired safe foods do not share a slot with each other', () => {
  const major = [makeSafe('Dairy'), makeSafe('Soy')];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    ['am', 'pm'].forEach(slot => {
      const safeNonPair = day[slot].filter(f => !f.isTest && !['Peanut','Almond'].includes(f.name));
      expect(safeNonPair.length).toBeLessThanOrEqual(1);
    });
  });
});

test('no slot has more than 2 items', () => {
  const major = [makeSafe('Dairy'), makeSafe('Soy'), makeSafe('Egg'), makeUnknown('Sesame')];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    expect(day.am.length).toBeLessThanOrEqual(2);
    expect(day.pm.length).toBeLessThanOrEqual(2);
  });
});

// ── Output shape ─────────────────────────────────────────────────────────

test('schedule covers exactly 7 days starting today', () => {
  const schedule = buildSchedule({ major: [], today: MONDAY });
  expect(Object.keys(schedule)).toHaveLength(7);
  expect(Object.keys(schedule)[0]).toBe('2026-05-04');
  expect(Object.keys(schedule)[6]).toBe('2026-05-10');
});

test('each day has am and pm arrays', () => {
  const schedule = buildSchedule({ major: [], today: MONDAY });
  Object.values(schedule).forEach(day => {
    expect(Array.isArray(day.am)).toBe(true);
    expect(Array.isArray(day.pm)).toBe(true);
  });
});
