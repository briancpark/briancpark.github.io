# CLAUDE.md

Personal website for Brian Park — hand-written static HTML/CSS/JS. No
framework, no bundler, no build step. What is in the repo is what ships.

## Deploying

GitHub Pages serves `master` directly. **Pushing to `master` is deploying.**
There is no CI, no staging, and no PR gate. `CNAME` points the site at
`www.briancpark.com`, fronted by Cloudflare.

Serve locally with any static file server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Note that extensionless URLs (`/academia`) resolve only on GitHub Pages. Locally
you must request `/academia.html`.

## Bump `?v=` when you edit same-origin JS

`index.html` and `404.html` load scripts with a version query:

```html
<script src="js/p5/sketch.js?v=20260808"></script>
```

This is load-bearing, not decoration. Pages serves HTML with `max-age=600` but
JS with `max-age=14400` — the code is cached **24x longer than the HTML that
references it**. Without a version query, every deploy opens a ~4 hour window in
which visitors run fresh HTML against stale JS. That exact mismatch once left the
"pintos" link permanently dead: `transition.js` cancelled the click and then
waited forever for a `draw()` hook that the cached `sketch.js` didn't have.

So: **after editing any file under `js/`, bump `?v=` in `index.html`,
`404.html`, and `about.html`.** `about.html` loads `matrix.js` from an inline
loader in `<head>` rather than a `<script src>` tag, so grep for `?v=` rather
than for `<script`. `p5.min.js` is exempt only because its filename is already
versioned by content. If this becomes tiresome, content-hashed filenames or a
tiny build step would automate it.

## p5.js sketches

There are two. The home animation is a Perlin flow field, loaded by
`index.html` and `404.html`. The about page runs a separate sketch, the float
matrix, loaded by `about.html` only. `academia.html` loads neither.

```
js/p5/p5.min.js     vendored p5 v1.0.0, minified
js/p5/sketch.js     home: setup/draw, flow field, pointer reactivity
js/p5/particle.js   home: Particle constructor
js/p5/lattice.js    both: the about grid's geometry + swells (see below)
js/p5/transition.js home: the "pintos" and "about" outros (index.html only)
js/p5/matrix.js     about: float matrix that decodes into the page text
```

Things that will bite you:

- **p5 runs in global mode.** `setup`, `draw`, `windowResized`, and `Particle`
  are never called from this codebase — p5 invokes them off `window`. eslint
  reports them as unused. Those warnings are wrong; leave them.
- **Top-level `let`/`const` in `sketch.js` are shared across scripts** but are
  *not* on `window`. They live in the global lexical environment, which classic
  scripts share. `particle.js` and `transition.js` read `scl`, `cols`, `rows`,
  `particles`, and `globalHue` this way. Converting any script to a module, or
  adding `defer` unevenly, breaks that sharing.
- **Never re-add `p5.sound.js` or the unminified `p5.js`.** Both were removed
  deliberately. Nothing calls a p5.sound API, and it was the single most
  expensive script to evaluate at load because it builds an AudioContext up
  front. The dev build of p5 is 4.4 MB against 623 KB minified; together they
  were roughly 85% of page weight.
- **Particle count scales with window *area*** — one per 500px², capped by
  `MAX_PARTICLES` in `sketch.js`. Uncapped, a 5K display asks for ~30k particles
  and pays for all of them every frame. Raising the cap trades frame rate for
  density on large monitors.

Rough budget on a 16" MBP at 2x: ~3,200 particles, 8.3 ms/frame steady state,
of which ~2.6 ms is JS. There is headroom, but not a lot.

## The about-page matrix

`about.html` draws a full-screen grid of two-decimal floats, cmatrix-style,
sampled like model weights (Gaussian around zero). The grid rides a sum of
travelling swells so cells orbit like water particles and rows drift out of
line; crests are lit, troughs dimmer but never empty. Activation sweeps run over that in all
four directions (columns green, rows yellow-green) with a bright head and
fading trail. Periodic "matmul" events select a whole row and column, sweep
a head along each, and flash the intersecting cell as the output; half of
them aim at still-encoded prose, and a hit decodes that whole line of text.
The prose is laid onto the same (undisplaced) character grid. The pointer
paints the site's cycling hue into the field, and click-and-drag pulls the
sheet around with a spring-back on release. Prose
cells look like digits until the pointer comes near, then scramble into
letters and stay decoded. Moving the pointer into a paragraph's hitbox (or
tapping it) decodes all of it, blacks out the digits behind it and sets it
bold; Enter decodes everything.

- **The copy lives in `<main>`, not in the JS.** `matrix.js` reads every
  `h6`/`p` inside `main` on load, so edit text in the HTML. `<main>` is only
  hidden visually (`.matrix main` in `about.css`, the visually-hidden recipe)
  and stays in the accessibility tree; the canvas is `aria-hidden`.
- **The opt-in lives in an inline `<head>` script.** It adds `html.matrix`
  and injects `p5.min.js` + `lattice.js` + `matrix.js` in order. It runs in `<head>` so the
  prose is hidden before first paint. Under `prefers-reduced-motion: reduce`
  it does nothing: no class, no p5 download, plain page.
- **It bails to the plain page if the text cannot fit.** `layoutText()`
  needs the wrapped prose to fit between the nav and footer; on short screens
  it first grows the canvas taller than the viewport (the page then scrolls,
  with `body` min-height pushing the footer down) and only gives up if the
  grid is too narrow. `bail()` removes the class and the canvas.
- **Glyphs go through `drawingContext`, not p5 `text()`**, and idle digits
  are batched into one `fillText` per row. Do not "simplify" this back to
  per-cell `text()` calls; that is roughly 10k calls a frame.
- `about.html` now has a `<meta name="viewport">` (it never did before). The
  grid was unusable at the 980px fallback layout width on phones.

## The nav transitions (pintos and about)

Clicking "pintos" or "about" on `index.html` does not navigate immediately.
`transition.js` cancels the click and eases the particles onto whatever the
destination opens on, so the jump reads as one continuous scene. It navigates
from inside `render()`. Two modes:

- **pintos**: a triangle mesh matching the one the (cross-origin) Pintos site
  opens on; the wireframe fades in over the settling particles.
- **about**: the about page's field of green points, one per value cell. The
  particles settle onto those points and their colour settles to the same
  green; the final frames wipe the canvas and draw only the points. The about
  page then opens on exactly that frame and each point unfolds into its number
  (`UNFOLD_FRAMES` in `matrix.js`). The nav is kept (both pages have it) and
  a copy of the about footer (`.outro-footer` in `index.html`, fixed to the
  viewport bottom, hidden below the edge) slides up during the outro so it is
  already in place when about loads.

**Both pages must agree on cell positions to the pixel**, so the geometry —
font stack, cell pitch, the swells and how far cells orbit on them — lives in
`js/p5/lattice.js`, loaded by both `index.html` and `about.html` before the
script that uses it. `lattice.js` is deliberately deterministic (no `random()`,
no `noise()`). If you change the about grid's look, change it there, not in
`matrix.js`, or the outro will land the particles somewhere else. The outro
computes positions for the visible grid at t=1, which is the about page's
first draw; the about page's grid also carries overscan for dragging, which is
why `matrix.js` indexes the swell relative to the visible grid.

Cancelling a navigation and owing the user a replacement is the risky part, so
there are two independent guards, shared by both modes. Do not remove either:

1. `sketch.js` sets `window.SKETCH_HAS_PINTOS_HOOK`. `arm()` refuses to cancel
   the click unless it is present, so an older cached `sketch.js` falls through
   to a plain navigation.
2. A watchdog polls for frame progress and navigates anyway after ~1.5 s of no
   advance, covering a render loop stalled for any other reason.

Both exit through `go()`, which clears the timer so they cannot double-fire.
Other pages link to pintos and about without loading `transition.js`; that
degrades to a normal link, which is intended. The about hook is only wired if
`lattice.js` actually loaded.

## academia.html is deliberately unlisted

The page is reachable at `/academia` but appears in no nav, and `robots.txt`
disallows it. This is intentional — do not "fix" the missing nav link.

`Disallow` blocks crawling, not indexing. If the page needs to leave search
results entirely, that requires `<meta name="robots" content="noindex">`, which
in turn requires *removing* the robots.txt rule, since a blocked crawler can
never read the tag.

## Linting

```sh
npx eslint js/inspiration.js js/navigation.js js/p5/sketch.js \
           js/p5/particle.js js/p5/lattice.js js/p5/transition.js \
           js/p5/matrix.js
```

Lint explicitly — never `npx eslint js/`, which would try to parse the vendored
`p5.min.js`.

**The repo is not lint-clean and never has been.** Expect ~50 pre-existing
errors, all `require-jsdoc` (the Google config wants JSDoc on everything; this
codebase has none) and `no-unused-vars` on the p5 entry points described above
and on `lattice.js` globals that only other scripts read.
Both are config mismatches rather than defects. Judge a change by whether it
*adds* errors, not by whether the run is green. Do not mass-add JSDoc to make it
pass unless asked.

## Pages and CSS

| Page | CSS beyond `main.css` + `navbar.css` |
| --- | --- |
| `index.html` | `home.css`, `footer.css` (for `.outro-footer`) |
| `404.html` | `home.css` |
| `about.html` | `about.css`, `footer.css` (+ `js/p5/matrix.js`, see above) |
| `academia.html` | `academia.css`, `footer.css` |

The nav markup is duplicated in all four pages — currently `about` and `pintos`,
with a page's own link written as `#` where one exists. **Editing the nav means
editing four files** — grep to be sure you caught them all. The footer markup
is in `about.html`, `academia.html` and (as the decorative `.outro-footer`)
`index.html`; keep the first and last identical or the about outro's final
frame will not match the about page. `404.html` also
carries a commented-out `projects` link; it is inert, so ignore it when
grepping.

`js/inspiration.js` drives the rotating typed quote via `typed.min.js`. Two
entries compute live day counts from fixed start dates. Its MutationObserver
also pulses particles per typed character by calling `addParticles` /
`removeParticles` in `sketch.js`, so those two files are coupled.

## Dependencies

`package.json` carries eslint only. Nothing in `node_modules` ships to visitors,
so `npm audit` findings are dev-tooling only — confirm with
`npm audit --omit=dev`, which should report zero.
