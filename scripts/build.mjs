// Builds the deployable site into dist/.
//
//   npm run build          production build (drafts hidden)
//   npm run build -- --drafts   include posts marked `draft: true`
//
// Static pages (index.html, about.html, ...) are copied as-is. Blog posts are
// generated from content/blog/*.md using templates/page.html, and every image
// referenced by a post is resized to responsive AVIF/WebP variants.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import mdAttrs from 'markdown-it-attrs';
import mdContainer from 'markdown-it-container';
import mdAnchor from 'markdown-it-anchor';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const POSTS_DIR = path.join(ROOT, 'content', 'blog');
const PAGES_DIR = path.join(ROOT, 'content', 'pages');
const MEDIA_URL = '/blog-media';
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'kk-images');
const SITE = 'https://kloutkrew.in';
const SITE_NAME = 'KloutKrew Studio';
const DEFAULT_OG = `${SITE}/assets/og-default.jpg`;
const INDEXNOW_KEY = '869664391aa65bf9d042173902dff1d6';
const INCLUDE_DRAFTS = process.argv.includes('--drafts') || process.env.VERCEL_ENV === 'preview';

// Files at the repo root that are part of the site.
const STATIC_EXT = new Set(['.html', '.mp4', '.webm', '.svg', '.ico', '.txt', '.xml', '.jpg', '.jpeg', '.png', '.webp', '.woff2', '.ttf']);
const STATIC_SKIP = new Set(['blog.html', 'profiles.json']); // generated
const STATIC_DIRS = ['assets'];

const WIDTHS = [480, 960, 1440, 1920];
const SIZES = {
  body: '(min-width: 860px) 760px, 92vw',
  wide: '(min-width: 1240px) 1160px, 94vw',
  full: '100vw',
  gallery: '(min-width: 860px) 370px, 46vw',
  cover: '(min-width: 1240px) 1160px, 94vw',
  card: '(min-width: 1100px) 420px, (min-width: 700px) 46vw, 92vw',
};

// ---------------------------------------------------------------- helpers
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const isoDate = d => d.toISOString().slice(0, 10);
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hash = (s, n = 8) => crypto.createHash('sha1').update(s).digest('hex').slice(0, n);

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  for (const e of await fsp.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d); else await fsp.copyFile(s, d);
  }
}

// ---------------------------------------------------------------- images
const imageJobs = new Map(); // abs source path -> Promise<result>

async function processImage(absSrc, slug) {
  if (imageJobs.has(absSrc)) return imageJobs.get(absSrc);
  const job = (async () => {
    if (!fs.existsSync(absSrc)) throw new Error(`Image not found: ${path.relative(ROOT, absSrc)}`);
    const buf = await fsp.readFile(absSrc);
    const ext = path.extname(absSrc).toLowerCase();
    const base = slugify(path.basename(absSrc, ext)) || 'image';
    const id = `${base}-${hash(buf)}`;
    const outDir = path.join(DIST, MEDIA_URL, slug);
    await fsp.mkdir(outDir, { recursive: true });

    // SVG and GIF (may be animated) are copied untouched.
    if (ext === '.svg' || ext === '.gif') {
      const name = `${id}${ext}`;
      await fsp.writeFile(path.join(outDir, name), buf);
      let width, height;
      try { ({ width, height } = await sharp(buf).metadata()); } catch {}
      return { passthrough: `${MEDIA_URL}/${slug}/${name}`, width, height };
    }

    const meta = await sharp(buf).rotate().metadata();
    const srcW = meta.autoOrient?.width ?? meta.width;
    const srcH = meta.autoOrient?.height ?? meta.height;
    const widths = WIDTHS.filter(w => w < srcW);
    if (!widths.length || widths.at(-1) < Math.min(srcW, 1920)) widths.push(Math.min(srcW, 1920));
    const out = { avif: [], webp: [], width: widths.at(-1), height: Math.round(srcH * widths.at(-1) / srcW) };

    await fsp.mkdir(CACHE_DIR, { recursive: true });
    for (const w of widths) {
      for (const fmt of ['avif', 'webp']) {
        const name = `${id}-${w}.${fmt}`;
        const cached = path.join(CACHE_DIR, name);
        if (!fs.existsSync(cached)) {
          let p = sharp(buf).rotate().resize({ width: w, withoutEnlargement: true });
          p = fmt === 'avif' ? p.avif({ quality: 52, effort: 4 }) : p.webp({ quality: 78 });
          await p.toFile(cached);
        }
        await fsp.copyFile(cached, path.join(outDir, name));
        out[fmt].push(`${MEDIA_URL}/${slug}/${name} ${w}w`);
      }
    }
    // Tiny blurred preview shown while the real image loads.
    const tiny = await sharp(buf).rotate().resize({ width: 24 }).blur(1.2).webp({ quality: 40 }).toBuffer();
    out.placeholder = `data:image/webp;base64,${tiny.toString('base64')}`;
    out.fallback = out.webp[Math.min(1, out.webp.length - 1)].split(' ')[0];
    // 1200x630 JPEG for link previews (LinkedIn, WhatsApp, X).
    const ogName = `${id}-og.jpg`;
    await sharp(buf).rotate().resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, ogName));
    out.og = `${MEDIA_URL}/${slug}/${ogName}`;
    return out;
  })();
  imageJobs.set(absSrc, job);
  return job;
}

function pictureHTML(img, { alt = '', sizes = SIZES.body, eager = false, cls = '' } = {}) {
  if (!img) return '';
  if (img.external) {
    return `<img src="${esc(img.external)}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${cls ? ` class="${cls}"` : ''}>`;
  }
  if (img.passthrough) {
    const dims = img.width ? ` width="${img.width}" height="${img.height}"` : '';
    return `<img src="${img.passthrough}" alt="${esc(alt)}"${dims} loading="${eager ? 'eager' : 'lazy'}" decoding="async"${cls ? ` class="${cls}"` : ''}>`;
  }
  return `<picture>`
    + `<source type="image/avif" srcset="${img.avif.join(', ')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${img.webp.join(', ')}" sizes="${sizes}">`
    + `<img src="${img.fallback}" alt="${esc(alt)}" width="${img.width}" height="${img.height}"`
    + ` loading="${eager ? 'eager' : 'lazy'}" decoding="${eager ? 'sync' : 'async'}"${eager ? ' fetchpriority="high"' : ''}`
    + ` style="background-image:url(${img.placeholder})"${cls ? ` class="${cls}"` : ''}>`
    + `</picture>`;
}

function resolveImage(src, mdFile) {
  if (/^https?:\/\//.test(src)) return { external: src };
  const clean = decodeURI(src.split(/[?#]/)[0]);
  if (clean.startsWith('/')) return path.join(ROOT, clean);
  return path.resolve(path.dirname(mdFile), clean);
}

// ---------------------------------------------------------------- markdown
const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
  .use(mdAttrs, { allowedAttributes: ['id', 'class', 'width'] })
  .use(mdAnchor, { slugify, tabIndex: false })
  .use(mdContainer, 'gallery', { render: (t, i) => (t[i].nesting === 1 ? '<div class="kb-gallery">\n' : '</div>\n') })
  .use(mdContainer, 'note', {
    render: (t, i) => {
      if (t[i].nesting !== 1) return '</aside>\n';
      const label = t[i].info.trim().slice('note'.length).trim();
      return `<aside class="kb-callout">${label ? `<p class="kb-callout-label">${md.utils.escapeHtml(label)}</p>` : ''}\n`;
    },
  });

// Images: rendered from pre-processed results stored in env.images.
md.renderer.rules.image = (tokens, idx, _opts, env) => {
  const t = tokens[idx];
  const src = t.attrGet('src');
  const alt = t.children?.length ? md.renderer.renderInlineAsText(t.children, md.options, env) : t.content;
  const caption = t.attrGet('title');
  const cls = (t.attrGet('class') || '').split(/\s+/).filter(Boolean);
  const variant = cls.includes('full') ? 'full' : cls.includes('wide') ? 'wide' : env.inGallery ? 'gallery' : 'body';
  const img = env.images.get(src);
  const pic = pictureHTML(img, { alt, sizes: SIZES[variant] });
  return `<figure class="kb-figure kb-figure--${variant}">${pic}${caption ? `<figcaption>${md.utils.escapeHtml(caption)}</figcaption>` : ''}</figure>`;
};
// Track gallery context so gallery images get the right `sizes`.
const origOpen = md.renderer.rules.container_gallery_open;
md.renderer.rules.container_gallery_open = (t, i, o, env, self) => { env.inGallery = true; return origOpen(t, i, o, env, self); };
const origClose = md.renderer.rules.container_gallery_close;
md.renderer.rules.container_gallery_close = (t, i, o, env, self) => { env.inGallery = false; return origClose(t, i, o, env, self); };
// External links open in a new tab.
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (/^https?:\/\//.test(href) && !href.startsWith(SITE)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener');
  }
  return self.renderToken(tokens, idx, opts);
};
// Tables scroll sideways on small screens.
md.renderer.rules.table_open = () => '<div class="kb-table"><table>';
md.renderer.rules.table_close = () => '</table></div>';

async function renderMarkdown(body, mdFile, slug) {
  const env = { images: new Map(), inGallery: false };
  const tokens = md.parse(body, env);
  const srcs = new Set();
  const walk = list => list.forEach(t => { if (t.type === 'image') srcs.add(t.attrGet('src')); if (t.children) walk(t.children); });
  walk(tokens);
  for (const src of srcs) {
    const r = resolveImage(src, mdFile);
    env.images.set(src, typeof r === 'string' ? await processImage(r, slug) : r);
  }
  let html = md.renderer.render(tokens, md.options, env);
  // An image on its own line is a figure, not a paragraph.
  html = html.replace(/<p>\s*(<figure[\s\S]*?<\/figure>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>((?:\s*<figure[\s\S]*?<\/figure>\s*)+)<\/p>/g, '$1');
  // Responsive embeds (YouTube / Vimeo / Loom iframes).
  html = html.replace(/<iframe\b/g, '<iframe loading="lazy"');
  return html;
}

// ---------------------------------------------------------------- posts
async function loadPosts() {
  const files = (await fsp.readdir(POSTS_DIR)).filter(f => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md');
  const posts = [];
  for (const file of files) {
    const abs = path.join(POSTS_DIR, file);
    const { data, content } = matter(await fsp.readFile(abs, 'utf8'));
    const slug = data.slug ? slugify(data.slug) : path.basename(file, '.md');
    const problems = ['title', 'description', 'date'].filter(k => !data[k]);
    if (problems.length) throw new Error(`${file}: missing front matter field(s): ${problems.join(', ')}`);
    if (data.draft && !INCLUDE_DRAFTS) { console.log(`  skip draft  ${file}`); continue; }
    const date = new Date(data.date);
    if (Number.isNaN(+date)) throw new Error(`${file}: date "${data.date}" is not a valid date (use YYYY-MM-DD)`);
    // Scheduled posts: a future date keeps the post off the live site until a build on or after that day (India time).
    const todayIST = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    if (!INCLUDE_DRAFTS && isoDate(date) > todayIST) { console.log(`  scheduled   ${file} (${isoDate(date)})`); continue; }
    const words = content.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length;
    const html = await renderMarkdown(content, abs, slug);
    let cover = null;
    if (data.cover) {
      const r = resolveImage(String(data.cover), abs);
      cover = typeof r === 'string' ? await processImage(r, slug) : r;
    }
    posts.push({
      slug, file, html, cover,
      title: String(data.title),
      description: String(data.description),
      date,
      updated: data.updated ? new Date(data.updated) : null,
      category: String(data.category || 'Studio Notes'),
      author: String(data.author || SITE_NAME),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      coverAlt: String(data.coverAlt || data.title),
      featured: Boolean(data.featured),
      draft: Boolean(data.draft),
      readMins: Math.max(1, Math.round(words / 220)),
      faqs: Array.isArray(data.faqs) ? data.faqs : [],
    });
  }
  return posts.sort((a, b) => b.date - a.date);
}

// ---------------------------------------------------------------- page assembly
const template = fs.readFileSync(path.join(ROOT, 'templates', 'page.html'), 'utf8');

function headHTML({ title, description, url, image, type = 'website', jsonLd, extra = '' }) {
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}"/>`,
    `<link rel="canonical" href="${url}"/>`,
    `<meta property="og:type" content="${type}"/>`,
    `<meta property="og:title" content="${esc(title)}"/>`,
    `<meta property="og:description" content="${esc(description)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<meta property="og:image" content="${image}"/>`,
    `<meta property="og:site_name" content="${SITE_NAME}"/>`,
    `<meta name="twitter:title" content="${esc(title)}"/>`,
    `<meta name="twitter:description" content="${esc(description)}"/>`,
    `<meta name="twitter:image" content="${image}"/>`,
    `<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} Blog" href="${SITE}/blog/rss.xml"/>`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
    extra,
  ].join('\n');
}

const page = (head, content, scripts = '') =>
  template.replace('{{HEAD}}', () => head).replace('{{CONTENT}}', () => content).replace('{{SCRIPTS}}', () => scripts);

// Branded typographic cover for posts without an image.
const ACCENTS = ['#ee1515', '#ff691e', '#fdbc53', '#ab9bff', '#ff767a'];
function genCover(post, big = false) {
  const n = parseInt(hash(post.slug, 6), 16);
  const accent = ACCENTS[n % ACCENTS.length];
  const pos = ['80% 15%', '15% 85%', '85% 85%', '20% 20%'][n % 4];
  return `<div class="kb-gen${big ? ' kb-gen--big' : ''}" style="--kb-accent:${accent};--kb-pos:${pos}" aria-hidden="true">`
    + `<span class="kb-gen-mark">// KLOUTKREW</span>`
    + `<span class="kb-gen-title">${esc(post.category)}</span></div>`;
}

function media(post, sizes, eager = false) {
  return post.cover ? pictureHTML(post.cover, { alt: post.coverAlt, sizes, eager }) : genCover(post);
}

function meta(post) {
  return `<time datetime="${isoDate(post.date)}">${fmtDate(post.date)}</time><span>${post.readMins} min read</span>`;
}

function card(post, i) {
  return `<a href="/blog/${post.slug}" class="kb-card" data-cat="${esc(slugify(post.category))}" style="--i:${i}">`
    + `<div class="kb-card-media">${media(post, SIZES.card)}</div>`
    + `<div class="kb-card-body"><span class="kb-pill">${esc(post.category)}</span>${post.draft ? '<span class="kb-pill kb-pill--draft">Draft</span>' : ''}`
    + `<h3 class="kb-card-title">${esc(post.title)}</h3>`
    + `<p class="kb-card-excerpt">${esc(post.description)}</p>`
    + `<p class="kb-meta">${meta(post)}</p></div></a>`;
}

const CTA = `<section class="kb-cta"><div class="kb-wrap"><div class="kb-cta-box">
<p class="kb-eyebrow"><span class="kb-dot"></span>Got a project <em>(in)</em> mind?</p>
<h2 class="kb-cta-title">Let's build your<br>brand together.</h2>
<a href="/contact-us" class="kb-btn">Start a project</a>
</div></div></section>`;

function listingPage(posts) {
  const featured = posts.find(p => p.featured) || posts[0];
  const rest = posts.filter(p => p !== featured);
  const cats = [...new Set(posts.map(p => p.category))];
  const content = `<main class="kb kb-listing">
<section class="kb-hero"><div class="kb-wrap">
<p class="kb-eyebrow"><span class="kb-dot"></span>Inside <em>(the)</em> studio</p>
<h1 class="kb-hero-title">Blog<sup>(${posts.length})</sup></h1>
<p class="kb-hero-sub">Branding, design, development and marketing — what we're learning while building brands that stop the scroll.</p>
</div></div></section>
${featured ? `<section class="kb-featured"><div class="kb-wrap">
<a href="/blog/${featured.slug}" class="kb-feature">
<div class="kb-feature-media">${featured.cover ? pictureHTML(featured.cover, { alt: featured.coverAlt, sizes: '(min-width: 1000px) 640px, 94vw', eager: true }) : genCover(featured, true)}</div>
<div class="kb-feature-body"><span class="kb-pill">${esc(featured.category)}</span>
<h2 class="kb-feature-title">${esc(featured.title)}</h2>
<p class="kb-feature-excerpt">${esc(featured.description)}</p>
<p class="kb-meta">${meta(featured)}</p>
<span class="kb-link">Read the article</span></div></a>
</div></section>` : ''}
<section class="kb-archive"><div class="kb-wrap">
<div class="kb-filters" role="toolbar" aria-label="Filter by category">
<button class="kb-chip is-active" data-filter="all" aria-pressed="true">All</button>
${cats.map(c => `<button class="kb-chip" data-filter="${esc(slugify(c))}" aria-pressed="false">${esc(c)}</button>`).join('\n')}
</div>
<div class="kb-grid">${rest.map(card).join('\n')}</div>
<p class="kb-empty" hidden>Nothing here yet — check back soon.</p>
${rest.length > 12 ? `<p class="kb-more-wrap"><button type="button" class="kb-btn kb-more">Show more articles</button></p>` : ''}
</div></section>
${CTA}
</main>`;
  const head = headHTML({
    title: `Branding, Web & Marketing Blog | ${SITE_NAME}`,
    description: 'Guides on branding, packaging, websites, AI brand films and marketing from KloutKrew Studio, an independent creative studio working with brands worldwide.',
    url: `${SITE}/blog`,
    image: featured?.cover?.og ? SITE + featured.cover.og : DEFAULT_OG,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Blog', name: `${SITE_NAME} Blog`, url: `${SITE}/blog`,
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.svg` } },
      blogPost: posts.slice(0, 20).map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: isoDate(p.date) })),
    },
  });
  return page(head, content, `<script src="/assets/blog.js" defer></script>`);
}

function faqSection(faqs) {
  if (!faqs.length) return '';
  return `<section class="kb-faq" aria-labelledby="faq-title"><div class="kb-narrow">
<h2 id="faq-title">Frequently asked questions</h2>
${faqs.map(f => `<details><summary>${esc(f.q)}</summary><div>${md.render(String(f.a))}</div></details>`).join('\n')}
</div></section>`;
}
const faqLd = faqs => ({ '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: String(f.a).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') } })) });

function postPage(post, posts) {
  const related = [
    ...posts.filter(p => p !== post && p.category === post.category),
    ...posts.filter(p => p !== post && p.category !== post.category),
  ].slice(0, 3);
  const url = `${SITE}/blog/${post.slug}`;
  const share = encodeURIComponent(url);
  const content = `<div class="kb-progress" aria-hidden="true"></div>
<main class="kb kb-article">
${post.draft ? '<p class="kb-draft-banner">Draft preview — this post is hidden on the live site until you remove <code>draft: true</code>.</p>' : ''}
<article>
<header class="kb-post-head"><div class="kb-narrow">
<a href="/blog" class="kb-back">All articles</a>
<span class="kb-pill">${esc(post.category)}</span>
<h1 class="kb-post-title">${esc(post.title)}</h1>
<p class="kb-post-dek">${esc(post.description)}</p>
<p class="kb-meta"><span>By ${esc(post.author)}</span>${meta(post)}</p>
</div></header>
<div class="kb-cover">${post.cover ? pictureHTML(post.cover, { alt: post.coverAlt, sizes: SIZES.cover, eager: true }) : genCover(post, true)}</div>
<div class="kb-post-body">
${post.html}
</div>
${faqSection(post.faqs)}
<footer class="kb-post-foot"><div class="kb-narrow">
${post.tags.length ? `<ul class="kb-tags">${post.tags.map(t => `<li>#${esc(t)}</li>`).join('')}</ul>` : ''}
<div class="kb-share"><span>Share</span>
<a href="https://www.linkedin.com/sharing/share-offsite/?url=${share}" target="_blank" rel="noopener">LinkedIn</a>
<a href="https://wa.me/?text=${encodeURIComponent(post.title + ' ' + url)}" target="_blank" rel="noopener">WhatsApp</a>
<a href="https://twitter.com/intent/tweet?url=${share}&text=${encodeURIComponent(post.title)}" target="_blank" rel="noopener">X</a>
<button type="button" class="kb-copy" data-url="${url}">Copy link</button></div>
</div></footer>
</article>
${related.length ? `<section class="kb-related"><div class="kb-wrap"><h2 class="kb-section-title">Keep reading</h2><div class="kb-grid">${related.map(card).join('\n')}</div></div></section>` : ''}
${CTA}
</main>`;
  const image = post.cover?.og ? SITE + post.cover.og : post.cover?.external || DEFAULT_OG;
  const head = headHTML({
    title: `${post.title} | ${SITE_NAME}`,
    description: post.description,
    url, image, type: 'article',
    extra: [
      `<meta property="article:published_time" content="${post.date.toISOString()}"/>`,
      post.updated ? `<meta property="article:modified_time" content="${post.updated.toISOString()}"/>` : '',
      `<meta property="article:section" content="${esc(post.category)}"/>`,
      post.tags.length ? `<meta name="keywords" content="${esc(post.tags.join(', '))}"/>` : '',
      post.draft ? '<meta name="robots" content="noindex"/>' : '',
      post.cover && !post.cover.external && !post.cover.passthrough
        ? `<link rel="preload" as="image" type="image/avif" imagesrcset="${post.cover.avif.join(', ')}" imagesizes="${SIZES.cover}" fetchpriority="high"/>` : '',
    ].filter(Boolean).join('\n'),
    jsonLd: post.faqs.length ? { '@context': 'https://schema.org', '@graph': [{ '@type': 'BlogPosting',
      headline: post.title, description: post.description, image,
      datePublished: post.date.toISOString(), dateModified: (post.updated || post.date).toISOString(),
      author: post.author === SITE_NAME ? { '@type': 'Organization', name: SITE_NAME } : { '@type': 'Person', name: post.author, worksFor: { '@type': 'Organization', name: SITE_NAME, url: SITE } },
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.svg` } },
      mainEntityOfPage: url, keywords: post.tags.join(', '), articleSection: post.category }, faqLd(post.faqs)] } : {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: post.title, description: post.description, image,
      datePublished: post.date.toISOString(), dateModified: (post.updated || post.date).toISOString(),
      author: post.author === SITE_NAME ? { '@type': 'Organization', name: SITE_NAME } : { '@type': 'Person', name: post.author, worksFor: { '@type': 'Organization', name: SITE_NAME, url: SITE } },
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.svg` } },
      mainEntityOfPage: url, keywords: post.tags.join(', '), articleSection: post.category,
    },
  });
  return page(head, content, `<script src="/assets/blog.js" defer></script>`);
}

function rss(posts) {
  const items = posts.filter(p => !p.draft).slice(0, 30).map(p => `<item>
<title>${esc(p.title)}</title><link>${SITE}/blog/${p.slug}</link><guid>${SITE}/blog/${p.slug}</guid>
<pubDate>${p.date.toUTCString()}</pubDate><category>${esc(p.category)}</category>
<description>${esc(p.description)}</description></item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${SITE_NAME} Blog</title><link>${SITE}/blog</link><language>en</language>
<description>Ideas on branding, design, development and marketing.</description>
<atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel></rss>
`;
}

function sitemap(posts, landings = []) {
  const src = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const keep = [...src.matchAll(/<url>[\s\S]*?<\/url>/g)].map(m => m[0]).filter(u => !/<loc>[^<]*\/blog\/[^<]+<\/loc>/.test(u));
  const today = isoDate(new Date());
  const blogUrls = posts.filter(p => !p.draft).map(p => `  <url>
    <loc>${SITE}/blog/${p.slug}</loc>
    <lastmod>${isoDate(p.updated || p.date)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  const all = keep.map(u => '  ' + u.replace(/(<loc>https:\/\/kloutkrew\.in\/blog<\/loc>\s*<lastmod>)[^<]*/, `$1${today}`));
  const lpUrls = landings.map(l => `  <url>
    <loc>${SITE}/${l.slug}</loc>
    <lastmod>${isoDate(l.updated)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...all, ...lpUrls, ...blogUrls].join('\n')}
</urlset>
`;
}

// ---------------------------------------------------------------- landing pages (content/pages/*.md -> /<slug>)
async function loadLandingPages() {
  if (!fs.existsSync(PAGES_DIR)) return [];
  const files = (await fsp.readdir(PAGES_DIR)).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  const out = [];
  for (const file of files) {
    const abs = path.join(PAGES_DIR, file);
    const { data, content } = matter(await fsp.readFile(abs, 'utf8'));
    const slug = data.slug ? slugify(data.slug) : path.basename(file, '.md');
    for (const k of ['title', 'h1', 'description']) if (!data[k]) throw new Error(`${file}: missing front matter field: ${k}`);
    out.push({ slug, data, html: await renderMarkdown(content, abs, slug), updated: data.updated ? new Date(data.updated) : new Date() });
  }
  return out;
}

const SERVICES = [
  ['branding-agency', 'Brand identity'], ['logo-design', 'Logo design'], ['packaging-design-agency', 'Packaging design'],
  ['graphic-design', 'Graphic design'], ['website-design-agency', 'Website design'], ['ui-ux-design-agency', 'UI/UX design'],
  ['shopify-store-design', 'Shopify stores'], ['ai-brand-films', 'AI brand films'], ['content-ugc-production', 'Content & UGC'],
  ['social-media-marketing', 'Social media'], ['performance-marketing', 'Performance marketing'], ['seo-services', 'SEO & AI search'],
];
const servicesNav = self => `<section class="kb-services-nav" aria-labelledby="svc-nav-title"><div class="kb-narrow">
<h2 id="svc-nav-title">${self ? 'Other services' : 'Our services'}</h2>
<ul>${SERVICES.filter(([s]) => s !== self).map(([s, n]) => `<li><a href="/${s}">${esc(n)}</a></li>`).join('')}</ul>
</div></section>`;

// Real project work shown on service pages (assets/work/*). Logo-only marks are shown on their brand colour.
const WORK = {
  'drink-different': { name: 'Drink Different', cat: 'Web', img: '/assets/work/drink-different.webp' },
  'plenova': { name: 'Plenova', cat: 'Web & Dev', img: '/assets/work/plenova.webp' },
  'push-past': { name: 'Push Past', cat: 'Packaging', img: '/assets/work/push-past.webp' },
  'on-demand-experts': { name: 'On-Demand Experts', cat: 'Packaging', img: '/assets/work/on-demand-experts.webp' },
  'tou-fist': { name: 'Tou Fist', cat: 'Branding', img: '/assets/work/tou-fist.png', mark: 'rgb(207,23,31)' },
  'waku-waku': { name: 'Waku Waku', cat: 'Branding', img: '/assets/work/waku-waku.png', mark: 'rgb(140,198,62)' },
  'owg-campaign': { name: 'OWG Campaign', cat: 'Campaign', img: '/assets/work/owg-campaign.webp', video: '/OWG%20Campaign.mp4' },
  'owg-remaster': { name: 'OWG 4K Remaster', cat: 'Brand Film', img: '/assets/work/owg-remaster.webp', video: '/Owg%204K%20remastered.mp4' },
  'magnific-creation': { name: 'Magnific Creation', cat: 'AI Film', img: '/assets/work/magnific-creation.webp', video: '/magnific_creation-7_uq81p0BQLD.mp4' },
  'magnific-final': { name: 'Magnific Final', cat: 'AI Film', img: '/assets/work/magnific-final.webp', video: '/magnific_final-3_VdKUFjRMMU.mp4' },
  'visual-style-baseline': { name: 'Visual Style Baseline', cat: 'Brand Film', img: '/assets/work/visual-style-baseline.webp', video: '/magnific_visual-style-baseline-35m_UyB1VApwny.mp4' },
};
const DEFAULT_FACTS = [['24h', 'Reply to every enquiry'], ['7 days', 'To your first concepts'], ['4–6 wks', 'For most projects to go live']];


// Free budget planner (content/pages/brand-budget-calculator.md, `tool: budget`). Market ranges in INR, sourced in the page body.
const BUDGET_ITEMS = [
  { id: 'logo', name: 'Logo & identity', kind: 'once', opts: [['Basic professional logo', 5000, 20000], ['Agency brand identity', 100000, null]] },
  { id: 'pack', name: 'Packaging design', kind: 'sku', opts: [['Freelancer, per SKU', 4400, 70400], ['Studio, per SKU', 132000, 440000]] },
  { id: 'web', name: 'Website', kind: 'once', opts: [['Template site', 5000, 50000], ['Custom design', 100000, 500000]] },
  { id: 'shop', name: 'Shopify store', kind: 'once', opts: [['Basic setup', 35000, 75000], ['Custom store', 200000, 500000]] },
  { id: 'film', name: 'Brand film', kind: 'once', opts: [['AI-led brand film', 50000, 75000], ['Traditional 30s ad film', 200000, 2000000]] },
  { id: 'social', name: 'Social media', kind: 'month', opts: [['Freelancer', 15000, 50000], ['Boutique agency', 30000, 150000]] },
  { id: 'ads', name: 'Ads management fee', kind: 'month', opts: [['Single channel', 20000, 40000], ['Multi-channel', 40000, 100000]] },
  { id: 'seo', name: 'SEO', kind: 'month', opts: [['Local SEO', 8000, 20000], ['National / ecommerce', 15000, 150000]] },
];
const budgetTool = () => `<section class="kbt" aria-labelledby="kbt-title"><div class="kbt-in">
<form class="kbt-form" id="kbt" onsubmit="return false">
<h2 id="kbt-title" class="kbt-h">Pick what you need</h2>
${BUDGET_ITEMS.map(it => `<fieldset class="kbt-row" data-kind="${it.kind}"><legend>${esc(it.name)} <small>${it.kind === 'month' ? 'per month' : it.kind === 'sku' ? 'per SKU' : 'one-time'}</small></legend>
<div class="kbt-opts"><label><input type="radio" name="${it.id}" value="" checked><span>Skip</span></label>${it.opts.map(([n, lo, hi], i) => `<label><input type="radio" name="${it.id}" value="${i}" data-lo="${lo}" data-hi="${hi ?? ''}"><span>${esc(n)}<em data-lo="${lo}" data-hi="${hi ?? ''}"></em></span></label>`).join('')}</div>
${it.kind === 'sku' ? `<label class="kbt-num">Number of SKUs <input type="number" id="kbt-skus" min="1" max="200" value="3" inputmode="numeric"></label>` : ''}
</fieldset>`).join('\n')}
<fieldset class="kbt-row kbt-plan"><legend>Plan</legend>
<label class="kbt-num">Months of marketing <input type="number" id="kbt-months" min="1" max="36" value="6" inputmode="numeric"></label>
<label class="kbt-num">Monthly ad spend, <span class="kbt-cur">₹</span> <input type="number" id="kbt-spend" min="0" step="1000" value="0" inputmode="numeric"></label>
<div class="kbt-cur-switch" role="group" aria-label="Currency"><label><input type="radio" name="cur" value="INR" checked><span>₹ INR</span></label><label><input type="radio" name="cur" value="USD"><span>$ USD</span></label></div>
</fieldset>
</form>
<aside class="kbt-out" aria-live="polite">
<p class="kbt-lab">Launch (one-time)</p><p class="kbt-val" id="kbt-once">—</p>
<p class="kbt-lab">Marketing fees <span id="kbt-mlab"></span></p><p class="kbt-val" id="kbt-month">—</p>
<p class="kbt-lab">Ad spend</p><p class="kbt-val kbt-sm" id="kbt-ads">—</p>
<p class="kbt-lab kbt-tot-lab">Estimated total</p><p class="kbt-val kbt-tot" id="kbt-tot">Pick a line item</p>
<p class="kbt-note">Market ranges from published 2026 Indian pricing guides, not a KloutKrew quote. $ at about ₹88.</p>
<a class="kb-btn" id="kbt-cta" href="/contact-us">Get an exact quote</a>
</aside>
</div></section>
<script>(function(){var f=document.getElementById('kbt');if(!f)return;var R=88;function cur(){return f.querySelector('[name=cur]:checked').value}
function fmt(n){if(cur()==='USD'){n=n/R;return '$'+(n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?Math.round(n/100)/10+'k':Math.round(n))}if(n>=1e7)return '₹'+(n/1e7).toFixed(1).replace(/\\.0$/,'')+' Cr';if(n>=1e5)return '₹'+(n/1e5).toFixed(1).replace(/\\.0$/,'')+' L';return '₹'+Math.round(n).toLocaleString('en-IN')}
function rng(lo,hi,open){return lo===hi&&!open?fmt(lo):fmt(lo)+' – '+fmt(hi)+(open?'+':'')}
function num(id,d){var v=parseFloat(document.getElementById(id).value);return isFinite(v)&&v>=0?v:d}
function calc(){f.querySelectorAll('em[data-lo]').forEach(function(e){var h=e.dataset.hi;e.textContent=h?fmt(+e.dataset.lo)+'–'+fmt(+h):fmt(+e.dataset.lo)+'+'});document.querySelectorAll('.kbt-cur').forEach(function(e){e.textContent=cur()==='USD'?'$':'₹'});
var sk=Math.max(1,num('kbt-skus',1)),mo=Math.max(1,num('kbt-months',1)),sp=num('kbt-spend',0)*(cur()==='USD'?R:1),o=[0,0,false],m=[0,0,false],any=false,items=[];
f.querySelectorAll('fieldset[data-kind]').forEach(function(fs){var r=fs.querySelector('input[type=radio]:checked');if(!r||r.value==='')return;any=true;var lo=+r.dataset.lo,hi=r.dataset.hi?+r.dataset.hi:lo,op=!r.dataset.hi,k=fs.dataset.kind,x=k==='sku'?sk:k==='month'?mo:1,t=k==='month'?m:o;t[0]+=lo*x;t[1]+=hi*x;t[2]=t[2]||op;items.push(fs.querySelector('legend').firstChild.textContent.trim()+': '+r.nextElementSibling.firstChild.textContent)});
var g=function(id,s){document.getElementById(id).textContent=s};g('kbt-mlab','('+mo+' mo)');g('kbt-once',o[1]?rng(o[0],o[1],o[2]):'—');g('kbt-month',m[1]?rng(m[0],m[1],m[2]):'—');g('kbt-ads',sp?fmt(sp*mo):'—');
g('kbt-tot',any||sp?rng(o[0]+m[0]+sp*mo,o[1]+m[1]+sp*mo,o[2]||m[2]):'Pick a line item');
document.getElementById('kbt-cta').href='/contact-us'+(items.length?'?brief='+encodeURIComponent(items.join('; ')):'');}
var fired=false;f.addEventListener('input',function(){calc();if(!fired&&window.gtag){fired=true;gtag('event','tool_use',{tool:'budget_calculator'})}});var last='INR';f.addEventListener('change',function(e){if(e.target.name==='cur'){var c=cur(),s=document.getElementById('kbt-spend'),v=parseFloat(s.value)||0;if(c!==last){s.value=Math.round(c==='USD'?v/R:v*R);s.step=c==='USD'?50:1000;last=c}}calc()});calc();})();</script>`;

function workMedia(w, { eager = false, playable = false } = {}) {
  if (w.mark) return `<div class="kl-mark" style="--mark:${w.mark}"><img src="${w.img}" alt="${esc(w.name)} logo" width="260" height="260" loading="${eager ? 'eager' : 'lazy'}"></div>`;
  if (w.video && playable) return `<video class="kl-video" muted loop playsinline preload="none" poster="${w.img}" data-src="${w.video}" aria-label="${esc(w.name)} film"></video>`;
  return `<img src="${w.img}" alt="${esc(w.name)}, ${esc(w.cat.toLowerCase())} project by KloutKrew Studio" loading="${eager ? 'eager' : 'lazy'}" ${eager ? 'fetchpriority="high"' : ''}>`;
}

// Wrap each "## Heading" section of the markdown in a two-column block.
function sectionize(html) {
  const parts = html.split(/(?=<h2[\s>])/);
  const intro = parts[0].trim();
  const secs = parts.slice(1).map(p => {
    const m = p.match(/^<h2[^>]*>[\s\S]*?<\/h2>/);
    let body = p.slice(m[0].length)
      // card lists: "<strong>Title.</strong>, rest" -> clean title + capitalised description
      .replace(/<li><strong>([\s\S]*?)\.?<\/strong>[,.:;]?\s*([a-z])?/g, (_, t, c) => `<li><strong>${t}</strong>${c ? c.toUpperCase() : ''}`)
      // ordered steps: wrap content so the number and text sit in two clean columns
      .replace(/<ol>([\s\S]*?)<\/ol>/g, (_, items) => `<ol>${items.replace(/<li>([\s\S]*?)<\/li>/g, '<li><div>$1</div></li>')}</ol>`);
    return `<section class="kl-sec"><div class="kl-sec-head">${m[0]}</div><div class="kl-sec-body">${body}</div></section>`;
  }).join('\n');
  return { intro, secs };
}

function landingPage(lp) {
  const d = lp.data, url = `${SITE}/${lp.slug}`;
  const faqs = Array.isArray(d.faqs) ? d.faqs : [];
  const facts = Array.isArray(d.facts) ? d.facts.map(f => [f.big, f.label]) : DEFAULT_FACTS;
  const hero = WORK[d.hero];
  const work = (d.work || []).map(k => WORK[k]).filter(Boolean);
  const { intro, secs } = sectionize(lp.html);
  const isService = SERVICES.some(([x]) => x === lp.slug);
  const others = SERVICES.filter(([s]) => s !== lp.slug);

  const content = `<main class="kb kl">
<header class="kl-hero"><div class="kl-hero-in">
<div class="kl-hero-text">
<p class="kb-eyebrow"><span class="kb-dot"></span>${esc(d.eyebrow || 'Service')} <em>(by KloutKrew)</em></p>
<h1 class="kl-title">${esc(d.h1)}</h1>
<p class="kl-dek">${esc(d.description)}</p>
<p class="kl-ctas"><a href="${d.tool ? '#kbt' : '/contact-us'}" class="kb-btn">${d.tool ? 'Start planning' : 'Get a quote'}</a> <a href="/works" class="kl-link">See our work</a></p>
</div>
${hero ? `<figure class="kl-hero-media">${workMedia(hero, { eager: true, playable: true })}<figcaption><span>${esc(hero.name)}</span>${esc(hero.cat)}</figcaption></figure>` : ''}
</div></header>
<section class="kl-facts" aria-label="${d.tool ? 'About this tool' : 'How we work'}"><ul>${facts.map(([big, label]) => `<li><b>${esc(big)}</b><span>${esc(label)}</span></li>`).join('')}</ul></section>
${d.tool === 'budget' ? budgetTool() : ''}
<div class="kl-body">
${intro ? `<div class="kl-intro">${intro}</div>` : ''}
${secs}
</div>
${work.length ? `<section class="kl-work" aria-labelledby="kl-work-title"><div class="kl-work-head"><h2 id="kl-work-title">Selected work</h2><a href="/works" class="kl-link">See all projects</a></div>
<ul class="kl-work-grid">${work.map(w => `<li><a href="/works"><div class="kl-work-media">${workMedia(w, { playable: true })}</div><p><b>${esc(w.name)}</b><span>${esc(w.cat)}</span></p></a></li>`).join('')}</ul></section>` : ''}
${faqs.length ? `<section class="kl-sec kl-faq" aria-labelledby="faq-title"><div class="kl-sec-head"><h2 id="faq-title">Questions <em>(we get)</em></h2></div><div class="kl-sec-body">
${faqs.map(f => `<details><summary>${esc(f.q)}</summary><div>${md.render(String(f.a))}</div></details>`).join('\n')}
</div></section>` : ''}
<nav class="kl-services" aria-labelledby="kl-svc-title"><p id="kl-svc-title" class="kb-eyebrow"><span class="kb-dot"></span>${isService ? 'Other services' : 'Our services'}</p>
<ul>${others.map(([s, n]) => `<li><a href="/${s}">${esc(n)}</a></li>`).join('')}</ul></nav>
${CTA}
</main>
<script>(function(){var r=matchMedia('(prefers-reduced-motion: reduce)').matches;var vs=document.querySelectorAll('.kl video[data-src]');if(!('IntersectionObserver' in window))return;var io=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.isIntersecting){if(!v.src){v.src=v.dataset.src;}if(!r)v.play().catch(function(){});}else{v.pause();}});},{rootMargin:'200px'});function go(){vs.forEach(function(v){io.observe(v);});}if(document.readyState==='complete')setTimeout(go,1200);else addEventListener('load',function(){setTimeout(go,1200);});})();</script>`;
  const graph = [{
    '@type': 'Service', name: d.serviceName || d.h1, url, description: d.description,
    provider: { '@type': 'ProfessionalService', name: SITE_NAME, url: SITE },
    areaServed: (d.areaServed || ['Worldwide']).map(n => ({ '@type': 'Place', name: n })),
    serviceType: d.serviceTypes || ['Branding', 'Packaging design', 'Website design', 'AI brand films'],
  }, {
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: d.breadcrumb || d.h1, item: url },
    ],
  }];
  if (d.tool) graph.push({ '@type': 'WebApplication', name: d.h1, url, applicationCategory: 'BusinessApplication', operatingSystem: 'Any', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE } });
  if (faqs.length) graph.push({ '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: String(f.a).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') } })) });
  const image = hero && !hero.mark ? SITE + hero.img : DEFAULT_OG;
  const head = headHTML({ title: d.title, description: d.metaDescription || d.description, url, image,
    extra: hero && !hero.mark && !(hero.video) ? `<link rel="preload" as="image" href="${hero.img}" fetchpriority="high">` : '',
    jsonLd: { '@context': 'https://schema.org', '@graph': graph } });
  return page(head, content, `<script src="/assets/blog.js" defer></script>`);
}

// ---------------------------------------------------------------- main
async function main() {
  const t0 = Date.now();
  await fsp.rm(DIST, { recursive: true, force: true });
  await fsp.mkdir(path.join(DIST, 'blog'), { recursive: true });

  for (const e of await fsp.readdir(ROOT, { withFileTypes: true })) {
    if (e.isFile() && STATIC_EXT.has(path.extname(e.name).toLowerCase()) && !STATIC_SKIP.has(e.name)) {
      await fsp.copyFile(path.join(ROOT, e.name), path.join(DIST, e.name));
    }
  }
  for (const d of STATIC_DIRS) await copyDir(path.join(ROOT, d), path.join(DIST, d));

  const posts = await loadPosts();
  // Links to posts that aren't live yet (scheduled for a later date) become plain text until they publish.
  const live = new Set(posts.map(p => p.slug));
  const unlinkScheduled = html => html.replace(/<a [^>]*href="\/blog\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g, (m, slug, text) => live.has(slug) ? m : text);
  for (const p of posts) p.html = unlinkScheduled(p.html);
  await fsp.writeFile(path.join(DIST, 'blog.html'), listingPage(posts));
  for (const post of posts) await fsp.writeFile(path.join(DIST, 'blog', `${post.slug}.html`), postPage(post, posts));
  await fsp.writeFile(path.join(DIST, 'blog', 'rss.xml'), rss(posts));
  const landings = await loadLandingPages();
  for (const lp of landings) { lp.html = unlinkScheduled(lp.html); await fsp.writeFile(path.join(DIST, `${lp.slug}.html`), unlinkScheduled(landingPage(lp))); }
  await fsp.writeFile(path.join(DIST, 'sitemap.xml'), sitemap(posts, landings));
  const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8').trimEnd()
    + (landings.length ? '\n\n## Pages\n\n' + landings.map(l => `- [${l.data.h1}](${SITE}/${l.slug}): ${l.data.description}`).join('\n') : '')
    + '\n\n## Blog\n\n' + posts.filter(p => !p.draft).map(p => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.description}`).join('\n') + '\n';
  await fsp.writeFile(path.join(DIST, 'llms.txt'), llms);

  // Link the studio's third-party profiles (profiles.json) into every page's ProfessionalService schema.
  const profiles = Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles.json'), 'utf8')))
    .filter(([k, v]) => !k.startsWith('_') && /^https?:\/\//.test(v)).map(([, v]) => v);
  if (profiles.length) {
    for (const f of (await fsp.readdir(DIST)).filter(f => f.endsWith('.html'))) {
      const fp = path.join(DIST, f), html = await fsp.readFile(fp, 'utf8');
      if (html.includes('"@type":"ProfessionalService","name"') && !html.includes('"sameAs"'))
        await fsp.writeFile(fp, html.replace('"knowsAbout":', `"sameAs":${JSON.stringify(profiles)},"knowsAbout":`));
    }
  }

  // Tell Bing, Yandex and other IndexNow engines about every URL on production deploys.
  if (process.env.VERCEL_ENV === 'production') {
    const urlList = [...fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    try {
      const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: 'kloutkrew.in', key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList }) });
      console.log(`IndexNow: submitted ${urlList.length} URLs (HTTP ${r.status})`);
    } catch (e) { console.log(`IndexNow: skipped (${e.message})`); }
  }

  console.log(`Built ${posts.length} post(s)${INCLUDE_DRAFTS ? ' (drafts included)' : ''} and ${imageJobs.size} image(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(err => { console.error(`\n✖ Build failed: ${err.message}\n`); process.exit(1); });
