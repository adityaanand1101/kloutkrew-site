// Repairs accessibility issues that Webflow and GSAP SplitText create at runtime:
// SplitText puts aria-label on plain <p>/<div> (not allowed) and hides the words,
// and Webflow labels the logo link "home" (doesn't match its visible text).
(function () {
  var css = document.createElement('style');
  css.textContent = '.kk-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}';
  document.head.appendChild(css);
  function fix() {
    document.querySelectorAll('p[aria-label]:not([role]), div[aria-label]:not([role]), h1[aria-label]:not([role]), h2[aria-label]:not([role])').forEach(function (el) {
      var label = el.getAttribute('aria-label');
      el.removeAttribute('aria-label');
      if (el.querySelector('[aria-hidden="true"]') && !el.querySelector(':scope > .kk-sr')) {
        var s = document.createElement('span'); s.className = 'kk-sr'; s.textContent = label; el.appendChild(s);
      }
    });
    document.querySelectorAll('a.w-nav-brand[aria-label="home"]').forEach(function (a) { a.setAttribute('aria-label', 'KloutKrew Studio home'); a.removeAttribute('aria-label'); });
  }
  addEventListener('load', function () { fix(); setTimeout(fix, 1500); setTimeout(fix, 4000); });
})();
