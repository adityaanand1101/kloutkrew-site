"""Fixes from the 19 Nov 2026 SEO audit. Run from the repo root; safe to re-run."""
import json, re
from pathlib import Path

PAGES = ['index.html', 'about.html', 'services.html', 'works.html', 'contact-us.html', '404.html', 'templates/page.html']
PHONE_DISPLAY = '+91 99910 97008'
ORG = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": "KloutKrew Studio",
    "alternateName": "KloutKrew",
    "url": "https://kloutkrew.in",
    "logo": "https://kloutkrew.in/favicon.svg",
    "image": "https://kloutkrew.in/assets/og-default.jpg",
    "description": "New Delhi studio for branding, packaging, websites, digital marketing and AI brand films.",
    "email": "teamKLOUTKREW@gmail.com",
    "telephone": "+91-9991097008",
    "address": {"@type": "PostalAddress", "addressLocality": "New Delhi", "addressRegion": "Delhi", "addressCountry": "IN"},
    "areaServed": [{"@type": "City", "name": "Delhi NCR"}, {"@type": "Country", "name": "India"}],
    "knowsAbout": ["Branding", "Packaging design", "Website design", "UI/UX design", "Digital marketing", "AI brand films"],
}
ORG_LD = '<script type="application/ld+json">' + json.dumps(ORG, separators=(',', ':')) + '</script>'

META = {
    'index.html': ("KloutKrew Studio | Branding, Websites & AI Films, Delhi",
                   "KloutKrew Studio is a New Delhi studio for branding, packaging, websites and AI brand films. One team from first sketch to launch."),
    'about.html': ("About KloutKrew Studio | Creative Studio in New Delhi",
                   "Meet KloutKrew Studio, a New Delhi creative studio building brands, websites and AI films for startups and D2C brands across India."),
    'services.html': ("Branding, Website & Marketing Services | KloutKrew",
                      "Branding, packaging, UI/UX, websites, digital marketing and AI brand films from one New Delhi studio. See what we do and how we work."),
    'works.html': ("Portfolio: Brand Films, Websites & Packaging | KloutKrew",
                   "Brand films, AI films, packaging and websites by KloutKrew Studio, New Delhi, including work for Off We Glow, Plenova and Drink Different."),
    'contact-us.html': ("Contact KloutKrew Studio, New Delhi | Get a Quote",
                        "Tell us about your brand, website or film. KloutKrew Studio in New Delhi replies within 24 hours with ideas and a quote."),
}

CLIENTS = ['OFF WE GLOW', 'PLENOVA', 'ARCADIAN', 'DRINK DIFFERENT', 'PUSH PAST', 'ON-DEMAND EXPERTS']
WORDMARK_CSS = ('.client_wordmark{font-family:\'Bebas Neue\',sans-serif;font-size:clamp(1.4rem,2.2vw,2.2rem);'
                'letter-spacing:.02em;line-height:1;color:currentColor;opacity:.85;text-align:center;display:block}'
                '.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}')

def esc(t): return t.replace('&', '&amp;').replace('"', '&quot;')

def fix(path):
    p = Path(path); s = p.read_text(encoding='utf-8'); o = s
    name = p.name

    # Phone: one correct number everywhere
    s = s.replace('99910 971008', '99910 97008')
    s = s.replace('+91999910971008', '+919991097008')

    # Organization schema -> ProfessionalService with location, no placeholder profiles
    s = re.sub(r'<script type="application/ld\+json">\s*\{"@context":"https://schema.org","@type":"Organization".*?</script>', ORG_LD, s, count=1, flags=re.S)
    s = re.sub(r'(<script type="application/ld\+json">[^<]*?)"@type":"Organization","name":"KloutKrew Studio","url":"https://kloutkrew.in","logo":"https://kloutkrew.in/favicon.svg","description":"[^"]*","email":"[^"]*","telephone":"[^"]*","sameAs":\[[^\]]*\]', r'\1"@type":"ProfessionalService","name":"KloutKrew Studio","url":"https://kloutkrew.in","logo":"https://kloutkrew.in/favicon.svg","email":"teamKLOUTKREW@gmail.com","telephone":"+91-9991097008","address":{"@type":"PostalAddress","addressLocality":"New Delhi","addressCountry":"IN"}', s)

    # Titles and descriptions (title, og/twitter title, meta + og/twitter description)
    if name in META:
        t, d = META[name]
        s = re.sub(r'<title>.*?</title>', f'<title>{esc(t)}</title>', s, count=1, flags=re.S)
        s = re.sub(r'(<meta[^>]*property="og:title"[^>]*content=")[^"]*(")', rf'\g<1>{esc(t)}\2', s)
        s = re.sub(r'(<meta[^>]*content=")[^"]*("[^>]*property="og:title")', rf'\g<1>{esc(t)}\2', s)
        s = re.sub(r'(<meta[^>]*name="twitter:title"[^>]*content=")[^"]*(")', rf'\g<1>{esc(t)}\2', s)
        s = re.sub(r'(<meta[^>]*content=")[^"]*("[^>]*name="twitter:title")', rf'\g<1>{esc(t)}\2', s)
        s = re.sub(r'(<meta name="description" content=")[^"]*(")', rf'\g<1>{esc(d)}\2', s)
        s = re.sub(r'(<meta content=")[^"]*(" name="description")', rf'\g<1>{esc(d)}\2', s)
        s = re.sub(r'(<meta content=")[^"]*(" property="og:description")', rf'\g<1>{esc(d)}\2', s)
        s = re.sub(r'(<meta content=")[^"]*(" name="twitter:description")', rf'\g<1>{esc(d)}\2', s)

    # Language: Indian English
    s = s.replace('<html data-wf-domain', '<html data-wf-domain', 1)
    s = re.sub(r'(<html[^>]*?)\slang="en"', r'\1 lang="en-IN"', s, count=1)

    # Tagline consistency in the side menu
    s = s.replace('Design First Digital Agency', 'Branding, Web &amp; AI Films')

    # Footer: service links go to the services page, not contact
    def svc(m):
        return m.group(0).replace('href="/contact-us"', 'href="/services"')
    s = re.sub(r'<p class="footer_link_col_heading">Services</p>.*?</div>', svc, s, count=1, flags=re.S)

    # Footer: say where the studio is
    if 'footer_location' not in s:
        s = s.replace('<p class="footer_link_col_heading">Contact</p><div class="footer_contact_link_wrapper">',
                      '<p class="footer_link_col_heading">Contact</p><div class="footer_contact_link_wrapper"><p class="footer_location text-18px" style="margin:0 0 12px;opacity:.75">New Delhi, India</p>', 1)

    # Forms: drop the dead /api/contact target and the unused Turnstile key; add a honeypot
    s = s.replace('action="/api/contact"', 'action="https://formsubmit.co/teamKLOUTKREW@gmail.com"')
    s = re.sub(r'\sdata-turnstile-sitekey="[^"]*"', '', s)
    s = re.sub(r'(<form[^>]*>)(?!<input type="text" name="_honey")', r'\1<input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">', s)
    if '/assets/forms.js' not in s and '<form' in s:
        s = s.replace('</body>', '<script src="/assets/forms.js" defer></script></body>', 1)
    if name == 'page.html' and '/assets/forms.js' not in s:
        s = s.replace('</body>', '<script src="/assets/forms.js" defer></script></body>', 1)

    # Shared CSS helpers
    if '.client_wordmark' not in s:
        s = s.replace('</head>', f'<style>{WORDMARK_CSS}</style></head>', 1)

    # Page-specific fixes
    if name == 'index.html':
        # Placeholder and broken client logos -> text wordmarks of real clients
        imgs = re.findall(r'<img[^>]*class="brand_logo[^"]*"[^>]*>', s)
        for img, client in zip(imgs, CLIENTS):
            s = s.replace(img, f'<span class="client_wordmark">{client}</span>', 1)
        # Descriptive H1 for search, keeping the visual wordmark
        s = s.replace('<h1 data-hero-title="">KLOUTKREW STUDIO</h1>',
                      '<h1 data-hero-title="">KLOUTKREW STUDIO<span class="sr-only">: branding, websites and AI brand films in New Delhi</span></h1>')
    if name == 'about.html':
        s = s.replace('KloutKrew is a Global Creative Studio, making', 'KloutKrew is a New Delhi Creative Studio, making')
        # Template copy from a property-sales theme
        s = s.replace('We help brands and people be part of the solution. As accuse by the lead branding<br/>',
                      'We work with founders and growing brands across branding, websites and marketing.<br/>')
        s = s.replace('We partner with entrepreneurs and family businesses, and the owners to unlock the value they have built in their companies.',
                      'One small senior team carries your idea from first sketch to launch, so nothing gets lost between agencies.')
        s = s.replace('<p class="why_choose_item_sub_text">Respond within</p><p class="why_choose_item_title">24 hours</p>',
                      '<p class="why_choose_item_sub_text">We reply within</p><p class="why_choose_item_title">24 hours</p>')
        s = s.replace('<p class="why_choose_item_sub_text">Make an offer in</p><p class="why_choose_item_title">Only 7 days</p>',
                      '<p class="why_choose_item_sub_text">First concepts in</p><p class="why_choose_item_title">7 days</p>')
        s = s.replace('<p class="why_choose_item_sub_text">Close the deal in</p><p class="why_choose_item_title">Just 60 days</p>',
                      '<p class="why_choose_item_sub_text">Most projects live in</p><p class="why_choose_item_title">4 to 6 weeks</p>')
        s = s.replace('alt="users avatar"', 'alt="Client photo"')
    if name in ('services.html', 'works.html'):
        s = s.replace('alt="users avatar"', 'alt="Client photo"')
    if name == '404.html':
        s = re.sub(r'<link rel="canonical"[^>]*>\s*', '', s)
        s = re.sub(r'<link rel="alternate" hreflang[^>]*>\s*', '', s)
        if 'name="robots"' not in s:
            s = s.replace('<meta charset="utf-8"/>', '<meta charset="utf-8"/><meta name="robots" content="noindex"/>', 1)
    if name == 'contact-us.html':
        s = s.replace('Lets roar into the wild together', "Let's roar into the wild together")

    if s != o:
        p.write_text(s, encoding='utf-8'); print('fixed', path)

for f in PAGES: fix(f)

# robots.txt
Path('robots.txt').write_text('User-agent: *\nAllow: /\n\nSitemap: https://kloutkrew.in/sitemap.xml\n')
print('fixed robots.txt')
