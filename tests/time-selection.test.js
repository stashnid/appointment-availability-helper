const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'extension', 'helper.js'), 'utf8');
const start = source.indexOf('  function times() {');
const end = source.indexOf('  async function step(r) {', start);
assert(start >= 0 && end > start, 'Could not locate the actual time selection function');

function availableTimes(labels) {
  const elements = labels.map(label => ({innerText: label}));
  const context = {
    document: {querySelectorAll: () => elements},
    visible: () => true,
    enabled: () => true,
    text: element => element.innerText,
    getComputedStyle: () => ({cursor: 'pointer'}),
  };
  const times = vm.runInNewContext(`${source.slice(start, end)}; times`, context);
  return Array.from(times(), element => element.innerText);
}

assert.deepEqual(availableTimes(['15:00', '13:59', '14:30', '14:00']), ['13:59', '14:00', '14:30', '15:00']);
assert.deepEqual(availableTimes(['15:00', '08:00', '14:30']), ['08:00', '14:30', '15:00']);
assert.deepEqual(availableTimes(['16:00', '14:30', '15:00']), ['14:30', '15:00', '16:00']);
assert.deepEqual(availableTimes(['13:59', '14:30', '15:00']), ['13:59', '14:30', '15:00']);
assert.deepEqual(availableTimes(['13:59', '13:30']), ['13:30', '13:59']);
assert.deepEqual(availableTimes([]), []);

console.log('Time selection: earliest available time wins, including slots before 14:00.');
