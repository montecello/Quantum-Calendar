(function(){
  const WEEK_START = 0; // 0=Sun, 1=Mon
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function getWeekdayLabels() {
    const base = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    if (WEEK_START === 1) return base.slice(1).concat(base.slice(0,1));
    return base;
  }

  function getMonthMatrix(year, month) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const daysInMonth = last.getDate();

    let startIdx = first.getDay(); // 0=Sun..6=Sat
    startIdx = (startIdx - WEEK_START + 7) % 7;

    const cells = [];
    for (let i = 0; i < startIdx; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return { weeks, daysInMonth };
  }

  function applySpecialDayClasses(td, dateStr) {
    try {
      if (typeof window.getSpecialDayClassesForISO === 'function') {
        const cls = window.getSpecialDayClassesForISO(dateStr) || [];
        if (cls && cls.length) {
          console.log('Gregorian cell', dateStr, 'special classes:', cls);
        }
        cls.forEach(c => td.classList.add(c));
      } else {
        console.warn('window.getSpecialDayClassesForISO is not a function');
      }
    } catch (e) {
      console.error('Error in applySpecialDayClasses for', dateStr, e);
    }
  }

  function markCurrentDay(td, y, m, d) {
    const today = new Date();
    if (y === today.getFullYear() && m === today.getMonth() && d === today.getDate()) {
      td.classList.add('current-day');
    }
  }

  function render(rootEl, year, month) {
    if (!rootEl) return;
    rootEl.innerHTML = '';

    // Build table matching existing CSS expectations
    const table = document.createElement('table');
    table.className = 'calendar-grid';

    // Header with month label
    const thead = document.createElement('thead');
    const labelRow = document.createElement('tr');
    const thLabel = document.createElement('th');
    thLabel.colSpan = 7;
    thLabel.className = 'month-label';
    thLabel.textContent = `${MONTH_NAMES[month]} ${year}`;
    labelRow.appendChild(thLabel);
    thead.appendChild(labelRow);

    // Weekday labels
    const trh = document.createElement('tr');
    for (const lbl of getWeekdayLabels()) {
      const th = document.createElement('th');
      th.textContent = lbl;
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    const { weeks } = getMonthMatrix(year, month);
    for (const wk of weeks) {
      const tr = document.createElement('tr');
      for (const dayNum of wk) {
        const td = document.createElement('td');
        td.className = 'day-cell';
        if (dayNum != null) {
          const d = new Date(year, month, dayNum);
          const dateStr = isoDate(d);
          td.dataset.iso = dateStr;
          td.dataset.gregorian = 'true';
          td.tabIndex = 0;

          const span = document.createElement('span');
          span.className = 'holiday-daynum';
          span.textContent = String(dayNum);
          td.appendChild(span);

          applySpecialDayClasses(td, dateStr);
          markCurrentDay(td, year, month, dayNum);
        } else {
          td.classList.add('empty-cell');
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    rootEl.appendChild(table);

    // Dispatch event so calendar.js can bind navigation/animations
    document.dispatchEvent(new CustomEvent('gregorian:rendered', { detail: { year, month } }));
  }

  window.GregorianCalendar = { render, isoDate, weekStart: WEEK_START };
})();
