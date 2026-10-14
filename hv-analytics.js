/* Heo Vàng — cookie consent banner + custom GA4 events.
   The gtag snippet in each page's <head> sets consent defaults (analytics denied until the visitor agrees). */
(function () {
  var KEY = 'hv-consent';
  function store(get, val) {
    try { if (get) return localStorage.getItem(KEY); localStorage.setItem(KEY, val); } catch (e) { return null; }
  }
  function track(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  window.hvTrack = track;

  /* ---- consent banner ---- */
  function showBanner() {
    var css = document.createElement('style');
    css.textContent =
      '.hv-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;background:var(--cream,#FFFDF7);color:var(--ink,#2E3A2A);border-radius:22px;padding:16px 18px;box-shadow:0 10px 30px rgba(46,58,42,.18);font-family:var(--fb,Nunito,sans-serif);font-size:.9rem;line-height:1.5;display:flex;gap:14px;align-items:center;flex-wrap:wrap}' +
      '.hv-consent p{margin:0;flex:1 1 260px}' +
      '.hv-consent .hv-btns{display:flex;gap:8px}' +
      '.hv-consent button{font-family:var(--fd,"Baloo 2",sans-serif);font-weight:700;font-size:.88rem;border:none;border-radius:999px;padding:10px 18px;cursor:pointer}' +
      '.hv-consent .hv-yes{background:var(--gold,#F2A900);color:var(--gold-text,#4A2F00)}' +
      '.hv-consent .hv-no{background:transparent;color:rgba(46,58,42,.7);text-decoration:underline}';
    document.head.appendChild(css);
    var box = document.createElement('div');
    box.className = 'hv-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Đồng ý cookie');
    box.innerHTML = '<p>🐷 Heo Vàng dùng cookie của Google Analytics để đếm lượt xem và biết bài nào hữu ích — không quảng cáo, không bán dữ liệu. Ba mẹ đồng ý giúp tụi mình nhé?</p>' +
      '<div class="hv-btns"><button type="button" class="hv-no">Không</button><button type="button" class="hv-yes">Đồng ý</button></div>';
    document.body.appendChild(box);
    box.querySelector('.hv-yes').addEventListener('click', function () {
      store(false, 'yes');
      if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'granted' });
      box.remove();
    });
    box.querySelector('.hv-no').addEventListener('click', function () { store(false, 'no'); box.remove(); });
  }
  if (!store(true)) {
    if (document.body) showBanner(); else document.addEventListener('DOMContentLoaded', showBanner);
  }

  /* ---- custom events ---- */
  var m = location.pathname.match(/tap-(\d+)/);
  var lesson = m ? parseInt(m[1], 10) : null;
  var quizSent = false;

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('button, a') : null;
    if (!el) return;

    if (el.id === 'btnRead' && /Nghe/.test(el.textContent)) {
      track('listen_story', { lesson: lesson });
    } else if (el.classList.contains('spk')) {
      track('vocab_listen', { lesson: lesson, word: el.getAttribute('data-en') });
    } else if (el.classList.contains('quiz-opt')) {
      // page's own handler runs first (it is attached to the button); check completion afterwards
      setTimeout(function () {
        var groups = document.querySelectorAll('.quiz-opts');
        if (quizSent || !groups.length) return;
        var answered = 0, correct = 0;
        groups.forEach(function (g) {
          if (g.querySelector('.quiz-opt:disabled')) { answered++; if (!g.querySelector('.no')) correct++; }
        });
        if (answered === groups.length) {
          quizSent = true;
          track('quiz_complete', { lesson: lesson, score: correct, total: groups.length });
        }
      }, 0);
    } else if (el.id === 'btnInstall') {
      track('install_app_click');
    } else if (el.tagName === 'A' && /youtube\.com/.test(el.href)) {
      track('youtube_click', { lesson: lesson });
    }
  }, true);

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.getAttribute('name') === 'gop-y') track('feedback_submit');
    else if (f.id === 'aiForm') track('ask_ai');
  }, true);
})();
