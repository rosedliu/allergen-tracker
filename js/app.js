function getCaretaker() {
  let name = localStorage.getItem('caretaker_name');
  if (!name || !name.trim()) {
    name = (prompt("What's your name? (Used to track who logs feedings)") || 'Unknown').trim();
    localStorage.setItem('caretaker_name', name);
  }
  return name;
}

if (typeof module !== 'undefined') module.exports = { getCaretaker };
