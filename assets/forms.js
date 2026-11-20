// Sends every site form (contact, quote, newsletter) to the studio inbox via FormSubmit.
// Runs in the capture phase so Webflow's own form handler (which only works on Webflow hosting) never fires.
(function () {
  var INBOX = 'teamKLOUTKREW@gmail.com';
  var ENDPOINT = 'https://formsubmit.co/ajax/' + INBOX;

  function show(el, on) { if (el) el.style.display = on ? 'block' : 'none'; }

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || !form.closest || !form.closest('.w-form')) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();

    var wrap = form.closest('.w-form');
    var done = wrap.querySelector('.w-form-done');
    var fail = wrap.querySelector('.w-form-fail');
    var btn = form.querySelector('[type="submit"]');
    var label = btn && (btn.value || btn.textContent);

    var data = new FormData(form);
    if (data.get('_honey')) return; // bot filled the hidden field
    var isNewsletter = form.classList.contains('footer_cta_form') || form.id === 'email-form';
    var payload = { _subject: isNewsletter ? 'New newsletter signup - kloutkrew.in' : 'New enquiry - kloutkrew.in', _template: 'table', _captcha: 'false', page: location.href };
    data.forEach(function (v, k) { if (k !== '_honey' && k !== 'cf-turnstile-response') payload[k === 'field' ? 'Message' : k] = v; });

    if (btn) { btn.disabled = true; if (btn.value) btn.value = 'Sending...'; }
    show(fail, false);

    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || String(j.success) === 'false') throw new Error(j.message || 'failed'); }); })
      .then(function () { form.style.display = 'none'; show(done, true); if (window.gtag) gtag('event', isNewsletter ? 'sign_up' : 'generate_lead', { form_location: location.pathname }); })
      .catch(function () { show(fail, true); })
      .finally(function () { if (btn) { btn.disabled = false; if (btn.value) btn.value = label; } });
  }, true);
})();
