const { fetchAll, postAction } = require('./api');

global.fetch = jest.fn();

beforeEach(() => fetch.mockClear());

test('fetchAll calls API_URL and returns parsed JSON', async () => {
  fetch.mockResolvedValue({ json: async () => ({ major: [], otherFoods: [] }) });
  const result = await fetchAll();
  expect(result).toEqual({ major: [], otherFoods: [] });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('postAction sends payload as GET query param', async () => {
  fetch.mockResolvedValue({ json: async () => ({ success: true }) });
  const payload = { action: 'log_feeding', food: 'Egg', isMajor: true, reaction: 'none', caretaker: 'Rose' };
  const result = await postAction(payload);
  expect(result).toEqual({ success: true });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('?payload=' + encodeURIComponent(JSON.stringify(payload))),
    expect.objectContaining({ signal: expect.any(Object) })
  );
});
