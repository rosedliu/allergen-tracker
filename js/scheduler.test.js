const { buildSchedule } = require('./scheduler');

const MONDAY = new Date('2026-05-04T12:00:00Z'); // Monday

function makeSafe(name) {
  return { name, status: 'SAFE', test1: '2026-01-01', test2: '2026-01-08', test3: '2026-01-15', test4: '2026-01-22', last_consumed: '2026-05-01' };
}
function makeUnknown(name) {
  return { name, status: 'UNKNOWN', test1: '', test2: '', test3: '', test4: '', last_consumed: '' };
}
function makeUnsafe(name) {
  return { name, status: 'UNSAFE', test1: '2026-04-01', test2: '', test3: '', test4: '', last_consumed: '2026-04-01' };
}

// ── Constraint: UNKNOWN/UNSAFE only on weekday AM ─────────────────────────

test('UNKNOWN allergen never appears on weekend', () => {
  const major = [makeUnknown('Sesame')];
  const schedule = buildSchedule({ major, today: MONDAY });
  ['2026-05-09', '2026-05-10'].forEach(date => {
    const day = schedule[date];
    expect(day.am.map(f => f.name)).not.toContain('Sesame');
    expect(day.pm.map(f => f.name)).not.toContain('Sesame');
  });
});

test('UNKNOWN allergen never appears in PM slot', () => {
  const major = [makeUnknown('Sesame')];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    const pmTests = day.pm.filter(f => f.isTest);
    expect(pmTests.length).toBe(0);
  });
});

test('UNSAFE allergen never appears on weekend', () => {
  const major = [makeUnsafe('Egg')];
  const schedule = buildSchedule({ major, today: MONDAY });
  ['2026-05-09', '2026-05-10'].forEach(date => {
    const day = schedule[date];
    [...day.am, ...day.pm].forEach(f => {
      if (f.isTest) expect(f.name).not.toBe('Egg');
    });
  });
});

test('no more than 1 test food per day', () => {
  const major = [makeUnknown('Sesame'), makeUnknown('Walnut'), makeUnsafe('Egg')];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    const tests = [...day.am, ...day.pm].filter(f => f.isTest);
    expect(tests.length).toBeLessThanOrEqual(1);
  });
});

// ── Constraint: SAFE foods appear ≥ 3x per week ──────────────────────────

test('single SAFE allergen appears at least 3 times in 7 days', () => {
  const major = [makeSafe('Dairy')];
  const schedule = buildSchedule({ major, today: MONDAY });
  const appearances = Object.values(schedule)
    .flatMap(d => [...d.am, ...d.pm])
    .filter(f => f.name === 'Dairy').length;
  expect(appearances).toBeGreaterThanOrEqual(3);
});

test('multiple SAFE allergens each appear at least 3 times', () => {
  const major = [makeSafe('Dairy'), makeSafe('Soy')];
  const schedule = buildSchedule({ major, today: MONDAY });
  ['Dairy', 'Soy'].forEach(name => {
    const count = Object.values(schedule)
      .flatMap(d => [...d.am, ...d.pm])
      .filter(f => f.name === name).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ── Constraint: no same food in both AM and PM same day ──────────────────

test('no food appears in both AM and PM on the same day', () => {
  const major = [makeSafe('Dairy'), makeSafe('Soy')];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    const amNames = day.am.map(f => f.name);
    const pmNames = day.pm.map(f => f.name);
    const overlap = amNames.filter(n => pmNames.includes(n));
    expect(overlap).toHaveLength(0);
  });
});

// ── Nut grouping ─────────────────────────────────────────────────────────

test('all-safe nuts appear as grouped "Nuts (mixed)" slot', () => {
  const nuts = ['Peanut', 'Almond', 'Cashew', 'Walnut'].map(makeSafe);
  const schedule = buildSchedule({ major: nuts, today: MONDAY });
  const nutSlots = Object.values(schedule)
    .flatMap(d => [...d.am, ...d.pm])
    .filter(f => f.name === 'Nuts (mixed)');
  expect(nutSlots.length).toBeGreaterThanOrEqual(3);
});

test('partial nuts are NOT grouped — each appears individually', () => {
  const major = [makeSafe('Peanut'), makeUnknown('Almond'), makeUnknown('Cashew'), makeUnknown('Walnut')];
  const schedule = buildSchedule({ major, today: MONDAY });
  const mixed = Object.values(schedule)
    .flatMap(d => [...d.am, ...d.pm])
    .filter(f => f.name === 'Nuts (mixed)');
  expect(mixed.length).toBe(0);
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
