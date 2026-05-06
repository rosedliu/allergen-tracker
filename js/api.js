const API_URL = 'https://script.google.com/macros/s/AKfycbyKXCur60ZRtQA2PcolYvWTTmyczKi-45-X5MmfQnZC6MGzzk8Zgpbapqdj45klzuP4xQ/exec';

async function fetchAll() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(API_URL, { signal: controller.signal });
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Writes go through GET to avoid CORS preflight on POST
async function postAction(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const url = API_URL + '?payload=' + encodeURIComponent(JSON.stringify(payload));
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

if (typeof module !== 'undefined') module.exports = { fetchAll, postAction, API_URL };
