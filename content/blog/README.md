# Writing for the KloutKrew blog

Every `.md` file in this folder becomes a post at `kloutkrew.in/blog/<file-name>`.
Push to GitHub and Vercel rebuilds the site; the post is live in about a minute.

## New post

1. Copy `_TEMPLATE.md` and rename it, e.g. `brand-colours-that-sell.md`
   (or run `npm run new-post -- "Brand colours that sell"`, which does this for you).
2. Fill in the block at the top (title, description, date, category).
3. Put images in `images/brand-colours-that-sell/` and reference them like
   `![What the image shows](./images/brand-colours-that-sell/photo.jpg "Optional caption")`.
4. Leave `draft: true` while you're writing — drafts appear on Vercel preview links
   but not on kloutkrew.in. Set it to `false` to publish.

`how-to-publish-a-blog-post.md` is a full example of every formatting option
(images, wide/full-width images, galleries, quotes, callouts, tables, video embeds).

## Images

Upload the largest, sharpest original you have (JPG, PNG, WebP, GIF or SVG).
The build creates AVIF and WebP copies at several sizes, sets dimensions so the page
doesn't jump while loading, lazy-loads anything below the fold, and makes a
1200×630 preview for LinkedIn/WhatsApp from the cover image.

| Markdown | Result |
|---|---|
| `![alt](./images/x.jpg)` | Image in the text column |
| `![alt](./images/x.jpg "Caption")` | With a caption |
| `![alt](./images/x.jpg){.wide}` | Breaks out wider than the text |
| `![alt](./images/x.jpg){.full}` | Edge to edge |
| `::: gallery` … `:::` | Images side by side |

## Front matter fields

| Field | Required | Notes |
|---|---|---|
| `title` | yes | |
| `description` | yes | 1–2 sentences; used on the blog page, Google and link previews |
| `date` | yes | `YYYY-MM-DD`; newest first |
| `category` | no | Becomes a filter chip on the blog page |
| `author` | no | Defaults to KloutKrew Studio |
| `cover` / `coverAlt` | no | Without a cover, a branded cover is generated |
| `tags` | no | `["branding", "design"]` |
| `featured` | no | `true` puts the post in the big slot on the blog page |
| `draft` | no | `true` hides it from the live site |
| `updated` | no | `YYYY-MM-DD` if you revise a post later |

## Preview on your computer

```bash
npm install
npm run dev      # builds with drafts and serves at http://localhost:3000
```

Files starting with `_` (like `_TEMPLATE.md`) and this README are never published.
