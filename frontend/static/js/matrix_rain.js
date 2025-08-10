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

  const FONT_PRIMARY = 'HebrewMatrix';
  const FONT_FALLBACK = 'Pictocrypto, sans-serif';
  let currentFont = FONT_PRIMARY;

  // DPR can change on orientation; recompute on resize
  let DPR = Math.max(1, window.devicePixelRatio || 1);
  let width = 0, height = 0;
  let fontSize = 18;
  let colCount = 0;
  let colPitch = 0;
  let rowPos = [];
  let lastDrawnRow = [];
  let speeds = [];
  let hues = [];
  let running = false;

  const settings = {
    trailAlpha: 0.08,
    minSpeed: 0.24375, // was 0.375 (−35%)
    maxSpeed: 0.73125, // was 1.125 (−35%)
    replaceProb: 0.06
  };

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

    colPitch = Math.max(Math.ceil(maxW * 1.1), Math.ceil(fontSize * 0.7));

    colCount = Math.max(1, Math.floor(width / colPitch));
    const maxRows = height / fontSize;
    rowPos = new Array(colCount).fill(0).map(() => Math.random() * -maxRows);
    lastDrawnRow = new Array(colCount).fill(-9999);
    speeds = new Array(colCount).fill(0).map(() =>
      settings.minSpeed + Math.random() * (settings.maxSpeed - settings.minSpeed)
    );
    hues = new Array(colCount).fill(0).map((_, i) => (i / Math.max(1, colCount)) * 360);

    // White background clear
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(0,0,width,height);
  }

  function drawFrame() {
    if (!running) return;

    ctx.fillStyle = `rgba(255,255,255,${settings.trailAlpha})`;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < colCount; i++) {
      const x = i * colPitch;
      const r = rowPos[i];
      const intRow = Math.floor(r);
      const y = intRow * fontSize;

      if (intRow > lastDrawnRow[i]) {
        hues[i] = (hues[i] + 0.3) % 360;
        const sat = 80;
        const light = 40;
        ctx.fillStyle = `hsl(${hues[i]}, ${sat}%, ${light}%)`;
        if (Math.random() < settings.replaceProb) {
          ctx.fillStyle = `hsl(${(hues[i] + 30) % 360}, ${sat}%, ${light}%)`;
        }

        // Choose script: ~10% JP, next ~10% KO, next ~10% CN, else primary set
        const p = Math.random();
        const prevFont = ctx.font;
        let char;
        if (p < JAPANESE_PROB) {
          ctx.font = `${fontSize}px ${JP_STACK}`;
          const pool = Math.random() < 0.5 ? HIRA : KATA;
          char = pool[(Math.random() * pool.length) | 0];
        } else if (p < JAPANESE_PROB + KOREAN_PROB) {
          ctx.font = `${fontSize}px ${KO_STACK}`;
          const pool = Math.random() < 0.5 ? HANGUL_SYL : HANGUL_JAMO;
          char = pool[(Math.random() * pool.length) | 0];
        } else if (p < JAPANESE_PROB + KOREAN_PROB + CHINESE_PROB) {
          ctx.font = `${fontSize}px ${CN_STACK}`;
          const pool = Math.random() < 0.6 ? CN_NUM : CN_OTHER; // bias toward numerals
          char = pool[(Math.random() * pool.length) | 0];
        } else {
          ctx.font = `${fontSize}px ${currentFont}`;
          char = CHARSET[(Math.random() * CHARSET.length) | 0];
        }

        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 4;
        ctx.fillText(char, x, y);
        ctx.font = prevFont;

        lastDrawnRow[i] = intRow;
      }

      rowPos[i] += speeds[i] * 0.9;

      if (y > height + fontSize * 2) {
        const maxRows = height / fontSize;
        rowPos[i] = -Math.random() * maxRows;
        speeds[i] = settings.minSpeed + Math.random() * (settings.maxSpeed - settings.minSpeed);
        lastDrawnRow[i] = -9999;
      }
    }

    requestAnimationFrame(drawFrame);
  }

  function start() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      running = false;
      ctx.clearRect(0, 0, width, height);
      return;
    }
    running = true;
    requestAnimationFrame(drawFrame);
  }

  async function ensurePrimaryFont() {
    try {
      if (document.fonts && document.fonts.load) {
        await document.fonts.ready;
        await document.fonts.load(`normal 20px ${FONT_PRIMARY}`, 'אבגדabc012');
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
      // Temporarily pause trails to avoid smear during resize
      running = false;
      resize();
      running = wasRunning;
      if (running) requestAnimationFrame(drawFrame);
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
