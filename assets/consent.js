// Cookie consent (Google Consent Mode v2). Analytics cookies are off by default for visitors in the EU/EEA,
// UK and Switzerland (set in each page's <head>), and this small banner asks them. Everyone else can change
// their choice any time from "Cookie settings" in the footer.
(function () {
  var KEY = 'kk_consent';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function apply(v) {
    var g = v === 'granted' ? 'granted' : 'denied';
    if (window.gtag) gtag('consent', 'update', { analytics_storage: g });
  }
  var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var europe = /^Europe\//.test(tz) || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)/.test(tz);
  var box;
  function show() {
    if (box) return;
    box = document.createElement('div');
    box.className = 'kk-consent'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cookie settings');
    box.innerHTML = '<p>We use analytics cookies to see how people use this site and improve it. No ads, and nothing is sold. <a href="/privacy">Privacy policy</a></p>'
      + '<p class="kk-consent-b"><button type="button" data-v="granted">Accept</button><button type="button" data-v="denied" class="kk-consent-no">Decline</button></p>';
    var st = document.createElement('style');
    st.textContent = '.kk-consent{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:10000;width:min(560px,calc(100vw - 32px));box-sizing:border-box;background:#fff;color:#121212;border:1px solid #e4dad2;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:16px 18px;font:15px/1.5 "DM Sans",Arial,sans-serif;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center}.kk-consent p{margin:0;flex:1 1 280px}.kk-consent a{text-decoration:underline}.kk-consent-b{display:flex;gap:8px;flex:0 0 auto!important}.kk-consent button{font:inherit;font-weight:600;padding:9px 16px;border-radius:999px;border:1px solid #121212;background:#121212;color:#fff;cursor:pointer}.kk-consent .kk-consent-no{background:#fff;color:#121212}.kk-consent button:focus-visible{outline:2px solid #ff691e;outline-offset:2px}@media print{.kk-consent{display:none}}';
    document.head.appendChild(st);
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = b.getAttribute('data-v'); set(v); apply(v);
      if (window.gtag) gtag('event', 'cookie_choice', { choice: v });
      box.parentNode.removeChild(box); box = null;
    });
  }
  // Footer link and any element with data-cookie-settings reopen the banner.
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); show(); }
  });
  if (!get() && europe) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
  }
})();
