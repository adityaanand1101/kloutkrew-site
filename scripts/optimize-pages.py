"""One-off performance pass over the hand-built pages (run from the repo root).

Safe to re-run: every change checks whether it has already been applied.
"""
import glob
import re

PAGES = [p for p in glob.glob('*.html')]

LAZY_VIDEO_JS = (
    "<script>/* play videos only while on screen */(function(){"
    "var vs=document.querySelectorAll('video[data-autoplay]');"
    "function play(v){var p=v.play();if(p&&p.catch)p.catch(function(){});}"
    "if(!('IntersectionObserver' in window)){vs.forEach(play);return;}"
    "var io=new IntersectionObserver(function(es){es.forEach(function(e){"
    "if(e.isIntersecting){play(e.target);}else{e.target.pause();}});},{rootMargin:'300px 0px'});"
    "vs.forEach(function(v){io.observe(v);});})();</script>"
)

FONT_PRELOAD = ('<link rel="preload" href="/assets/fonts/BebasNeue-Regular.woff2" as="font" '
                'type="font/woff2" crossorigin>')


def poster_for(src):
    name = src.split('/')[-1].replace('%20', ' ')
    if '/' in src.replace('https://', '') and src.startswith('http'):
        return None  # remote (Webflow) videos already carry a poster image
    stem = name.rsplit('.', 1)[0].replace(' ', '-')
    return f'/assets/video-posters/{stem}.jpg'


def lazy_video(m):
    tag = m.group(0)
    if 'data-autoplay' in tag or 'autoplay' not in tag:
        return tag
    tag = re.sub(r'\sautoplay(="")?', '', tag)
    extra = ' data-autoplay preload="none"'
    src = re.search(r'\ssrc="([^"]+)"', tag)
    if src and 'poster=' not in tag:
        p = poster_for(src.group(1))
        if p:
            extra += f' poster="{p}"'
    return tag[:-1] + extra + '>'


for path in PAGES:
    s = open(path, encoding='utf-8').read()
    o = s
    # 1. Placeholder Google Analytics (G-XXXXXXXXXX) loads a script that records nothing.
    s = s.replace('<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>', '')
    s = re.sub(r"<script>window\.dataLayer=window\.dataLayer\|\|\[\];function gtag\(\)\{dataLayer\.push\(arguments\);\}"
               r"gtag\('js',new Date\(\)\);gtag\('config','G-XXXXXXXXXX'\);</script>", '', s)
    # 2. Self-host Lenis instead of a render-blocking third-party CDN.
    s = s.replace('https://unpkg.com/lenis@1.3.4/dist/lenis.css', '/assets/vendor/lenis.css')
    s = s.replace('https://unpkg.com/lenis@1.3.4/dist/lenis.min.js', '/assets/vendor/lenis.min.js')
    # 3. WOFF2 font (60% smaller) with an absolute path so nested pages resolve it too.
    s = s.replace("url('BebasNeue-Regular.ttf') format('truetype')",
                  "url('/assets/fonts/BebasNeue-Regular.woff2') format('woff2')")
    if FONT_PRELOAD not in s:
        s = s.replace('<meta charset="utf-8"/>', '<meta charset="utf-8"/>' + FONT_PRELOAD, 1)
    # 4. Warm up the jQuery CDN connection.
    if 'd3e54v103j8qbb.cloudfront.net" rel="preconnect"' not in s:
        s = s.replace('<link href="https://cdn.prod.website-files.com" rel="preconnect" crossorigin="anonymous"/>',
                      '<link href="https://cdn.prod.website-files.com" rel="preconnect" crossorigin="anonymous"/>'
                      '<link href="https://d3e54v103j8qbb.cloudfront.net" rel="preconnect" crossorigin="anonymous"/>', 1)
    # 5. Videos: no download until near the viewport, pause when scrolled away.
    s = re.sub(r'<video\b[^>]*>', lazy_video, s)
    if 'data-autoplay' in s and 'play videos only while on screen' not in s:
        s = s.replace('</body>', LAZY_VIDEO_JS + '</body>', 1)
    if s != o:
        open(path, 'w', encoding='utf-8').write(s)
        print('optimized', path)
