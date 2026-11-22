// Cookie consent with two categories, wired to Google Consent Mode v2.
//   Analytics: Google Analytics, Microsoft Clarity (heatmaps), visit history attached to enquiries.
//   Marketing: Meta Pixel and Google Ads remarketing, so you can show ads to past visitors.
// Visitors choose once (stored in localStorage "kk_consent" as {"a":"granted|denied","m":"granted|denied"}).
// No banner: EU/EEA/UK/CH visitors start with everything off; elsewhere both start on. Anyone can change it
// from "Cookie settings" in the footer.
(function () {
  // Paste IDs here to switch these tools on (they only load for visitors who accept that category).
  var IDS = {
    metaPixel: '',      // e.g. '123456789012345'  (Meta Events Manager > Data sources)
    googleAds: '',      // e.g. 'AW-123456789'      (Google Ads > Tools > Google tag)
    clarity: ''         // e.g. 'abcd1234ef'         (clarity.microsoft.com > Settings > Overview)
  };
  var KEY = 'kk_consent';
  var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var europe = /^Europe\//.test(tz) || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)/.test(tz);
  function read() {
    try { var v = localStorage.getItem(KEY); if (!v) return null; if (v === 'granted' || v === 'denied') return { a: v, m: 'denied' }; return JSON.parse(v); } catch (e) { return null; }
  }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
  var state = read() || { a: europe ? 'denied' : 'granted', m: europe ? 'denied' : 'granted', defaulted: true };
  window.kkConsent = function (cat) { return (cat === 'm' ? state.m : state.a) === 'granted'; };

  var loaded = {};
  function load(src, id) { if (loaded[id]) return; loaded[id] = 1; var s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); }
  function activate() {
    if (state.a === 'granted' && IDS.clarity && !loaded.clarity) {
      (function (c, l, a, r, i) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; })(window, document, 'clarity', 'script', IDS.clarity);
      load('https://www.clarity.ms/tag/' + IDS.clarity, 'clarity');
    }
    if (state.m === 'granted' && IDS.metaPixel && !loaded.meta) {
      var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!window._fbq) window._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      load('https://connect.facebook.net/en_US/fbevents.js', 'meta');
      fbq('init', IDS.metaPixel); fbq('track', 'PageView');
    }
    if (state.m === 'granted' && IDS.googleAds && window.gtag && !loaded.ads) { loaded.ads = 1; gtag('config', IDS.googleAds); }
  }
  function apply() {
    if (!window.gtag) return;
    var a = state.a === 'granted' ? 'granted' : 'denied', m = state.m === 'granted' ? 'granted' : 'denied';
    gtag('consent', 'update', { analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m });
  }
  window.kkLeadPixel = function () { try { if (loaded.meta && window.fbq) fbq('track', 'Lead'); if (loaded.ads && IDS.googleAds) gtag('event', 'conversion', { send_to: IDS.googleAds }); } catch (e) {} };

  var box;
  function show(detail) {
    if (box) return;
    box = document.createElement('div');
    box.className = 'kk-consent'; box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Cookie preferences');
    box.innerHTML = '<p class="kk-consent-t">We use cookies to improve this site. <a href="/privacy">Learn more</a></p>'
      + '<div class="kk-consent-opts"' + (detail ? '' : ' hidden') + '>'
      + '<label><input type="checkbox" name="a"' + (state.a === 'granted' ? ' checked' : '') + '> Analytics</label>'
      + '<label><input type="checkbox" name="m"' + (state.m === 'granted' ? ' checked' : '') + '> Marketing</label></div>'
      + '<p class="kk-consent-b"><button type="button" data-v="all">Accept</button><button type="button" data-v="none" class="kk-consent-no">Decline</button>'
      + '<button type="button" data-v="' + (detail ? 'save' : 'more') + '" class="kk-consent-link">' + (detail ? 'Save' : 'Settings') + '</button></p>';
    if (!document.getElementById('kk-consent-css')) {
      var st = document.createElement('style'); st.id = 'kk-consent-css';
      st.textContent = '.kk-consent{position:fixed;left:16px;bottom:16px;z-index:9997;max-width:min(380px,calc(100vw - 96px));box-sizing:border-box;background:rgba(18,18,18,.94);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);padding:12px 14px;font:13px/1.45 "DM Sans",Arial,sans-serif;opacity:0;transform:translateY(12px);transition:opacity .4s ease,transform .4s ease;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}.kk-consent.is-in{opacity:1;transform:none}.kk-consent p{margin:0}.kk-consent a{color:#fff;text-decoration:underline;text-underline-offset:2px;opacity:.85}.kk-consent-opts{display:flex;flex-wrap:wrap;gap:6px 16px;margin:10px 0 0}.kk-consent-opts[hidden]{display:none}.kk-consent-opts label{display:flex;align-items:center;gap:6px;margin:0;font:inherit;text-transform:none;letter-spacing:normal;color:#fff;cursor:pointer}.kk-consent-opts input{accent-color:#ff691e;margin:0}.kk-consent-b{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px!important}.kk-consent button{font:inherit;font-weight:600;font-size:13px;line-height:1;padding:8px 14px;border-radius:999px;border:1px solid #fff;background:#fff;color:#121212;cursor:pointer}.kk-consent .kk-consent-no{background:transparent;color:#fff;border-color:rgba(255,255,255,.4)}.kk-consent .kk-consent-link{background:none;border-color:transparent;color:rgba(255,255,255,.75);padding:8px 6px;text-decoration:underline;text-underline-offset:2px}.kk-consent button:focus-visible,.kk-consent input:focus-visible,.kk-consent a:focus-visible{outline:2px solid #ff691e;outline-offset:2px}@media (max-width:600px){.kk-consent{left:12px;bottom:12px;max-width:calc(100vw - 84px)}}@media (prefers-reduced-motion:reduce){.kk-consent{transition:none}}@media print{.kk-consent{display:none}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(box);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (box) box.classList.add('is-in'); }); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = b.getAttribute('data-v');
      if (v === 'more') { box.querySelector('.kk-consent-opts').hidden = false; b.setAttribute('data-v', 'save'); b.textContent = 'Save'; return; }
      if (v === 'all') state = { a: 'granted', m: 'granted' };
      else if (v === 'none') state = { a: 'denied', m: 'denied' };
      else state = { a: box.querySelector('[name=a]').checked ? 'granted' : 'denied', m: box.querySelector('[name=m]').checked ? 'granted' : 'denied' };
      save(state); apply(); activate();
      if (state.a !== 'granted') { try { localStorage.removeItem('kk_journey'); localStorage.removeItem('kk_first_touch'); } catch (e2) {} }
      if (window.gtag) gtag('event', 'cookie_choice', { analytics: state.a, marketing: state.m });
      hide();
    });
  }
  function hide() { if (!box) return; var b = box; box = null; b.classList.remove('is-in'); setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 400); }
  window.kkConsentOpen = function () { return !!box; };
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); show(true); }
  });
  if (!state.defaulted) { apply(); }
  activate();
  // No automatic banner. Visitors can change their choice any time from "Cookie settings" in the footer.
})();
