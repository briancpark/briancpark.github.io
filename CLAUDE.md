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

So: **after editing any file under `js/`, bump `?v=` in both `index.html` and
`404.html`.** `p5.min.js` is exempt only because its filename is already
versioned by content. If this becomes tiresome, content-hashed filenames or a
tiny build step would automate it.

## p5.js sketch

The animation is a Perlin flow field. `index.html` and `404.html` load it;
`about.html` and `academia.html` do not.

```
js/p5/p5.min.js     vendored p5 v1.0.0, minified
js/p5/sketch.js     setup/draw, flow field, pointer reactivity
js/p5/particle.js   Particle constructor
js/p5/transition.js the "pintos" outro (index.html only)
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

## The pintos transition

Clicking "pintos" on `index.html` does not navigate immediately.
`transition.js` cancels the click and eases the particles onto a triangle mesh
matching the one the Pintos site opens on, so the cross-origin jump reads as one
continuous scene. It navigates from inside `render()`.

Cancelling a navigation and owing the user a replacement is the risky part, so
there are two independent guards. Do not remove either:

1. `sketch.js` sets `window.SKETCH_HAS_PINTOS_HOOK`. `arm()` refuses to cancel
   the click unless it is present, so an older cached `sketch.js` falls through
   to a plain navigation.
2. A watchdog polls for frame progress and navigates anyway after ~1.5 s of no
   advance, covering a render loop stalled for any other reason.

Both exit through `go()`, which clears the timer so they cannot double-fire.
Other pages link to pintos without loading `transition.js`; that degrades to a
normal link, which is intended.

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
           js/p5/particle.js js/p5/transition.js
```

Lint explicitly — never `npx eslint js/`, which would try to parse the vendored
`p5.min.js`.

**The repo is not lint-clean and never has been.** Expect ~20 pre-existing
errors, all `require-jsdoc` (the Google config wants JSDoc on everything; this
codebase has none) and `no-unused-vars` on the p5 entry points described above.
Both are config mismatches rather than defects. Judge a change by whether it
*adds* errors, not by whether the run is green. Do not mass-add JSDoc to make it
pass unless asked.

## Pages and CSS

| Page | CSS beyond `main.css` + `navbar.css` |
| --- | --- |
| `index.html` | `home.css` |
| `404.html` | `home.css` |
| `about.html` | `about.css`, `footer.css` |
| `academia.html` | `academia.css`, `footer.css` |

The nav markup is duplicated in all four pages — currently `about` and `pintos`,
with a page's own link written as `#` where one exists. **Editing the nav means
editing four files** — grep to be sure you caught them all. `404.html` also
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
