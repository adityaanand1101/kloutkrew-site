// Sends every site form (contact, quote, newsletter) to the studio inbox via FormSubmit.
// Runs in the capture phase so Webflow's own form handler (which only works on Webflow hosting) never fires.
(function () {
  var INBOX = 'connect@kloutkrew.in';
  var ENDPOINT = 'https://formsubmit.co/ajax/' + INBOX;
  // Everyone on the team gets a copy of every form submission.
  var CC = 'aditya.kloutkrew@gmail.com,kartik.kloutkrew@gmail.com,shudhanshu.kloutkrew@gmail.com,aditya.anand.kloutkrew@gmail.com,mayank.kloutkrew@gmail.com,aditya.anand1101@gmail.com';

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
    var payload = { _subject: isNewsletter ? 'New newsletter signup - kloutkrew.in' : 'New enquiry - kloutkrew.in', _template: 'table', _captcha: 'false', _cc: CC, page: location.href };
    data.forEach(function (v, k) { if (k !== '_honey' && k !== 'cf-turnstile-response') payload[k === 'field' ? 'Message' : k] = v; });

    if (btn) { btn.disabled = true; if (btn.value) btn.value = 'Sending...'; }
    show(fail, false);

    function send() {
      return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (e) { throw new Error('bad response ' + r.status); } if (!r.ok || String(j.success) === 'false') throw new Error(j.message || ('status ' + r.status)); }); });
    }
    // One automatic retry; if it still fails, keep the lead by offering WhatsApp with their details filled in.
    send().catch(function () { return new Promise(function (res) { setTimeout(res, 1500); }).then(send); })
      .then(function () { form.style.display = 'none'; show(done, true); if (window.gtag) gtag('event', isNewsletter ? 'sign_up' : 'generate_lead', { form_location: location.pathname }); })
      .catch(function (err) {
        if (window.gtag) gtag('event', 'form_error', { form_location: location.pathname, error: String(err && err.message || err).slice(0, 90) });
        if (fail) {
          var lines = []; Object.keys(payload).forEach(function (k) { if (k.charAt(0) !== '_' && k !== 'page') lines.push(k + ': ' + payload[k]); });
          var wa = 'https://wa.me/918375035325?text=' + encodeURIComponent('Hi KloutKrew, your website form didn\u2019t go through, so here are my details:\n' + lines.join('\n'));
          var link = fail.querySelector('.kk-wa-fallback');
          if (!link) { link = document.createElement('a'); link.className = 'kk-wa-fallback'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Send it on WhatsApp instead'; link.style.cssText = 'display:inline-block;margin-top:8px;text-decoration:underline;font-weight:600'; fail.appendChild(link); }
          link.href = wa;
        }
        show(fail, true);
      })
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
