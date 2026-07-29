# KLOUTKREW AI Studio — Design Guideline

A working design system distilled from the live site (`index.html`, `About Us.html`,
`contact-us.html`) and the compiled Webflow stylesheet. This is the reference I used to
build `about.html` and `services.html` so they feel native to the brand while pushing the
craft further.

---

## 1. Brand personality

KLOUTKREW is an **AI-first creative agency**. The visual language is:

- **Editorial & oversized** — Bebas Neue set at viewport scale (up to 19vw). Type *is* the layout.
- **Dark, cinematic, video-forward** — black canvases, autoplaying brand-film reels, muted-by-default with a click-to-unmute control.
- **Warm-but-bold** — a cream ("linen") counter-tone breaks the black; vivid red/orange/yellow inject energy; pastel "pills" tag sections.
- **Kinetic** — Lenis smooth scroll, GSAP ScrollTrigger pinning, SplitText headline reveals, marquee tickers, sticky storytelling, mask-swipe button hovers.

Adjectives to design against: *scroll-stopping, niched, powerhouse, immersive, precise.*

---

## 2. Color

| Token | Value | Use |
|---|---|---|
| `--black-primary` | `#000000` | Primary canvas |
| `--black-secondary` | `#121212` | Raised surfaces, borders, cards on black |
| `--gray` | `#383838` | Muted text, hairlines |
| `--linen` | `#e9dcd2` | Light "relief" sections, alt background (`#f9ebe4` warmer variant) |
| `--white` | `#ffffff` | Text on dark |
| `--vivid-red` | `#ee1515` (active `#d10000`) | Primary accent, emphasis, gradients |
| `--vivid-orange` | `#ff691e` | Secondary accent, gradient partner |
| `--yellow` | `#fdbc53` | Tertiary accent / highlights |

**Pastel pill palette** (section tags, floating labels, work-card tints):
`#DCA8FF` `#B7FF93` `#F8A7FF` `#FFD37A` `#FFA5A6` `#ab9bff` `#ff905f` `#ff767a` `#b8c56f`

**Signature gradient:** `linear-gradient(90deg, #ff691e, #ee1515)` (orange→red) — used for `text_gradiant` and accent sweeps.

Rules of thumb:
- Default to black canvas + white type. Use **one** cream relief section per 2–3 dark sections for rhythm.
- Accent color is a *spice*, never a fill for big areas. Red/orange for one to two elements per viewport.
- Pastels only at small scale (pills, tags, tiny cards).

---

## 3. Typography

- **Display / headings:** `Bebas Neue` (`Bebasneue`), Arial fallback. UPPERCASE, tight tracking (`-0.02em`/`-0.03em`), line-height `0.8–1`. This is the hero of every layout.
- **Body / UI:** `DM Sans`, Arial fallback. Sentence or normal case, line-height `1.4–1.5`.

Type scale (fluid `clamp`, real tokens):

| Role | Size |
|---|---|
| h1 | `19vw` |
| h2 | `clamp(3.75rem, …, 20rem)` |
| h3 | `clamp(2.75rem, …, 8rem)` |
| h4 | `clamp(2rem, …, 5.25rem)` |
| h5 | `clamp(1.75rem, …, 2.625rem)` |
| body | 14 / 16 / 18 / 20 / 24 / 30 px steps |

Signature text treatments:
- `// KLOUTKREW AI` logo lockup (Bebas, the `//` is part of the mark).
- `Inside (the) KLOUTKREW AI` **section caption** — small dot + label, `(the)` in italic.
- Gradient word inside an otherwise plain heading (`Trusted by <Leaders>`).
- Stroke-outline headline rows alternating with solid in CTA tickers.

---

## 4. Layout & spacing

- **Container:** max `1680px`, global side padding `5%`.
- **Section padding:** ~`150px` vertical on desktop (`padding_global` wrapper → `container`).
- **Radii:** sm `20`, md `30`, lg `40`, xl `100`, pill `999`. Cards and video frames are generously rounded (`40px`+).
- **Border motif:** the 5-line animated `border` divider (`border_line`) between major sections — colored per adjacent section (`#e9dcd2`, `#121212`, `#000`).
- Grids: halftone **dot/box grid** (`brands_grid`) as texture; asymmetric 2-col headers (title left, pattern/label right).

---

## 5. Signature components & motifs

1. **Section caption** — `● Inside (the) KLOUTKREW AI` eyebrow above section titles.
2. **Floating pill label** — pastel rounded tag that floats near section headers (`5 STAR SERVICES`, `DIGITAL SCREENS`).
3. **Mask-swipe primary button** — text duplicated; on hover a line-mask wipes and the second label rises. Circle-dot on nav links animates on hover.
4. **Sticky-scroll storytelling** — pinned track where inner content translates (year timeline, why-choose cards). Core to the "immersive" feel.
5. **Marquee tickers** — infinite horizontal rows (`brands_ticker`, `cta_ticker`), some solid / some stroked outline text.
6. **Video reels** — rounded, object-fit cover, autoplay+loop+muted, circular unmute button bottom-right (`rgba(0,0,0,.55)`).
7. **Counter columns** — digit reels that roll to a number (`stats_counter`).
8. **Halftone dot grid** — square-dot SVG used as texture in hero stat + tickers.
9. **Preloader** — `// KLOUTKREW AI` over animated 5-line border wipe.

---

## 6. Motion principles

- **Smooth scroll** everywhere: Lenis (`lerp 0.1`). All scroll-driven work assumes it.
- **Reveal on enter:** headlines split into chars/lines (GSAP SplitText) and rise+fade; body text fades word/line.
- **Pin + progress:** big narrative sections pin and drive an inner transform (horizontal scroll, timeline, card stack).
- **Hover = intent:** mask wipes, dot fills, image/video previews, subtle scale (`1.02`) and tilt.
- **Easing:** expressive ease-out (`power3.out` / `expo.out`), durations `0.6–1.2s`. Respect `prefers-reduced-motion`.
- Keep it purposeful — motion guides the eye down the page; never more than one "hero" motion per viewport.

---

## 7. Applying this to About / Services / Works

**Non-negotiable rule: reuse the real thing.** Every new page is assembled from the *actual*
Webflow shell and components so it is indistinguishable from `index.html` / `About Us.html`:

- **Same `<head>`** — the compiled `ariyana-studio.webflow.shared…css`, Bebas/DM Sans, Lenis, and the
  same jQuery + Webflow + GSAP script tail (so nav, canvas menu, buttons and section IX behave natively).
- **Same navbar** — `.navigation.is-secondary` (dark-on-light) with the `// KLOUTKREW AI` mark,
  `nav_link` dot-swap links and the hamburger → `canvas_menu` overlay.
- **Same footer, CTA ticker (`cta_section`) and 5-line `border` dividers.**
- **Same light hero** — `about_hero_section` with the orange `hero_circle_secondary`, `section_caption`
  eyebrow and the client-rating block.
- **Same body components** — `service_section` + `step_section` for Services; `work_section` for Works;
  the About page keeps the canonical hero → stats counters → why-choose sticky → team → life → CTA flow.

Content and copy are tailored per page (captions, headline, tags), but the **chrome, type, colour,
background and interactions are the site's own** — never a parallel design system. When a page needs a
new block, build it from existing classes (`section_caption`, `floating_text` pill, `button_primary`,
`heading_style_h4`, video reels) so it inherits the brand automatically.

Pages: `about.html`, `services.html`, `works.html` (friendly routes `/about`, `/service`, `/projects`
also resolve). All nav/footer links across `index.html` and `contact-us.html` were repointed to them.
