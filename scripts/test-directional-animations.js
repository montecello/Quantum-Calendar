// Headless test: ensure slide-left/slide-right classes are applied when nav buttons clicked
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

(async function(){
  try {
    // Create a JSDOM window
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="calendar-grid-root"><div id="calendar-grid-anim"></div></div>
      <button id="prev-month-btn"></button>
      <button id="next-month-btn"></button>
      <button id="prev-year-btn"></button>
      <button id="next-year-btn"></button>
      <button id="home-month-btn"></button>
    </body></html>`, { runScripts: 'outside-only' });

    const sandbox = {
      window: dom.window,
      document: dom.window.document,
      console,
      setTimeout,
      clearTimeout,
      fetch: () => Promise.resolve({ json: () => Promise.resolve([]) }),
      navigator: dom.window.navigator,
      location: dom.window.location
    };
    // Provide globals that calendar.js expects
    sandbox.window.navState = sandbox.window.navState || {
      lat: 51.48, lon: 0, tz: 'Europe/London', locationName: 'Greenwich', yearsData: [], currentYearIdx: 0, currentMonthIdx:0
    };
    sandbox.window.CalendarMode = sandbox.window.CalendarMode || { mode: 'custom' };

    // Load calendar.js into the sandbox
    const code = fs.readFileSync('./frontend/static/js/calendar.js', 'utf8');
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'calendar.js' });

    // Ensure functions we added exist
    if (typeof sandbox.findQuantumIndexForDate !== 'function') {
      console.error('Helper not found in eval'); process.exit(2);
    }
    if (typeof sandbox.rebindNavForGregorian !== 'function') {
      // rebindNavForGregorian is a function declaration in the file; check under window
      if (typeof sandbox.window.rebindNavForGregorian === 'function') sandbox.rebindNavForGregorian = sandbox.window.rebindNavForGregorian;
      else { console.error('rebindNavForGregorian not found'); process.exit(3); }
    }

    // Bind nav handlers
    sandbox.rebindNavForGregorian();

    const grid = sandbox.document.getElementById('calendar-grid-anim');
    const next = sandbox.document.getElementById('next-month-btn');
    const prev = sandbox.document.getElementById('prev-month-btn');

    // Simulate next click
    next.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    // Allow setTimeout callbacks
    await new Promise(r => setTimeout(r, 50));

    const hasRight = grid.classList.contains('slide-right');

    // Simulate prev click
    prev.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    const hasLeft = grid.classList.contains('slide-left');

    console.log('slide-right present after next:', hasRight);
    console.log('slide-left present after prev:', hasLeft);

    if (hasRight && hasLeft) {
      console.log('TEST PASS'); process.exit(0);
    } else {
      console.error('TEST FAIL'); process.exit(4);
    }
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  }
})();
