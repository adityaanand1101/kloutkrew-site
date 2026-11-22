// Lead pop-up: a small slide-in card (never a full-screen overlay, which Google penalises on mobile).
// Shows once per visitor every 14 days, after real interest: 50% scroll on a content page, 25 s on a page,
// or exit intent on desktop. Never on the contact page or to someone who already submitted.
(function () {
  var KEY = 'kk_lead_seen', DONE = 'kk_lead_done';
  var path = location.pathname.replace(/\/$/, '');
  if (/^\/(contact-us|404)/.test(path)) return;
  if (matchMedia('print').matches) return;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  // Add ?popup=1 to any page to show the card immediately (for testing), ignoring the limits below.
  var force = /[?&]popup=1\b/.test(location.search);
  if (!force) {
    if (get(DONE)) return;
    var seen = +get(KEY) || 0;
    if (Date.now() - seen < 14 * 864e5) return;
  }

  var onBlog = path.indexOf('/blog/') === 0;
  var title = onBlog ? 'Want this done for your brand?' : 'Get a free website review';
  var dek = 'Send us your site. Within 24 hours we’ll reply with the 3 fixes that would win you the most customers: speed, SEO and design. Free, no call needed.';

  var shown = false, box, lastFocus;
  function build() {
    box = document.createElement('aside');
    box.className = 'kk-lead';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'false');
    box.setAttribute('aria-labelledby', 'kk-lead-t');
    box.innerHTML =
      '<button type="button" class="kk-lead-x" aria-label="Close">×</button>' +
      '<p class="kk-lead-t" id="kk-lead-t">' + title + '</p>' +
      '<p class="kk-lead-d">' + dek + '</p>' +
      '<div class="w-form"><form class="kk-lead-f" aria-label="Free website review">' +
      '<input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">' +
      '<input type="hidden" name="Source" value="Pop-up: free website review (' + path + ')">' +
      '<label class="kk-lead-sr" for="kk-lead-url">Your website</label>' +
      '<input id="kk-lead-url" name="Website" type="text" inputmode="url" placeholder="yourbrand.com" required maxlength="200" autocomplete="url">' +
      '<label class="kk-lead-sr" for="kk-lead-mail">Your email</label>' +
      '<input id="kk-lead-mail" name="email" type="email" placeholder="you@yourbrand.com" required maxlength="200" autocomplete="email">' +
      '<input type="submit" value="Send me the review" class="kk-lead-b">' +
      '</form><div class="w-form-done" style="display:none"><p class="kk-lead-ok">Got it. Your review lands in your inbox within 24 hours.</p></div>' +
      '<div class="w-form-fail" style="display:none"><p class="kk-lead-err">That didn’t send. Try again, or message us on WhatsApp.</p></div></div>';
    document.body.appendChild(box);
    box.querySelector('.kk-lead-x').addEventListener('click', close);
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    box.querySelector('form').addEventListener('submit', function () { set(DONE, '1'); }, true);
    new MutationObserver(function () {
      var d = box.querySelector('.w-form-done');
      if (d && d.style.display === 'block') setTimeout(close, 4000);
    }).observe(box, { subtree: true, attributes: true, attributeFilter: ['style'] });
  }
  function open(trigger) {
    if (shown) return; shown = true; set(KEY, String(Date.now()));
    cleanup(); build();
    lastFocus = document.activeElement;
    requestAnimationFrame(function () { box.classList.add('is-in'); });
    if (window.gtag) gtag('event', 'lead_popup_view', { trigger: trigger, page: path });
  }
  function close() {
    if (!box) return;
    box.classList.remove('is-in');
    setTimeout(function () { if (box && box.parentNode) box.parentNode.removeChild(box); }, 300);
    if (lastFocus && lastFocus.focus && box.contains(document.activeElement)) lastFocus.focus();
  }

  var timer = setTimeout(function () { open('time'); }, 25000);
  function onScroll() {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h > 400 && scrollY / h > 0.5) open('scroll');
  }
  function onLeave(e) { if (e.clientY <= 0 && !e.relatedTarget) open('exit'); }
  function cleanup() {
    clearTimeout(timer);
    removeEventListener('scroll', onScroll);
    document.removeEventListener('mouseout', onLeave);
  }
  if (force) { setTimeout(function () { open('test'); }, 600); return; }
  addEventListener('scroll', onScroll, { passive: true });
  if (matchMedia('(pointer:fine)').matches) document.addEventListener('mouseout', onLeave);
})();
