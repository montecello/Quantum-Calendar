(() => {
  const canvas = document.getElementById('bg-matrix');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  // Character sets
  const HEBREW = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת'];
  const LATIN_LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const DIGITS = '0123456789'.split('');
  let CHARSET = [...HEBREW, ...LATIN_LOWER, ...DIGITS];
  // Japanese sets (subset)
  const HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんー'.split('');
  const KATA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンーヴ'.split('');
  const JP_STACK = "'Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP','MS PGothic',sans-serif";
  const JAPANESE_PROB = 0.10;
  // Aurebesh (uppercase Latin rendered with Aurebesh.otf in fonts folder)
  const AUREBESH_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const AUREBESH_PROB = 0.10;
  const AUREBESH_FACE_NAME = 'Aurebesh';
  // Korean sets (subset): syllables and jamo
  const HANGUL_SYL = ['과','서','북','남','칼','문','한','길','별','산','물','불','사','랑','힘','빛','꿈'];
  const HANGUL_JAMO = ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ','ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ','ㅣ','ㅗ','ㅓ','ㅏ'];
  const KO_STACK = "'Apple SD Gothic Neo','Noto Sans KR','Nanum Gothic','Malgun Gothic','Segoe UI',sans-serif";
  const KOREAN_PROB = 0.10;
  // Chinese sets (focus numerals + extras)
  const CN_NUM = ['一','二','三','四','五','六','七','八','九','十','百','千','万'];
  const CN_OTHER = ['零','天','地','人','中','国','學','校','心','愛','福','寿','龍','虎','風','雲','星','海','山','川','光','電','時','空','金','木','水','火','土'];
  const CN_STACK = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans SC','Source Han Sans SC','Heiti SC','SimHei','SimSun',sans-serif";
  const CHINESE_PROB = 0.10;

  // Emoji/clock faces
  const CLOCK_EMOJIS = ['🕛','🕧','🕐','🕜','🕑','🕝','🕒','🕞','🕓','🕟','🕔','🕠','🕕','🕡','🕖','🕢','🕗','🕣','🕘','🕤','🕙','🕥','🕚','🕦'];
  const EMOJI_STACK = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  const CLOCK_PROB = 0.10;
  // Celestial emoji (moon phases, sun, stars)
  const CELESTIAL_EMOJIS = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','🌙','☀️','🌞','⭐','🌟','✨','🌠'];
  const CELESTIAL_PROB = 0.10;

  const FONT_PRIMARY = 'HebrewMatrix';
  const FONT_FALLBACK = 'Pictocrypto, sans-serif';
  let currentFont = FONT_PRIMARY;
  let aurebeshAvailable = false;

  // DPR can change on orientation; recompute on resize
  let DPR = Math.max(1, window.devicePixelRatio || 1);
  let width = 0, height = 0;
  let fontSize = 18;
  let colCount = 0;
  let colPitch = 0;
  // Each column now holds multiple drops: [{ pos, speed }]
  let drops = [];
  let hues = [];
  let running = false;
  let rafId = null;

  const settings = {
  // Trails slightly longer and rain a bit slower
  // Increase trailAlpha for faster erasing to avoid colored imprints
  trailAlpha: 0.99,
  minSpeed: 0.08,
  maxSpeed: 0.18,
  replaceProb: 0.15,
  // Fraction of rows per column that can be occupied by drops (0..1)
  densityFrac: 0.99
  };

  // Helper to pick a character and the font family to render it with for a column
  function pickCharForColumn(colIndex) {
    const p = Math.random();
    if (p < AUREBESH_PROB && aurebeshAvailable) {
      return { char: AUREBESH_POOL[(Math.random() * AUREBESH_POOL.length) | 0], fontFamily: AUREBESH_FACE_NAME };
    } else if (p < AUREBESH_PROB + CLOCK_PROB) {
      return { char: CLOCK_EMOJIS[(Math.random() * CLOCK_EMOJIS.length) | 0], fontFamily: EMOJI_STACK };
    } else if (p < AUREBESH_PROB + CLOCK_PROB + CELESTIAL_PROB) {
      return { char: CELESTIAL_EMOJIS[(Math.random() * CELESTIAL_EMOJIS.length) | 0], fontFamily: EMOJI_STACK };
    } else if (p < AUREBESH_PROB + CLOCK_PROB + JAPANESE_PROB) {
      const pool = Math.random() < 0.5 ? HIRA : KATA;
      return { char: pool[(Math.random() * pool.length) | 0], fontFamily: JP_STACK };
    } else if (p < AUREBESH_PROB + CLOCK_PROB + JAPANESE_PROB + KOREAN_PROB && p >= AUREBESH_PROB + CLOCK_PROB + JAPANESE_PROB) {
      const pool = Math.random() < 0.5 ? HANGUL_SYL : HANGUL_JAMO;
      return { char: pool[(Math.random() * pool.length) | 0], fontFamily: KO_STACK };
    } else if (p < AUREBESH_PROB + CLOCK_PROB + JAPANESE_PROB + KOREAN_PROB + CHINESE_PROB && p >= AUREBESH_PROB + CLOCK_PROB + JAPANESE_PROB + KOREAN_PROB) {
      const pool = Math.random() < 0.6 ? CN_NUM : CN_OTHER;
      return { char: pool[(Math.random() * pool.length) | 0], fontFamily: CN_STACK };
    }
    return { char: CHARSET[(Math.random() * CHARSET.length) | 0], fontFamily: currentFont };
  }

  function getViewportSize() {
    const vv = window.visualViewport;
    if (vv && vv.width && vv.height) {
      // Round to integers to avoid subpixel accumulation
      return { w: Math.ceil(vv.width), h: Math.ceil(vv.height) };
    }
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function resize() {
  // Recompute DPR & viewport dims
  DPR = Math.max(1, window.devicePixelRatio || 1);
  const { w: cssW, h: cssH } = getViewportSize();

    // Size canvas backing store and CSS size
    canvas.width = Math.floor(cssW * DPR);
    canvas.height = Math.floor(cssH * DPR);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    // Scale so we can use CSS pixel coordinates
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.textBaseline = 'top';

    width = cssW;
    height = cssH;

  // remember previous sizing so we can preserve drop positions
  const prevFontSize = fontSize;
  const prevColPitch = colPitch;
  const prevColCount = colCount;
  const prevDrops = drops;

  fontSize = Math.max(14, Math.min(28, Math.floor(width / 60)));
  ctx.font = `${fontSize}px ${currentFont}`;

    // Determine column pitch avoiding overlap; measure JP/KO/CN widths too
    let maxW = 0;
    function measureSamples(fontFamily, samples) {
      const prev = ctx.font;
      ctx.font = `${fontSize}px ${fontFamily}`;
      for (const s of samples) {
        const w = ctx.measureText(s).width;
        if (w > maxW) maxW = w;
      }
      ctx.font = prev;
    }
    measureSamples(currentFont, ['מ','w','a','0']);
    measureSamples(JP_STACK, ['あ','カ','ー']);
    measureSamples(KO_STACK, ['과','한','칼','ㅂ']);
  measureSamples(CN_STACK, ['一','中','国']);
  // Measure emoji width to avoid overlap when using emoji glyphs
  measureSamples(EMOJI_STACK, ['🕛','🕐']);

    colPitch = Math.max(Math.ceil(maxW * 1.1), Math.ceil(fontSize * 0.7));

    const newColCount = Math.max(1, Math.floor(width / colPitch));
    const maxRows = Math.floor(height / fontSize) || 1;

    // If we had drops before, remap them into the new column grid to preserve flow
    if (prevDrops && prevDrops.length > 0) {
      const newDrops = new Array(newColCount).fill(0).map(() => []);
      for (let oldCol = 0; oldCol < prevDrops.length; oldCol++) {
        const colArr = prevDrops[oldCol] || [];
        for (const d of colArr) {
          // compute old absolute x and y in CSS pixels, then map to new column and row
          const oldX = oldCol * (prevColPitch || colPitch);
          const absY = (d.pos || 0) * (prevFontSize || fontSize);
          const newCol = Math.min(newColCount - 1, Math.max(0, Math.floor(oldX / colPitch)));
          const newPos = absY / fontSize;
          // update drop pos to maintain visual continuity
          d.pos = newPos;
          d.intRow = Math.floor(d.pos);
          newDrops[newCol].push(d);
        }
      }
      // Ensure every column has at least one drop to keep rain coverage
      for (let c = 0; c < newDrops.length; c++) {
        if (!newDrops[c] || newDrops[c].length === 0) {
          const maxRowsLocal = Math.floor(height / fontSize) || 1;
          const picked = pickCharForColumn(c);
          newDrops[c] = [{ pos: -Math.random() * maxRowsLocal, speed: settings.minSpeed + Math.random() * (settings.maxSpeed - settings.minSpeed), intRow: -1, char: picked.char, fontFamily: picked.fontFamily }];
        }
      }
      drops = newDrops;
      colCount = newColCount;
    } else {
      // First-time initialization
      colCount = newColCount;
      const maxDropsPerCol = Math.max(1, Math.floor(maxRows * Math.max(0, Math.min(1, settings.densityFrac))));
      drops = new Array(colCount).fill(0).map(() => {
        const count = 1 + Math.floor(Math.random() * maxDropsPerCol);
        const arr = [];
        const usedRows = new Set();
        for (let j = 0; j < count; j++) {
          let attempts = 0;
          let pos = -Math.random() * maxRows;
          let iRow = Math.floor(pos);
          while (usedRows.has(iRow) && attempts < 20) {
            pos = -Math.random() * maxRows;
            iRow = Math.floor(pos);
            attempts++;
          }
          usedRows.add(iRow);
          const picked = pickCharForColumn(0);
          arr.push({ pos, speed: settings.minSpeed + Math.random() * (settings.maxSpeed - settings.minSpeed), intRow: iRow, char: picked.char, fontFamily: picked.fontFamily });
        }
        return arr;
      });
    }

    // Recompute hues to match the new column count (preserve order)
    hues = new Array(colCount).fill(0).map((_, i) => (i / Math.max(1, colCount)) * 360);
  }

  function drawFrameLoop() {
    if (!running) { rafId = null; return; }

  // Fade existing pixels toward transparency to avoid permanent imprints
  // Use destination-out so we erase a fraction of existing pixels each frame.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${settings.trailAlpha})`;
  ctx.fillRect(0, 0, width, height);
  // Switch back to normal drawing for the characters
  ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < colCount; i++) {
      const x = i * colPitch;
        const occupied = new Set();
        const colDrops = drops[i];
        for (let dIdx = 0; dIdx < colDrops.length; dIdx++) {
          const d = colDrops[dIdx];
          const intRow = Math.floor(d.pos);
          const y = intRow * fontSize;

          // If we've moved to a new integer row, pick a new char/font and update intRow
          if (d.intRow !== intRow) {
            const picked = pickCharForColumn(i);
            d.char = picked.char;
            d.fontFamily = picked.fontFamily;
            d.intRow = intRow;
          }

          // Draw only if within visible rows and the integer row isn't taken
          if (intRow >= -1 && y <= height + fontSize * 2 && !occupied.has(intRow)) {
            occupied.add(intRow);
            hues[i] = (hues[i] + 0.15) % 360;
            const sat = 80;
            const light = 40;
            ctx.fillStyle = `hsl(${hues[i]}, ${sat}%, ${light}%)`;
            if (Math.random() < settings.replaceProb) {
              ctx.fillStyle = `hsl(${(hues[i] + 30) % 360}, ${sat}%, ${light}%)`;
            }

            const prevFont = ctx.font;
            ctx.font = `${fontSize}px ${d.fontFamily}`;
            ctx.shadowColor = 'rgba(0,0,0,0.12)';
            ctx.shadowBlur = 2;
            ctx.fillText(d.char, x, y);
            ctx.font = prevFont;
          }

          // Advance drop
          d.pos += d.speed * 0.9;

          // Reset if past bottom: choose a start row that doesn't conflict with other drops
          if (d.pos * fontSize > height + fontSize * 2) {
            const maxRow = Math.floor(height / fontSize) || 1;
            let attempts = 0;
            let startRow = -Math.floor(Math.random() * maxRow);
            while (occupied.has(startRow) && attempts < 30) {
              startRow = -Math.floor(Math.random() * maxRow);
              attempts++;
            }
            d.pos = startRow;
            d.speed = settings.minSpeed + Math.random() * (settings.maxSpeed - settings.minSpeed);
            const picked = pickCharForColumn(i);
            d.char = picked.char;
            d.fontFamily = picked.fontFamily;
            d.intRow = Math.floor(d.pos);
          }
        }
    }

    rafId = requestAnimationFrame(drawFrameLoop);
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function start() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stop();
      ctx.clearRect(0, 0, width, height);
      return;
    }
    if (running) return; // already running
    running = true;
    if (!rafId) rafId = requestAnimationFrame(drawFrameLoop);
  }

  async function ensurePrimaryFont() {
    try {
      if (document.fonts && document.fonts.load) {
        await document.fonts.ready;
        await document.fonts.load(`normal 20px ${FONT_PRIMARY}`, 'אבגדabc012');
        // Try to load Aurebesh font from the static fonts folder
        try {
          if (window.FontFace) {
            const af = new FontFace(AUREBESH_FACE_NAME, "url('/static/fonts/Aurebesh.otf') format('opentype')", { style: 'normal', weight: '400' });
            await af.load();
            document.fonts.add(af);
            aurebeshAvailable = document.fonts.check(`normal 20px ${AUREBESH_FACE_NAME}`, 'ABC');
          }
        } catch (e) {
          // ignore font load failures; aurebeshAvailable remains false
        }
        return document.fonts.check(`normal 20px ${FONT_PRIMARY}`, 'אבגדabc012');
      }
    } catch { /* ignore */ }
    return false;
  }

  // Throttled resize handler for orientation/viewport changes
  let resizeTimer = null;
  function scheduleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
  const wasRunning = running;
  // Temporarily stop RAF to avoid buildup during rapid resizes
  stop();
  resize();
  if (wasRunning) start();
    }, 120);
  }

  (async function init(){
    const ok = await ensurePrimaryFont();
    if (!ok) {
      // Use fallback consistently to avoid Times-like mix
      currentFont = FONT_FALLBACK;
      // Keep only lowercase+digits to ensure glyphs exist on fallback
      CHARSET = [...LATIN_LOWER, ...DIGITS];
    }
    resize();
    start();

    // Listen for viewport changes (mobile rotation, address bar show/hide)
    window.addEventListener('resize', scheduleResize, { passive: true });
    window.addEventListener('orientationchange', scheduleResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleResize, { passive: true });
      window.visualViewport.addEventListener('scroll', scheduleResize, { passive: true });
    }
    window.addEventListener('pageshow', scheduleResize, { passive: true });
  })();
})();
