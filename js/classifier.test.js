const { classifyFood } = require('./classifier');

test.each([
  ['Blueberry', 'Fruits'],
  ['Sweet Potato', 'Vegetables'],
  ['Chicken', 'Meats'],
  ['Quinoa', 'Other'],
  ['BLUEBERRY', 'Fruits'],
  ['Unknown XYZ', 'Other'],
  ['Snap Peas', 'Vegetables'],
  ['Brussels Sprouts', 'Vegetables'],
])('classifyFood("%s") → "%s"', (input, expected) => {
  expect(classifyFood(input)).toBe(expected);
});
