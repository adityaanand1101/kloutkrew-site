"""One-off pass (20 Nov 2026): speed + accessibility fixes across the Webflow pages."""
import re, glob, json
CSS_CDN = '<link href="https://cdn.prod.website-files.com/68efdb35db90f2ad02b2fe4b/css/ariyana-studio.webflow.shared.6b9b96103.min.css" rel="stylesheet" type="text/css" integrity="sha384-a5uWED/hmuk/3i9y+GqRyBOQ4j1r0kChI4GeEQGsSfMbWjE7jpzpXsAsuXtofjio" crossorigin="anonymous"/>'
CSS_LOCAL = ('<link rel="preload" href="/assets/fonts/DMSans-Variable.woff2" as="font" type="font/woff2" crossorigin>'
             '<link href="/assets/vendor/webflow/ariyana-studio.webflow.shared.6b9b96103.min.css" rel="stylesheet" type="text/css"/>')
GA_DELAYED = ("<!-- Google Analytics 4 (loads on first interaction or 3.5 s after load, so it never delays the page) --><script>"
  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-T477LX1TDJ');"
  "(function(){var d=0;function l(){if(d)return;d=1;var s=document.createElement('script');s.async=true;"
  "s.src='https://www.googletagmanager.com/gtag/js?id=G-T477LX1TDJ';document.head.appendChild(s);}"
  "['pointerdown','keydown','touchstart','scroll','mousemove'].forEach(function(e){addEventListener(e,l,{once:true,passive:true});});"
  "addEventListener('load',function(){setTimeout(l,3500);});})();</script><!-- End Google Analytics 4 -->")
SOCIAL = r'(?:instagram|tiktok|linkedin|youtube|facebook|twitter|x|behance|dribbble)\.com'
prof = json.load(open('profiles.json'))
real = {k: v for k, v in prof.items() if not k.startswith('_') and v.startswith('http')}

def drop_placeholder_socials(s):
    # remove <a> tags whose href is a bare social homepage
    s = re.sub(r'<a [^>]*href="https?://(?:www\.)?' + SOCIAL + r'/?"[^>]*>.*?</a>', '', s, flags=re.S)
    # remove "Follow us" blocks / Follow footer column that are now empty
    s = re.sub(r'<div class="hero_social_links"><p class="text-weight-medium color-white">Follow us</p><div class="hero_social_line"></div><div class="hero_social_icon_wrapper">\s*</div></div>', '', s)
    s = re.sub(r'<div id="[^"]*" class="footer_link_col"><p class="footer_link_col_heading">Follow</p><div class="footer_link_wrapper">\s*</div></div>', '', s)
    return s

for f in glob.glob('*.html') + ['templates/page.html']:
    s = open(f, encoding='utf-8').read(); o = s
    # 1. self-hosted Webflow CSS + fonts
    s = s.replace(CSS_CDN, CSS_LOCAL)
    # 2. drop the empty Tag Manager container, delay GA4
    s = re.sub(r'<!-- Google Tag Manager -->.*?<!-- End Google Tag Manager -->', '', s, flags=re.S)
    s = re.sub(r'<!-- Google Tag Manager \(noscript\) -->.*?<!-- End Google Tag Manager \(noscript\) -->', '', s, flags=re.S)
    s = re.sub(r'<!-- Google Analytics 4 -->.*?<!-- End Google Analytics 4 -->', GA_DELAYED, s, flags=re.S)
    # 3. Lenis: inline its tiny CSS, move the script out of <head> to just before its setup
    if '<script  src="/assets/vendor/lenis.min.js"></script>' in s and '<!-- Lenis setup -->' in s:
        s = s.replace('<!-- Lenis script and styles -->\n<script  src="/assets/vendor/lenis.min.js"></script> \n', '<!-- Lenis styles -->\n')
        s = s.replace('<!-- Lenis setup -->', '<script src="/assets/vendor/lenis.min.js"></script><!-- Lenis setup -->', 1)
    s = s.replace('<link rel="stylesheet" href="/assets/vendor/lenis.css">', '<style>' + open('assets/vendor/lenis.css').read().strip() + '</style>')
    # 4. accessibility: names that don't match visible text, prohibited aria-label on plain div/p
    s = s.replace(' aria-label="home"', '').replace('aria-label="work link" ', '')
    s = re.sub(r'(<(?:div|p) data-preloader-logo=""[^>]*?) aria-label="[^"]*"', r'\1', s)
    # 5. one <main> landmark around the page content
    if '<main' not in s and '<section' in s and '<footer' in s:
        i, j = s.find('<section'), s.find('<footer')
        if i < j: s = s[:i] + '<main id="main">' + s[i:j] + '</main>' + s[j:]
    # 6. remove placeholder social links (real ones come from profiles.json later)
    s = drop_placeholder_socials(s)
    if s != o: open(f, 'w', encoding='utf-8').write(s); print('updated', f)
