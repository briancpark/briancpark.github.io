/* lattice.js — the about page's cell geometry, shared with the home page.
 *
 * The about background (matrix.js) draws a grid of five-character floats
 * riding a water surface. The home page's outro (transition.js) eases its
 * particles onto that exact grid before navigating, and the about page opens
 * on the same points, so the two pages have to agree — to the pixel — on
 * where every cell sits on its first frame. Everything that decides that
 * lives here: font, cell pitch, the swells and how far cells orbit on them.
 *
 * Classic script, loaded before matrix.js / transition.js. Deterministic on
 * purpose: no random(), no noise(), so both pages compute identical values.
 */

// Several of these are only read by the other scripts; eslint's config is
// module-mode, so it cannot see that and flags them, like the p5 entry points.
const LATTICE_FONT =
    '"SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
// eslint-disable-next-line no-unused-vars
const LATTICE_GROUP_CHARS = 5; // "-0.42"
const LATTICE_GROUP_PITCH = 6; // plus one separating space

// The swells. Each is a plane wave travelling along (kx, ky) in cell units;
// the mix of directions and wavelengths is what makes the surface read as
// water rather than a single ripple. Amplitudes sum to 1.
const LATTICE_SWELL = [
    {a: 0.35, kx: 0.30, ky: 0.05, w: 0.013, phi: 0}, // rightward
    {a: 0.25, kx: -0.18, ky: 0.22, w: 0.010, phi: 1.7}, // left and down
    {a: 0.22, kx: 0.05, ky: -0.28, w: 0.011, phi: 3.1}, // upward
    {a: 0.18, kx: -0.40, ky: -0.12, w: 0.018, phi: 0.6}, // short chop, left
];
// eslint-disable-next-line no-unused-vars
const LATTICE_SWAY_X = 1.4; // horizontal orbit radius, in cell widths
// eslint-disable-next-line no-unused-vars
const LATTICE_SWAY_Y = 0.5; // vertical, in row heights

// Visible-grid metrics for a w x h canvas: font size, cell width/height, how
// many value groups (visG) and rows (visR) fit, and the origin of that
// visible grid. `measure` must be a 2D context to measure text with.
function latticeMetrics(w, h, measure) {
    const fontSize = Math.min(16, Math.max(12, Math.round(w / 95)));
    measure.font = fontSize + 'px ' + LATTICE_FONT;
    const cw = measure.measureText('0').width;
    const ch = Math.round(fontSize * 1.45);
    const visG = Math.floor(w / (cw * LATTICE_GROUP_PITCH));
    const visR = Math.floor(h / ch);
    // The last group has no trailing space, hence the -1.
    const ox = (w - (visG * LATTICE_GROUP_PITCH - 1) * cw) / 2;
    const oy = (h - visR * ch) / 2;
    return {fontSize, cw, ch, visG, visR, ox, oy};
}

// Surface height (h) and its quadrature (g) at visible cell (c, r) and time
// t in frames: the cell orbits like a water particle, up/down on h and side
// to side on g. Writes into `out` to avoid allocating per cell.
function latticeSwell(c, r, t, out) {
    let h = 0;
    let g = 0;
    for (let k = 0; k < LATTICE_SWELL.length; k++) {
        const sw = LATTICE_SWELL[k];
        const th = sw.kx * c + sw.ky * r - sw.w * t + sw.phi;
        h += sw.a * Math.sin(th);
        g += sw.a * Math.cos(th);
    }
    out.h = h;
    out.g = g;
}
