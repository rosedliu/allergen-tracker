const API_URL = 'REPLACE_WITH_YOUR_APPS_SCRIPT_EXEC_URL';

async function fetchAll() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(API_URL, { signal: controller.signal });
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function postAction(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// For browser use (not Node module)
if (typeof module !== 'undefined') module.exports = { fetchAll, postAction, API_URL };
