/* transition.js — Seamless outro into the Pintos site.
 *
 * The home page runs a Perlin flow-field particle animation (sketch.js). The
 * Pintos site — a DIFFERENT origin — opens on a Perlin *triangle-mesh*
 * tessellation (its own background.js). We can't carry a live canvas across
 * the page load, so instead the two ends meet in the middle: clicking the
 * "pintos" tab doesn't navigate right away. The drifting particles peel off
 * the flow field and ease onto the vertices of a triangle grid built with the
 * SAME spacing math Pintos uses, while the triangle wireframe fades in over
 * them. The last frame this page paints — a rainbow mesh on black — is the
 * frame Pintos opens on, so the cross-site jump reads as one continuous scene.
 *
 * Lives entirely on this site; Pintos is untouched. Degrades to a plain
 * navigation when the sketch isn't running (the other pages) or the visitor
 * prefers reduced motion. */
(function() {
    'use strict';

    // ~1.6s of converging at the sketch's ~60fps, then a short rest on the
    // finished mesh so the eye registers it before the page actually changes.
    const DURATION = 95;
    const HOLD = 14;

    const T = {active: false, frame: 0, href: null, mesh: null};

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
    function assignTargets(mesh) {
        for (let p = 0; p < particles.length; p++) {
            const part = particles[p];
            let best = null;
            let bestD = Infinity;
            for (let v = 0; v < mesh.verts.length; v++) {
                const dv = mesh.verts[v];
                const dx = dv.x - part.pos.x;
                const dy = dv.y - part.pos.y;
                const d = dx * dx + dy * dy;
                if (d < bestD) {
                    bestD = d;
                    best = dv;
                }
            }
            part.tx = best ? best.x : part.pos.x;
            part.ty = best ? best.y : part.pos.y;
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
        // nodes that stop smearing).
        const k = 0.05 + e * 0.22;
        stroke(globalHue, 255, 255, 255);
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

        // Fade the triangle wireframe in over the converging particles.
        if (e > 0.02) {
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
            window.location.href = T.href;
        }
    }

    // Begin the outro and schedule the navigation. Falls back to an immediate
    // jump if the sketch globals aren't present.
    function arm(href) {
        if (typeof particles === 'undefined' || !particles.length ||
            typeof width === 'undefined') {
            window.location.href = href;
            return;
        }
        T.href = href;
        T.frame = 0;
        T.mesh = buildMesh(width, height);
        assignTargets(T.mesh);
        T.active = true;

        // Dissolve the page chrome so only the canvas carries the transition.
        const fade = (el) => {
            if (!el) return;
            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
        };
        fade(document.getElementById('quote'));
        fade(document.querySelector('nav'));
    }

    function wire() {
        const reduce = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const links = document.querySelectorAll('a[href*="pintos-html"]');
        links.forEach((a) => {
            a.addEventListener('click', (ev) => {
                // Let the browser own modified / new-tab / non-primary clicks.
                if (reduce || ev.metaKey || ev.ctrlKey || ev.shiftKey ||
                    ev.button !== 0 || a.target === '_blank') {
                    return;
                }
                ev.preventDefault();
                arm(a.href);
            });
        });
    }

    T.render = render;
    window.PintosTransition = T;

    if (document.readyState !== 'loading') wire();
    else document.addEventListener('DOMContentLoaded', wire);
})();
