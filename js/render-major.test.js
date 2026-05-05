const { groupMajorAllergens } = require('./render-major');

function makeFood(name, status, tests = {}) {
  return { name, status, test1: tests[0]||'', test2: tests[1]||'', test3: tests[2]||'', test4: tests[3]||'', last_consumed: '' };
}

test('groups allergens into in-progress, safe, not-started', () => {
  const major = [
    makeFood('Egg',    'UNSAFE', ['2026-04-01', '2026-04-08']),
    makeFood('Dairy',  'SAFE',   ['x','x','x','x']),
    makeFood('Sesame', 'UNKNOWN'),
  ];
  const { inProgress, safe, notStarted } = groupMajorAllergens(major);
  expect(inProgress.map(f=>f.name)).toContain('Egg');
  expect(safe.map(f=>f.name)).toContain('Dairy');
  expect(notStarted.map(f=>f.name)).toContain('Sesame');
});

test('UNKNOWN with one test goes to inProgress, not notStarted', () => {
  const major = [makeFood('Peanut', 'UNKNOWN', ['2026-04-01'])];
  const { inProgress, notStarted } = groupMajorAllergens(major);
  expect(inProgress.map(f=>f.name)).toContain('Peanut');
  expect(notStarted.map(f=>f.name)).not.toContain('Peanut');
});

test('empty array produces empty groups', () => {
  const { inProgress, safe, notStarted } = groupMajorAllergens([]);
  expect(inProgress).toHaveLength(0);
  expect(safe).toHaveLength(0);
  expect(notStarted).toHaveLength(0);
});
