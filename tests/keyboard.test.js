const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function keyboard() {
  let handler;
  const actions = [];
  const context = {
    window: { addEventListener: (name, fn) => { if (name === 'keydown') handler = fn; } },
    document: {
      querySelector: selector => ({ click: () => actions.push(selector) }),
      getElementById: () => ({}),
    },
    restoreLocalDraft: () => false,
    t: key => key,
    undo: () => actions.push('undo'),
    redo: () => actions.push('redo'),
    copySelection: () => actions.push('copy'),
    pasteSelection: () => actions.push('paste'),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8'), context);
  return {
    actions,
    press: (options = {}) => handler({
      key: '1', target: { closest: () => null },
      preventDefault: () => actions.push('preventDefault'), ...options,
    }),
  };
}

test('typing and selecting values never trigger canvas shortcuts', () => {
  for (const tag of ['input', 'textarea', 'select', '[role="textbox"]']) {
    const app = keyboard();
    app.press({ target: { closest: selector => selector.includes(tag) ? {} : null } });
    assert.deepEqual(app.actions, [], tag);
  }
  const app = keyboard();
  app.press({ target: { isContentEditable: true } });
  assert.deepEqual(app.actions, []);
});

test('IME composition and handled events leave the active tool unchanged', () => {
  const app = keyboard();
  app.press({ key: 'w', isComposing: true });
  app.press({ key: 'w', defaultPrevented: true });
  assert.deepEqual(app.actions, []);
});

test('browser modifier shortcuts do not switch tools or views', () => {
  const app = keyboard();
  app.press({ ctrlKey: true });
  app.press({ metaKey: true });
  app.press({ altKey: true, key: 'd' });
  assert.deepEqual(app.actions, []);
});

test('canvas shortcuts and undo still work outside editable controls', () => {
  const app = keyboard();
  app.press();
  app.press({ key: 'w' });
  app.press({ key: 'z', ctrlKey: true });
  app.press({ key: 'z', metaKey: true, shiftKey: true });
  assert.deepEqual(app.actions, [
    '[data-mode="2d"]', '[data-tool="wall"]',
    'preventDefault', 'undo', 'preventDefault', 'redo',
  ]);
});
