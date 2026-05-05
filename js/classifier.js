const CATEGORIES = {
  Fruits: [
    'watermelon', 'pomegranate', 'persimmon', 'clementine', 'cantaloupe',
    'blackberry', 'blueberry', 'raspberry', 'strawberry', 'apricot',
    'avocado', 'banana', 'cherry', 'guava', 'honeydew', 'lychee',
    'mango', 'nectarine', 'orange', 'papaya', 'peach', 'pear',
    'plum', 'tomato', 'grape', 'apple', 'kiwi', 'fig',
  ],
  Vegetables: [
    'butternut squash', 'brussels sprouts', 'sweet potato', 'swiss chard',
    'green beans', 'snap peas', 'bell pepper', 'bok choy', 'artichoke',
    'asparagus', 'cauliflower', 'eggplant', 'parsnip', 'pumpkin',
    'zucchini', 'broccoli', 'cucumber', 'spinach', 'fennel', 'potato',
    'radish', 'carrot', 'celery', 'garlic', 'onion', 'leek',
    'beet', 'corn', 'kale', 'peas',
  ],
  Meats: [
    'sardine', 'chicken', 'herring', 'turkey', 'venison', 'rabbit',
    'salmon', 'lamb', 'duck', 'beef', 'pork', 'tuna',
  ],
};

function classifyFood(name) {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        return category;
      }
    }
  }
  return 'Other';
}

if (typeof module !== 'undefined') module.exports = { classifyFood };
