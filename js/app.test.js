const { getCaretaker } = require('./app');

beforeEach(() => {
  global.localStorage = { store: {}, getItem(k){ return this.store[k]||null; }, setItem(k,v){ this.store[k]=v; }, clear(){ this.store={}; } };
  global.prompt = jest.fn();
});

test('returns stored name without prompting', () => {
  localStorage.setItem('caretaker_name', 'Rose');
  expect(getCaretaker()).toBe('Rose');
  expect(prompt).not.toHaveBeenCalled();
});

test('prompts and stores name when not set', () => {
  localStorage.clear();
  prompt.mockReturnValue('Alvin');
  expect(getCaretaker()).toBe('Alvin');
  expect(localStorage.getItem('caretaker_name')).toBe('Alvin');
});

test('stores Unknown if prompt is cancelled', () => {
  localStorage.clear();
  prompt.mockReturnValue(null);
  expect(getCaretaker()).toBe('Unknown');
});
