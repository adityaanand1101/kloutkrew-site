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
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: post.title, description: post.description, image,
      datePublished: post.date.toISOString(), dateModified: (post.updated || post.date).toISOString(),
      author: { '@type': post.author === SITE_NAME ? 'Organization' : 'Person', name: post.author },
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

function landingPage(lp) {
  const d = lp.data, url = `${SITE}/${lp.slug}`;
  const faqs = Array.isArray(d.faqs) ? d.faqs : [];
  const faqHTML = faqs.length ? `<section class="kb-faq" aria-labelledby="faq-title"><div class="kb-narrow">
<h2 id="faq-title">Frequently asked questions</h2>
${faqs.map(f => `<details><summary>${esc(f.q)}</summary><div>${md.render(String(f.a))}</div></details>`).join('\n')}
</div></section>` : '';
  const content = `<main class="kb kb-article kb-landing">
<article>
<header class="kb-post-head"><div class="kb-narrow">
${d.eyebrow ? `<span class="kb-pill">${esc(d.eyebrow)}</span>` : ''}
<h1 class="kb-post-title">${esc(d.h1)}</h1>
<p class="kb-post-dek">${esc(d.description)}</p>
<p class="kb-landing-cta"><a href="/contact-us" class="kb-btn">Get a quote</a> <a href="/works" class="kb-link">See our work</a></p>
</div></header>
<div class="kb-post-body">
${lp.html}
</div>
</article>
${faqHTML}
${CTA}
</main>`;
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
  if (faqs.length) graph.push({ '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: String(f.a) } })) });
  const head = headHTML({ title: d.title, description: d.metaDescription || d.description, url, image: DEFAULT_OG,
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
  await fsp.writeFile(path.join(DIST, 'blog.html'), listingPage(posts));
  for (const post of posts) await fsp.writeFile(path.join(DIST, 'blog', `${post.slug}.html`), postPage(post, posts));
  await fsp.writeFile(path.join(DIST, 'blog', 'rss.xml'), rss(posts));
  const landings = await loadLandingPages();
  for (const lp of landings) await fsp.writeFile(path.join(DIST, `${lp.slug}.html`), landingPage(lp));
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
