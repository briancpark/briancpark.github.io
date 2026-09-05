/* transition.js — Seamless outros from the home page.
 *
 * The home page runs a Perlin flow-field particle animation (sketch.js). We
 * can't carry a live canvas across a page load, so instead the two ends meet
 * in the middle: clicking a nav link doesn't navigate right away. The
 * drifting particles peel off the flow field and ease onto whatever the
 * destination opens on, and the last frame this page paints is the frame the
 * next page starts from, so the jump reads as one continuous scene.
 *
 * Two destinations:
 *
 *  - "pintos": a DIFFERENT origin whose background.js opens on a Perlin
 *    triangle-mesh tessellation. Particles home onto the vertices of a grid
 *    built with the SAME spacing math Pintos uses while the wireframe fades
 *    in over them. Pintos itself is untouched.
 *  - "about": this site's about page, whose matrix.js opens on a field of
 *    green points, one per value cell, that unfold into numbers. Particles
 *    home onto those exact points (geometry from js/p5/lattice.js, shared
 *    with matrix.js) while their colour settles to the same green.
 *
 * Degrades to a plain navigation when the sketch isn't running (the other
 * pages) or the visitor prefers reduced motion. */
(function() {
    'use strict';

    // ~1.6s of converging at the sketch's ~60fps, then a short rest on the
    // finished mesh so the eye registers it before the page actually changes.
    const DURATION = 95;
    const HOLD = 14;

    const T = {
        active: false, frame: 0, href: null, mode: null, mesh: null,
        lattice: null, watchdog: 0,
    };
    // Green of the about page's field, in this sketch's HSB-255 space.
    const ABOUT_HUE = 125 / 360 * 255;

    // The outro navigates from inside render(), which only runs if the sketch's
    // draw() loop is calling us. If that loop is stalled, throttled, or belongs
    // to a stale cached sketch.js, the cancelled click would never be replaced
    // and the link would be dead. Poll for frame progress and, if the outro
    // hasn't advanced at all for this many consecutive checks, give up on the
    // animation and just navigate.
    const WATCHDOG_MS = 500;
    const WATCHDOG_STALLS = 3;

    // mulberry32 — a tiny deterministic PRNG. Pintos jitters its grid with
    // Math.random(); we seed instead so our mesh is stable frame-to-frame. An
    // exact vertex match across origins is impossible anyway, so we match the
    // *style*, which is what actually sells the cut.
    function makeRng(seed) {
        return function() {
            seed |= 0;
            seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Pintos' buildGrid() math, replicated so our vertices land where its mesh
    // lives: same spacing, same 2-cell overscan, same 0.8*spacing jitter that
    // throws vertices off-grid so it never reads as graph paper.
    function buildMesh(w, h) {
        const spacing = Math.max(46, Math.min(92, Math.floor(w / 22)));
        const cols = Math.ceil(w / spacing) + 4;
        const rows = Math.ceil(h / spacing) + 4;
        const rnd = makeRng(0x9e3779b9);

        const grid = [];
        const verts = [];
        for (let j = 0; j <= rows; j++) {
            grid[j] = [];
            for (let i = 0; i <= cols; i++) {
                const v = {
                    x: (i - 2) * spacing + (rnd() - 0.5) * spacing * 0.8,
                    y: (j - 2) * spacing + (rnd() - 0.5) * spacing * 0.8,
                    // Per-triangle hues, in this sketch's HSB-255 space.
                    hA: rnd() * 255,
                    hB: rnd() * 255,
                };
                grid[j][i] = v;
                verts.push(v);
            }
        }
        return {spacing, cols, rows, grid, verts};
    }

    // Home each particle to its nearest vertex. More particles than vertices is
    // wanted: the extras stack into a bright node sitting exactly on a mesh
    // corner, which is what makes the wireframe's joints glow.
    //
    // Runs synchronously inside the click handler, so it can't be the naive
    // particles x vertices scan: on a 5K display that's ~30k particles against
    // ~2.3k vertices, which stalls the tab for several hundred ms right as the
    // visitor clicks. Instead exploit the fact that vertex (i, j) sits near its
    // base position ((i-2)*spacing, (j-2)*spacing) and only ever strays by the
    // 0.4*spacing jitter: the nearest vertex to a point is therefore always
    // within 2 grid cells of that point's own cell, so 25 candidates suffice.
    // (A vertex k cells away is >= (k-0.9)*spacing off, and the nearest vertex
    // is always <= 1.27*spacing away, so k >= 3 can never win.)
    const SEARCH = 2;

    function assignTargets(mesh) {
        const g = mesh.grid;
        const sp = mesh.spacing;
        for (let p = 0; p < particles.length; p++) {
            const part = particles[p];
            const px = part.pos.x;
            const py = part.pos.y;
            const i0 = Math.round(px / sp) + 2;
            const j0 = Math.round(py / sp) + 2;

            const iLo = Math.max(0, i0 - SEARCH);
            const iHi = Math.min(mesh.cols, i0 + SEARCH);
            const jLo = Math.max(0, j0 - SEARCH);
            const jHi = Math.min(mesh.rows, j0 + SEARCH);

            let best = null;
            let bestD = Infinity;
            for (let j = jLo; j <= jHi; j++) {
                const row = g[j];
                for (let i = iLo; i <= iHi; i++) {
                    const dv = row[i];
                    const dx = dv.x - px;
                    const dy = dv.y - py;
                    const d = dx * dx + dy * dy;
                    if (d < bestD) {
                        bestD = d;
                        best = dv;
                    }
                }
            }
            part.tx = best ? best.x : px;
            part.ty = best ? best.y : py;
        }
    }

    // The about page's opening frame: one point per visible value cell, at
    // its swell-displaced position on that page's first draw (t = 1).
    function buildLattice(w, h) {
        const probe = document.createElement('canvas').getContext('2d');
        const m = latticeMetrics(w, h, probe);
        const sway = {h: 0, g: 0};
        const half = LATTICE_GROUP_CHARS * m.cw / 2;
        const pts = [];
        for (let r = 0; r < m.visR; r++) {
            const row = [];
            for (let c = 0; c < m.visG; c++) {
                latticeSwell(c, r, 1, sway);
                row.push({
                    x: m.ox + c * LATTICE_GROUP_PITCH * m.cw + half +
                        sway.g * m.cw * LATTICE_SWAY_X,
                    y: m.oy + r * m.ch + m.ch / 2 + sway.h * m.ch *
                        LATTICE_SWAY_Y,
                });
            }
            pts.push(row);
        }
        return {m, pts};
    }

    // Home each particle to its nearest lattice point. Cells only stray from
    // their base position by the swell (well under a cell pitch), so the
    // nearest point is always within one cell of the particle's own.
    function assignLatticeTargets(lat) {
        const m = lat.m;
        const pitchX = LATTICE_GROUP_PITCH * m.cw;
        for (let p = 0; p < particles.length; p++) {
            const part = particles[p];
            const px = part.pos.x;
            const py = part.pos.y;
            const c0 = Math.floor((px - m.ox) / pitchX);
            const r0 = Math.floor((py - m.oy) / m.ch);
            let best = null;
            let bestD = Infinity;
            for (let r = r0 - 1; r <= r0 + 1; r++) {
                if (r < 0 || r >= m.visR) continue;
                for (let c = c0 - 1; c <= c0 + 1; c++) {
                    if (c < 0 || c >= m.visG) continue;
                    const q = lat.pts[r][c];
                    const dx = q.x - px;
                    const dy = q.y - py;
                    const d = dx * dx + dy * dy;
                    if (d < bestD) {
                        bestD = d;
                        best = q;
                    }
                }
            }
            part.tx = best ? best.x : px;
            part.ty = best ? best.y : py;
        }
    }

    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // Called from sketch.js draw() while T.active. Reads the sketch's globals
    // (particles, globalHue) and uses p5's global-mode drawing functions.
    function render() {
        const t = Math.min(1, T.frame / DURATION);
        const e = easeInOutQuad(t);

        // Same trail-fade as the normal loop, so streaks linger then clear.
        background(0, 0, 0, 40);

        // Pull each particle toward its vertex. k ramps up: motion starts soft
        // (long rainbow streaks flying inward) and finishes crisp (settled
        // nodes that stop smearing). Bound for the about page, the rainbow
        // also settles onto that page's green.
        const k = 0.05 + e * 0.22;
        if (T.mode === 'about') {
            const w = Math.min(1, e * 1.4);
            stroke(globalHue + (ABOUT_HUE - globalHue) * w,
                255 - 55 * w, 255, 255);
        } else {
            stroke(globalHue, 255, 255, 255);
        }
        strokeWeight(2.5);
        for (let i = 0; i < particles.length; i++) {
            const part = particles[i];
            part.prevX = part.pos.x;
            part.prevY = part.pos.y;
            part.pos.x += (part.tx - part.pos.x) * k;
            part.pos.y += (part.ty - part.pos.y) * k;
            part.show();
        }
        globalHue = (globalHue + 1) % 256;

        if (T.mode === 'about') {
            // The rest: draw the destination's points themselves. As the
            // particles settle they stack onto these, and during the hold the
            // canvas is wiped so the exact opening frame of the about page
            // is what the visitor is looking at when it loads.
            if (T.frame >= DURATION) background(0);
            stroke(ABOUT_HUE, 200, 255, 255);
            strokeWeight(3);
            const pts = T.lattice.pts;
            for (let r = 0; r < pts.length; r++) {
                const row = pts[r];
                for (let c = 0; c < row.length; c++) {
                    point(row[c].x, row[c].y);
                }
            }
        } else if (e > 0.02) {
            // Fade the triangle wireframe in over the converging particles.
            noFill();
            strokeWeight(2.5);
            const g = T.mesh.grid;
            const bright = 30 + e * 90; // luminous, but not blinding
            const alpha = e * 0.6 * 255;
            for (let j = 0; j < T.mesh.rows; j++) {
                for (let c = 0; c < T.mesh.cols; c++) {
                    const a = g[j][c];
                    const b = g[j][c + 1];
                    const cc = g[j + 1][c];
                    const d = g[j + 1][c + 1];
                    stroke(a.hA, 230, bright, alpha);
                    triangle(a.x, a.y, b.x, b.y, cc.x, cc.y);
                    stroke(a.hB, 230, bright, alpha);
                    triangle(b.x, b.y, d.x, d.y, cc.x, cc.y);
                }
            }
        }

        T.frame++;
        if (T.frame >= DURATION + HOLD) {
            T.active = false; // stop rendering; we're navigating
            go();
        }
    }

    // Single exit point, so the watchdog and the finished outro can't both
    // fire the navigation.
    function go() {
        if (T.watchdog) {
            window.clearInterval(T.watchdog);
            T.watchdog = 0;
        }
        if (T.href) {
            const href = T.href;
            T.href = null;
            window.location.href = href;
        }
    }

    // Begin the outro and schedule the navigation. Falls back to an immediate
    // jump if the sketch globals aren't present.
    function arm(href, mode) {
        // Never cancel the click unless the running sketch can actually drive
        // the outro. window.SKETCH_HAS_PINTOS_HOOK is set by the sketch.js that
        // owns the draw() hook; a cached older build won't have it.
        if (typeof particles === 'undefined' || !particles.length ||
            typeof width === 'undefined' ||
            !window.SKETCH_HAS_PINTOS_HOOK) {
            window.location.href = href;
            return;
        }
        T.href = href;
        T.mode = mode;
        T.frame = 0;
        if (mode === 'about') {
            T.lattice = buildLattice(width, height);
            assignLatticeTargets(T.lattice);
        } else {
            T.mesh = buildMesh(width, height);
            assignTargets(T.mesh);
        }
        T.active = true;

        let seen = -1;
        let stalls = 0;
        T.watchdog = window.setInterval(function() {
            if (!T.active) return;
            if (T.frame === seen) {
                stalls++;
            } else {
                seen = T.frame;
                stalls = 0;
            }
            if (stalls >= WATCHDOG_STALLS) {
                T.active = false;
                go();
            }
        }, WATCHDOG_MS);

        // Dissolve the page chrome so only the canvas carries the transition.
        // The nav stays when heading to the about page: it has the same nav,
        // so it is part of the continuity.
        const fade = (el) => {
            if (!el) return;
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
        };
        fade(document.getElementById('quote'));
        if (mode !== 'about') fade(document.querySelector('nav'));
        // ...and, for about, bring in that page's footer ahead of time.
        if (mode === 'about') {
            const foot = document.querySelector('.outro-footer');
            if (foot) foot.classList.add('show');
        }
    }

    function wire() {
        const reduce = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const hook = (selector, mode) => {
            document.querySelectorAll(selector).forEach((a) => {
                a.addEventListener('click', (ev) => {
                    // Let the browser own modified / new-tab / non-primary
                    // clicks.
                    if (reduce || ev.metaKey || ev.ctrlKey || ev.shiftKey ||
                        ev.button !== 0 || a.target === '_blank') {
                        return;
                    }
                    ev.preventDefault();
                    arm(a.href, mode);
                });
            });
        };
        hook('a[href*="pintos-html"]', 'pintos');
        // Only if the lattice geometry is loaded; otherwise a plain link.
        if (typeof latticeMetrics === 'function') {
            hook('nav a[href$="about.html"]', 'about');
        }
    }

    T.render = render;
    window.PintosTransition = T;

    if (document.readyState !== 'loading') wire();
    else document.addEventListener('DOMContentLoaded', wire);
})();
