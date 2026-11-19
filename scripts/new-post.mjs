// npm run new-post -- "My post title"
// Creates content/blog/<slug>.md from the template plus an images folder for it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const title = process.argv.slice(2).join(' ').trim();
if (!title) { console.error('Usage: npm run new-post -- "My post title"'); process.exit(1); }
const slug = title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const file = path.join(ROOT, 'content', 'blog', `${slug}.md`);
if (fs.existsSync(file)) { console.error(`Already exists: content/blog/${slug}.md`); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
let tpl = fs.readFileSync(path.join(ROOT, 'content', 'blog', '_TEMPLATE.md'), 'utf8')
  .replace(/^# .*\n/gm, '')
  .replace('"Your headline here"', JSON.stringify(title))
  .replace(/date: \S+/, `date: ${today}`)
  .replaceAll('your-post-name', slug);
fs.writeFileSync(file, tpl);
fs.mkdirSync(path.join(ROOT, 'content', 'blog', 'images', slug), { recursive: true });
console.log(`Created content/blog/${slug}.md and content/blog/images/${slug}/`);
