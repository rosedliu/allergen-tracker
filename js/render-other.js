const OTHER_CATEGORIES = ['Fruits', 'Vegetables', 'Meats', 'Other'];
const CATEGORY_ICONS = { Fruits: '🍎', Vegetables: '🥦', Meats: '🍗', Other: '🍽' };

/**
 * Renders Other Foods section into #section-other.
 * @param {Array}    otherFoods - from fetchAll()
 * @param {function} openLog    - callback(name, sub, status)
 * @param {function} openAddFood
 */
function renderOtherFoods(otherFoods, openLog, openAddFood) {
  const el = document.getElementById('section-other');
  if (!el) return;

  let html = '';

  OTHER_CATEGORIES.forEach(cat => {
    const foods = otherFoods.filter(f => f.category === cat);
    html += `<div class="card">`;
    html += `<div class="cat-label">${CATEGORY_ICONS[cat] || ''} ${cat} <span class="cat-count">${foods.length}</span></div>`;

    foods.forEach(food => {
      const meta = foodMeta(food);
      const sub  = foodSub(food);
      html += `
        <div class="food-row" data-name="${food.name}" data-sub="${sub}" data-status="${(food.status||'unknown').toLowerCase()}">
          <div>
            <div class="food-name">${food.name}</div>
            <div class="food-meta">${meta}</div>
          </div>
          <span class="badge ${(food.status||'UNKNOWN').toLowerCase()}">${food.status || 'UNKNOWN'}</span>
        </div>`;
    });

    if (cat === 'Other') {
      html += `<div class="add-food-row" id="add-food-trigger"><span style="font-size:18px;line-height:1;">＋</span> Add food</div>`;
    }

    html += `</div>`;
  });

  el.innerHTML = html;

  el.querySelectorAll('.food-row').forEach(row => {
    row.addEventListener('click', () => {
      openLog(row.dataset.name, row.dataset.sub, row.dataset.status);
    });
  });

  const addBtn = el.querySelector('#add-food-trigger');
  if (addBtn) addBtn.addEventListener('click', openAddFood);
}

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function foodMeta(food) {
  const s = (food.status || 'UNKNOWN').toUpperCase();
  if (s === 'SAFE')    return food.last_consumed ? `Last: ${fmtDate(food.last_consumed)}` : 'Safe';
  if (s === 'UNSAFE')  return `${food.tests_completed || 0} of 2 tests · Last: ${fmtDate(food.last_consumed)}`;
  if (s === 'NEVER')   return 'Marked never';
  return 'Never tried';
}

function foodSub(food) {
  const s = (food.status || 'UNKNOWN').toUpperCase();
  if (s === 'SAFE')   return 'Log consumption';
  if (s === 'UNSAFE') return `${food.tests_completed || 0} of 2 tests done`;
  if (s === 'NEVER')  return 'Marked never';
  return 'First introduction';
}

if (typeof module !== 'undefined') module.exports = { renderOtherFoods };
