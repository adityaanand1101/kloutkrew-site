// Blog: category filter on the listing, reading progress + copy-link on posts.
(function () {
  // Lazy listing: show 12 cards, reveal 12 more when the reader nears the end (or taps the button).
  // Every card stays in the HTML so search engines still see every link.
  var PAGE = 12, limit = PAGE, filter = 'all';
  var cards = document.querySelectorAll('.kb-archive .kb-card');
  var more = document.querySelector('.kb-more');
  var empty = document.querySelector('.kb-empty');
  function render() {
    var matched = 0, shown = 0;
    cards.forEach(function (card) {
      var match = filter === 'all' || card.getAttribute('data-cat') === filter;
      if (match) matched++;
      var vis = match && (filter !== 'all' || matched <= limit);
      card.hidden = !vis;
      if (vis) shown++;
    });
    if (empty) empty.hidden = shown > 0;
    if (more) more.parentNode.hidden = !(filter === 'all' && matched > limit);
  }
  if (more) {
    more.addEventListener('click', function () { limit += PAGE; render(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting && !more.parentNode.hidden) { limit += PAGE; render(); } });
      }, { rootMargin: '600px 0px' }).observe(more.parentNode);
    }
  }
  if (cards.length) render();

  var chips = document.querySelectorAll('.kb-chip');
  if (chips.length) {
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.getAttribute('data-filter');
        chips.forEach(function (c) {
          var on = c === chip;
          c.classList.toggle('is-active', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        filter = f; limit = PAGE; render();
      });
    });
  }

  var bar = document.querySelector('.kb-progress');
  var body = document.querySelector('.kb-post-body');
  if (bar && body) {
    var ticking = false;
    var update = function () {
      var r = body.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.6;
      var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      bar.style.setProperty('--kb-p', p.toFixed(4));
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  document.querySelectorAll('.kb-copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-url');
      var done = function () { btn.textContent = 'Link copied'; setTimeout(function () { btn.textContent = 'Copy link'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
      else window.prompt('Copy this link:', url);
    });
  });
})();
