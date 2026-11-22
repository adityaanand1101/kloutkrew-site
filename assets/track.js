// Site-wide GA4 event tracking for kloutkrew.in. Uses the gtag() stub defined in each page's <head>,
// so events queue safely even before Google's script loads. Every event name is listed in the README
// comment at the bottom of this file.
(function () {
  if (!window.gtag) return;
  var path = location.pathname.replace(/\/$/, '') || '/';
  function ev(name, params) { try { gtag('event', name, params || {}); } catch (e) {} }
  function text(el) { return (el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 80); }
  function where(el) {
    if (el.closest('footer')) return 'footer';
    if (el.closest('.kk-lead')) return 'popup';
    if (el.closest('.kl-hero, .hero_section, .kb-hero, .kq-hero')) return 'hero';
    if (el.closest('.kb-cta, .kk-fstart')) return 'cta_box';
    if (el.closest('nav, .navigation, .menu')) return 'menu';
    if (el.closest('.kbt')) return 'calculator';
    return 'body';
  }

  // ---- Only remember visit history for visitors whose analytics consent is on (see consent.js).
  function analyticsOK() {
    try { var v = localStorage.getItem('kk_consent'); if (v) { var c = v.charAt(0) === '{' ? JSON.parse(v) : { a: v }; return c.a === 'granted'; } } catch (e) {}
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return !/^Europe\//.test(tz);
  }
  var okToStore = analyticsOK();

  // ---- Visit history (first-party, on this device only): number of visits and the last pages viewed.
  // Attached to enquiries so you can see what a lead read before getting in touch.
  try {
    if (okToStore) {
      var j = JSON.parse(localStorage.getItem('kk_journey') || 'null') || { visits: 0, pages: [], last: 0 };
      if (Date.now() - j.last > 30 * 60e3) j.visits++;
      j.last = Date.now();
      if (j.pages[j.pages.length - 1] !== path) j.pages.push(path);
      if (j.pages.length > 20) j.pages = j.pages.slice(-20);
      localStorage.setItem('kk_journey', JSON.stringify(j));
    }
  } catch (e) {}

  // ---- First-touch attribution: remembered so form emails can say where a lead first came from.
  try {
    if (okToStore && !localStorage.getItem('kk_first_touch')) {
      var q = new URLSearchParams(location.search), ref = document.referrer, refHost = '';
      try { refHost = ref ? new URL(ref).hostname : ''; } catch (e) {}
      if (refHost === location.hostname) refHost = '';
      var src = q.get('utm_source') ? [q.get('utm_source'), q.get('utm_medium'), q.get('utm_campaign')].filter(Boolean).join(' / ')
        : q.get('gclid') ? 'google ads' : q.get('fbclid') ? 'facebook / instagram' : refHost || 'direct';
      localStorage.setItem('kk_first_touch', JSON.stringify({ source: src, landing: path, date: new Date().toISOString().slice(0, 10) }));
    }
  } catch (e) {}

  // ---- Clicks (one delegated listener for the whole page).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (a.classList.contains('kk-wa') || a.classList.contains('kk-mail')) return; // these fire their own events
    if (/^tel:/i.test(href)) return ev('phone_click', { location: where(a), page: path });
    if (/^mailto:/i.test(href)) return ev('email_click', { location: where(a), page: path });
    if (/wa\.me\/918375035325/.test(href)) return ev('whatsapp_click', { location: where(a), page: path });
    if (/wa\.me\/\?text|twitter\.com\/intent|x\.com\/intent|linkedin\.com\/(sharing|shareArticle)|facebook\.com\/sharer/.test(href))
      return ev('share', { method: /wa\.me/.test(href) ? 'whatsapp' : /linkedin/.test(href) ? 'linkedin' : /facebook/.test(href) ? 'facebook' : 'x', content_type: 'article', item_id: path });
    if (a.classList.contains('kb-copy')) return ev('share', { method: 'copy_link', content_type: 'article', item_id: path });
    if (a.closest('.kk-social')) return ev('social_click', { platform: (a.getAttribute('aria-label') || '').replace('KloutKrew Studio on ', ''), page: path });
    if (a.classList.contains('kb-chip')) return ev('blog_filter', { category: a.getAttribute('data-filter') });
    if (a.classList.contains('kb-more')) return ev('blog_load_more', {});
    if (/^\/contact-us/.test(href) || a.classList.contains('kb-btn') || a.classList.contains('kk-fbtn'))
      return ev('cta_click', { cta_text: text(a), location: where(a), link_url: href, page: path });
    if (/^\/blog\/[^/]+$/.test(href) && /^\/blog\//.test(path)) return ev('related_post_click', { link_url: href, page: path });
    if (/^\/faq\//.test(href)) return ev('faq_link_click', { link_url: href, page: path });
  }, true);

  // ---- FAQ accordions: which questions people open.
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.tagName === 'DETAILS' && d.open) { var s = d.querySelector('summary'); ev('faq_open', { question: s ? text(s) : '', page: path }); }
  }, true);

  // ---- Forms: first interaction, so we can see started-but-not-sent.
  var started = new WeakSet();
  document.addEventListener('focusin', function (e) {
    var f = e.target.closest && e.target.closest('form');
    if (!f || started.has(f) || f.id === 'kbt') return;
    started.add(f);
    ev('form_start', { form_name: f.closest('.kk-lead') ? 'popup_review' : f.classList.contains('footer_cta_form') ? 'newsletter' : 'contact', page: path });
  }, true);

  // ---- Scroll depth (GA4's built-in scroll event only fires at 90%).
  var marks = [25, 50, 75], hit = {};
  function onScroll() {
    var h = document.documentElement.scrollHeight - innerHeight; if (h < 300) return;
    var p = Math.round(scrollY / h * 100);
    marks.forEach(function (m) { if (p >= m && !hit[m]) { hit[m] = 1; ev('scroll_depth', { percent: m, page: path }); } });
  }
  addEventListener('scroll', onScroll, { passive: true });

  // ---- Blog: article read to the end after at least 30 seconds.
  var body = document.querySelector('.kb-post-body');
  if (body && 'IntersectionObserver' in window && /^\/blog\//.test(path)) {
    var t0 = Date.now(), last = body.lastElementChild || body;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting && Date.now() - t0 > 30000) { ev('article_complete', { page: path, seconds: Math.round((Date.now() - t0) / 1000) }); io.disconnect(); } });
    });
    io.observe(last);
  }

  // ---- Project videos on service pages.
  document.querySelectorAll('video').forEach(function (v) {
    var sent = false;
    v.addEventListener('play', function () { if (!sent) { sent = true; ev('project_video_play', { video: v.getAttribute('aria-label') || v.currentSrc.split('/').pop(), page: path }); } });
  });

  // ---- Budget calculator: what people pick.
  var calc = document.getElementById('kbt');
  if (calc) calc.addEventListener('change', function (e) {
    var r = e.target;
    if (r.type === 'radio' && r.name !== 'cur') { var leg = r.closest('fieldset').querySelector('legend'); ev('calculator_select', { item: leg ? leg.firstChild.textContent.trim() : r.name, option: r.value === '' ? 'skip' : text(r.nextElementSibling) }); }
  });

  // ---- 404s, so broken links show up in reports.
  if (document.title.indexOf('404') > -1 || document.querySelector('meta[name="kk-404"]')) ev('page_not_found', { page: path, referrer: document.referrer.slice(0, 100) });
})();

/* Events sent (GA4 > Reports > Engagement > Events):
   generate_lead, sign_up, form_start, form_error ........ forms (forms.js / this file)
   lead_popup_view ....................................... pop-up shown (lead.js)
   cta_click ............................................. "Start a project", "Get a quote" and other buttons
   whatsapp_click, email_click, phone_click .............. contact taps, with where they were on the page
   social_click, share ................................... footer social icons, article share buttons
   faq_open, faq_link_click .............................. which questions people read
   scroll_depth (25/50/75), article_complete ............. how far people read
   project_video_play .................................... work videos on service pages
   tool_use, calculator_select ........................... budget calculator
   blog_filter, blog_load_more, related_post_click ....... blog navigation
   page_not_found ........................................ broken links
*/
