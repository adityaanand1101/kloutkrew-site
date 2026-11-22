// Sends every site form (contact, quote, newsletter) to the studio inbox via FormSubmit.
// Runs in the capture phase so Webflow's own form handler (which only works on Webflow hosting) never fires.
(function () {
  // Form delivery stays on the already-activated inbox until connect@kloutkrew.in can receive mail
  // (kloutkrew.in has no MX records yet). Switch this line once mail is set up and FormSubmit is re-activated.
  var INBOX = 'teamKLOUTKREW@gmail.com';
  var ENDPOINT = 'https://formsubmit.co/ajax/' + INBOX;

  var LOADED_AT = Date.now();
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
    if (Date.now() - LOADED_AT < 3000) return; // submitted faster than a person can type: almost certainly a bot
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

// Prefill the contact message when arriving from the budget calculator (?brief=...).
(function () {
  try {
    var b = new URLSearchParams(location.search).get('brief');
    if (!b) return;
    var go = function () {
      var t = document.getElementById('message-area') || document.querySelector('textarea[name="field"]');
      if (t && !t.value) t.value = 'From the budget calculator, I need: ' + b.slice(0, 600) + '\n\nAbout my brand: ';
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  } catch (e) {}
})();
