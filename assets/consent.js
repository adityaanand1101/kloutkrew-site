// Cookie consent with two categories, wired to Google Consent Mode v2.
//   Analytics: Google Analytics, Microsoft Clarity (heatmaps), visit history attached to enquiries.
//   Marketing: Meta Pixel and Google Ads remarketing, so you can show ads to past visitors.
// Visitors choose once (stored in localStorage "kk_consent" as {"a":"granted|denied","m":"granted|denied"}).
// EU/EEA/UK/CH visitors start with everything off; elsewhere analytics starts on and marketing off.
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
  var state = read() || { a: europe ? 'denied' : 'granted', m: 'denied', defaulted: true };
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
    box.className = 'kk-consent'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cookie settings');
    box.innerHTML = '<p class="kk-consent-t">We use cookies to understand how people use this site, improve it and, with your permission, show you relevant ads elsewhere. <a href="/privacy">Privacy policy</a></p>'
      + '<div class="kk-consent-opts"' + (detail ? '' : ' hidden') + '>'
      + '<label><input type="checkbox" checked disabled> Essential <span>Needed for the site to work</span></label>'
      + '<label><input type="checkbox" name="a"' + (state.a === 'granted' ? ' checked' : '') + '> Analytics <span>Visits, clicks and heatmaps, to improve the site</span></label>'
      + '<label><input type="checkbox" name="m"' + (state.m === 'granted' ? ' checked' : '') + '> Marketing <span>Ads on Instagram, Facebook and Google for past visitors</span></label></div>'
      + '<p class="kk-consent-b"><button type="button" data-v="all">Accept all</button><button type="button" data-v="none" class="kk-consent-no">Reject all</button>'
      + '<button type="button" data-v="' + (detail ? 'save' : 'more') + '" class="kk-consent-link">' + (detail ? 'Save choices' : 'Choose') + '</button></p>';
    var st = document.createElement('style');
    st.textContent = '.kk-consent{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:10000;width:min(600px,calc(100vw - 32px));box-sizing:border-box;background:#fff;color:#121212;border:1px solid #e4dad2;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:16px 18px;font:15px/1.5 "DM Sans",Arial,sans-serif}.kk-consent p{margin:0}.kk-consent a{text-decoration:underline}.kk-consent-opts{display:grid;gap:8px;margin:12px 0 0}.kk-consent-opts[hidden]{display:none}.kk-consent-opts label{text-transform:none;letter-spacing:normal;font-size:15px;margin:0;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-weight:600}.kk-consent-opts span{text-transform:none;letter-spacing:normal;flex-basis:100%;margin-left:24px;font-weight:400;font-size:13px;color:#5c5c5c}.kk-consent-b{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px!important}.kk-consent button{font:inherit;font-weight:600;padding:9px 16px;border-radius:999px;border:1px solid #121212;background:#121212;color:#fff;cursor:pointer}.kk-consent .kk-consent-no{background:#fff;color:#121212}.kk-consent .kk-consent-link{background:none;border-color:transparent;color:#121212;text-decoration:underline}.kk-consent button:focus-visible,.kk-consent input:focus-visible{outline:2px solid #ff691e;outline-offset:2px}@media (max-width:600px){.kk-consent{bottom:10px;padding:14px;font-size:14px}}@media print{.kk-consent{display:none}}';
    document.head.appendChild(st);
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = b.getAttribute('data-v');
      if (v === 'more') { box.querySelector('.kk-consent-opts').hidden = false; b.setAttribute('data-v', 'save'); b.textContent = 'Save choices'; return; }
      if (v === 'all') state = { a: 'granted', m: 'granted' };
      else if (v === 'none') state = { a: 'denied', m: 'denied' };
      else state = { a: box.querySelector('[name=a]').checked ? 'granted' : 'denied', m: box.querySelector('[name=m]').checked ? 'granted' : 'denied' };
      save(state); apply(); activate();
      if (state.a !== 'granted') { try { localStorage.removeItem('kk_journey'); localStorage.removeItem('kk_first_touch'); } catch (e2) {} }
      if (window.gtag) gtag('event', 'cookie_choice', { analytics: state.a, marketing: state.m });
      box.parentNode.removeChild(box); box = null;
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); show(true); }
  });
  if (!state.defaulted) { apply(); }
  activate();
  if (state.defaulted) {
    var go = function () { setTimeout(function () { show(false); }, europe ? 0 : 1500); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
})();
