/* matrix.js — the about page's background.
 *
 * cmatrix, but with a weight matrix floating on water. A screen-filling grid
 * of two-decimal floats on a monospace character grid. The grid rides a sum
 * of swells travelling in different directions: each cell moves in a small
 * orbit, so rows and columns drift loosely out of line like a blanket, crests
 * light up and troughs go dark. Activation sweeps run over that in all four
 * directions — down or up a column, across a row either way — each with a
 * bright head and a fading trail that re-rolls the values it passes. Every
 * so often a matmul fires: one row and one column light up, a head sweeps
 * along each, and the cell where they cross accumulates and flashes as the
 * output. The cells around the pointer light up, churn, and raise ripples.
 * The page's prose is laid out on the SAME grid: those cells look like any
 * other digits until the pointer nears them, at which point they scramble and
 * settle into the real characters — and stay decoded, so the paragraph can be
 * read once it has been swept.
 *
 * The prose itself lives in <main> (see about.html). It stays in the DOM for
 * screen readers and search engines and is only hidden visually while this
 * sketch runs; this file reads it, so editing the copy means editing the HTML.
 * If the text cannot fit the grid (very small viewports) the sketch removes
 * itself and the plain DOM page shows instead.
 *
 * p5 runs in global mode: setup/draw/windowResized/mousePressed/keyPressed are
 * invoked by p5 off `window`. Glyphs are drawn through the raw 2D context
 * (`drawingContext`) rather than p5's text(), which is markedly cheaper per
 * call; only cells that land off-canvas are skipped.
 */

// Cell geometry, the swells and the font are shared with the home page's
// outro through js/p5/lattice.js, which must be loaded first.
const FONT = LATTICE_FONT;
const GROUP_CHARS = LATTICE_GROUP_CHARS;
const GROUP_PITCH = LATTICE_GROUP_PITCH;
const SWAY_X = LATTICE_SWAY_X;
const SWAY_Y = LATTICE_SWAY_Y;
// The page opens on a field of green points — the frame the home page's
// outro navigates on — and each point unfolds outward into its number over
// this many frames.
const UNFOLD_FRAMES = 40;
const MAX_LINE = 64; // widest prose line, in cells
const INTRO_FRAMES = 110; // rain falls for this long before the heading decodes
const SCRAMBLE = '0123456789.-+';
// Palette. Column activations are cmatrix green, row activations a teal so
// the two operands of a matmul read differently. Trail brightness is
// quantised so the hot path reuses strings instead of formatting a colour
// per cell per frame.
const RAIN_HUE = 125;
const HUES = [125, 95, 170]; // 0: column sweep, 1: row sweep, 2: water
const TRAIL = HUES.map((h) => {
    const t = [];
    for (let i = 0; i < 16; i++) {
        t.push('hsl(' + h + ',100%,' + Math.round(10 + (38 * i) / 15) + '%)');
    }
    return t;
});
const HEAD = 'hsl(' + RAIN_HUE + ',60%,92%)';

// Click-and-drag pulls the sheet: cells near the grab point follow the
// pointer with a smooth falloff, and the whole thing springs back on release.
const grab = {active: false, x: 0, y: 0, ox: 0, oy: 0, vx: 0, vy: 0};
const PULL_MAX = 200; // px the grab point can be displaced, asymptotically
// Matmul events: how long the two heads take to sweep their row and column,
// how long the finished output cell holds, and how long it fades.
const MM_HOLD = 30;
const MM_FADE = 40;
const COLOR_TEXT = '#f2f2f2';
const COLOR_ACCENT = '#adff2f'; // greenyellow, matches `a` in about.css

let ctx;
let ready = false;
let fontSize; let cw; let ch;
let cols; let rows; let ox; let oy;
let visCols; // columns actually on screen; the rest is overscan
let padG; let padR; // overscan groups / rows on each side
const swell = {h: 0, g: 0}; // scratch for latticeSwell()
let unfoldStart = 0;
let groupsPerRow;
let groups = [];
let waves = [];
let events = [];
let nextEvent = 0;
let bright; // per-cell activation, 0..1, rebuilt every frame
let tint; // per-cell HUES index that owns the activation
let cells = [];
let cellAt = [];
let blocks = [];
let rowBlocks = [];
// Decoded characters, keyed by their index in the prose, so a relayout on
// resize keeps what the visitor has already read.
const revealedIdx = new Set();
let hue = 0;
let intro = true;
let introEnd = 0;
let hoverHref = null;

const pointer = {
    x: -9999,
    y: -9999,
    active: false,
    mouseSeen: false,
    touch: false,
};

function setup() {
    // about.html only adds this class when motion is allowed; without it
    // the plain DOM page is the whole experience.
    if (!document.documentElement.classList.contains('matrix')) {
        noCanvas();
        noLoop();
        return;
    }
    const c = createCanvas(windowWidth, windowHeight);
    c.position(0, 0);
    c.style('z-index', '-1');
    c.attribute('aria-hidden', 'true');
    ctx = drawingContext;

    if (!relayout()) {
        bail();
        return;
    }
    introEnd = frameCount + INTRO_FRAMES;
    unfoldStart = frameCount;
    ready = true;

    // Only real mouse movement counts as a pointer — mobile browsers fire a
    // synthetic mousemove after a tap that would otherwise pin the highlight.
    if (window.PointerEvent) {
        window.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') pointer.mouseSeen = true;
        }, {passive: true});
    } else {
        window.addEventListener('mousemove', () => {
            pointer.mouseSeen = true;
        });
    }
}

// Size the canvas and lay the prose onto it. The canvas normally fills the
// viewport, but on a short screen (phones) the copy will not fit between the
// nav and the footer, so the canvas grows to the height the text needs and
// the page scrolls — the body's min-height pushes the footer below it.
function relayout() {
    let h = windowHeight;
    resizeCanvas(windowWidth, h);
    buildGrid();
    let r = layoutText();
    if (typeof r === 'number') {
        h = ceil(r);
        resizeCanvas(windowWidth, h);
        buildGrid();
        r = layoutText();
    }
    document.body.style.minHeight = h > windowHeight ? h + 'px' : '';
    return r === true;
}

// Give up on the sketch and hand the page back to the DOM.
function bail() {
    ready = false;
    document.documentElement.classList.remove('matrix');
    document.body.style.cursor = '';
    document.body.style.minHeight = '';
    noLoop();
    if (canvas) canvas.remove();
}

function setFont() {
    ctx.font = fontSize + 'px ' + FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
}

function fmt(v) {
    return (v < 0 ? '-' : ' ') + Math.abs(v).toFixed(2);
}

// Values are meant to read as a slice of a model's weight matrix, so sample
// them the way trained weights actually fall: a bell curve around zero, most
// of them small, the odd outlier. (Box-Muller, clamped to the cell width.)
function randWeight() {
    const u = 1 - random();
    const v = random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return constrain(z * 0.35, -0.99, 0.99);
}

function buildGrid() {
    const m = latticeMetrics(width, height, ctx);
    fontSize = m.fontSize;
    cw = m.cw;
    ch = m.ch;
    setFont();

    // Overscan: the grid extends past every edge of the canvas by more than
    // the sheet can be dragged, so pulling it never exposes a border. Cells
    // that land off-canvas are skipped at draw time.
    const margin = PULL_MAX + 3 * ch;
    padG = ceil(margin / (cw * GROUP_PITCH));
    padR = ceil(margin / ch);
    groupsPerRow = m.visG + 2 * padG;
    // The last group has no trailing space, so the grid is one cell narrower
    // than pitch * groups.
    cols = groupsPerRow * GROUP_PITCH - 1;
    visCols = m.visG * GROUP_PITCH - 1;
    rows = m.visR + 2 * padR;
    ox = m.ox - padG * GROUP_PITCH * cw;
    oy = m.oy - padR * ch;

    const total = groupsPerRow * rows;
    groups = new Array(total);
    for (let i = 0; i < total; i++) {
        const v = randWeight();
        groups[i] = {v: v, str: fmt(v)};
    }

    bright = new Float32Array(total);
    tint = new Uint8Array(total);

    // Free-running activation waves, a mix of both orientations. They start
    // off-screen at staggered distances so they arrive as the field unfolds.
    const n = max(6, floor((rows + groupsPerRow) / 6));
    waves = [];
    for (let i = 0; i < n; i++) waves.push(makeWave(true));
    events = [];
    nextEvent = frameCount + 40;
}

// axis 0 sweeps along a column (index = column), axis 1 along a row; dir is
// +1 for down / right and -1 for up / left.
function makeWave(initial) {
    const axis = random() < 0.5 ? 0 : 1;
    const dir = random() < 0.5 ? 1 : -1;
    const extent = axis === 0 ? rows : groupsPerRow;
    const lead = initial ? random(0, extent) : random(2, 40);
    return {
        axis,
        dir,
        index: floor(random(axis === 0 ? groupsPerRow : rows)),
        pos: dir > 0 ? -lead : extent + lead,
        speed: random(0.15, 0.55),
        len: floor(random(6, 22)),
        lastCell: -1,
    };
}

// Half the matmuls aim their output at a still-encoded prose cell, so the
// text keeps surfacing on its own; the rest land anywhere.
function makeEvent() {
    let row = floor(random(rows));
    let col = floor(random(groupsPerRow));
    if (cells.length && random() < 0.5) {
        const hidden = cells.filter((cell) => cell.state === 0);
        if (hidden.length) {
            const cell = hidden[floor(random(hidden.length))];
            row = cell.row;
            col = min(groupsPerRow - 1, floor(cell.col / GROUP_PITCH));
        }
    }
    return {row, col, t: 0, dur: floor(random(55, 110)), hit: false};
}

// A matmul output landing on a line of prose decodes that whole line,
// rippling out from the hit.
function revealLine(row, col) {
    const hitX = ox + (col * GROUP_PITCH + GROUP_CHARS / 2) * cw;
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.row !== row) continue;
        startScramble(cell, 4 + floor(abs(cell.x - hitX) / (cw * 3)));
    }
}

function reroll(r, c) {
    const g = groups[r * groupsPerRow + c];
    g.v = randWeight();
    g.str = fmt(g.v);
}

function paint(r, c, b, hueIdx) {
    const i = r * groupsPerRow + c;
    if (b > bright[i]) {
        bright[i] = b;
        tint[i] = hueIdx;
    }
}

// Advance the waves and matmul events and rebuild the activation buffer.
function simulate() {
    bright.fill(0);

    for (let w = 0; w < waves.length; w++) {
        const wave = waves[w];
        const extent = wave.axis === 0 ? rows : groupsPerRow;
        wave.pos += wave.speed * wave.dir;
        const head = floor(wave.pos);
        if (head !== wave.lastCell) {
            wave.lastCell = head;
            if (head >= 0 && head < extent) {
                if (wave.axis === 0) reroll(head, wave.index);
                else reroll(wave.index, head);
            }
        }
        for (let k = 0; k < wave.len; k++) {
            const p = head - k * wave.dir;
            if (p < 0 || p >= extent) continue;
            const b = k === 0 ? 1 : 0.92 * (1 - k / wave.len);
            if (wave.axis === 0) paint(p, wave.index, b, 0);
            else paint(wave.index, p, b, 1);
        }
        const gone = wave.dir > 0 ? wave.pos - wave.len > extent :
            wave.pos + wave.len < 0;
        if (gone) waves[w] = makeWave(false);
    }

    if (frameCount >= nextEvent && events.length < 3) {
        events.push(makeEvent());
        nextEvent = frameCount + floor(random(50, 140));
    }
    for (let e = events.length - 1; e >= 0; e--) {
        const ev = events[e];
        ev.t++;
        const prog = min(1, ev.t / ev.dur);
        if (prog < 1) {
            // Both operands are selected: the row dimly across its whole
            // width, the column down its whole height. A head sweeps along
            // each, brighter behind it where the values have been consumed.
            const headC = prog * groupsPerRow;
            const headR = prog * rows;
            for (let c = 0; c < groupsPerRow; c++) {
                const d = headC - c;
                let b = d < 0 ? 0.14 : 0.3;
                if (d >= 0 && d < 4) b = 1 - d * 0.18;
                paint(ev.row, c, b, 1);
            }
            for (let r = 0; r < rows; r++) {
                const d = headR - r;
                let b = d < 0 ? 0.14 : 0.3;
                if (d >= 0 && d < 4) b = 1 - d * 0.18;
                paint(r, ev.col, b, 0);
            }
            // The output accumulates: brightens as the sweep proceeds and
            // its value keeps changing until the dot product is done.
            reroll(ev.row, ev.col);
            paint(ev.row, ev.col, 0.35 + 0.65 * prog, 0);
        } else {
            if (!ev.hit) {
                ev.hit = true;
                revealLine(ev.row, ev.col);
            }
            const after = ev.t - ev.dur;
            if (after < MM_HOLD) {
                paint(ev.row, ev.col, 1, 0);
            } else if (after < MM_HOLD + MM_FADE) {
                paint(ev.row, ev.col, 1 - (after - MM_HOLD) / MM_FADE, 0);
            } else {
                events.splice(e, 1);
            }
        }
    }
}

// ---------------------------------------------------------------- prose

// Flatten <main> into blocks of {ch, href} runs. The Apple logo glyph only
// renders on Apple platforms; elsewhere fall back to the span's aria-label.
function readSource() {
    const main = document.querySelector('main');
    if (!main) return [];
    const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
    const out = [];
    main.querySelectorAll('h6, p').forEach((el) => {
        const raw = [];
        const walk = (node, href) => {
            if (node.nodeType === Node.TEXT_NODE) {
                for (const c of node.textContent) raw.push({ch: c, href});
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.classList.contains('apple-logo')) {
                const s = isApple ? '' :
                    (node.getAttribute('aria-label') || 'Apple');
                for (const c of s) raw.push({ch: c, href});
                return;
            }
            const h = node.tagName === 'A' ? node.getAttribute('href') : href;
            node.childNodes.forEach((n) => walk(n, h));
        };
        walk(el, null);

        // Collapse runs of whitespace and trim, like the browser would.
        let runs = [];
        for (const r of raw) {
            if (/\s/.test(r.ch)) {
                if (runs.length && runs[runs.length - 1].ch !== ' ') {
                    runs.push({ch: ' ', href: null});
                }
            } else {
                runs.push(r);
            }
        }
        if (runs.length && runs[runs.length - 1].ch === ' ') runs.pop();
        if (!runs.length) return;

        let kind = 'para';
        if (el.tagName === 'H6') {
            kind = 'heading';
            // Letter-spaced uppercase so the heading stands apart from the
            // body copy without needing a second font size.
            const spaced = [];
            runs.forEach((r, i) => {
                if (i) spaced.push({ch: ' ', href: null});
                spaced.push({ch: r.ch.toUpperCase(), href: r.href});
            });
            runs = spaced;
        }
        out.push({kind, runs});
    });
    return out;
}

// Greedy word wrap over runs; a word longer than the line is split hard.
function wrap(runs, maxLen) {
    const words = [];
    let word = [];
    for (const r of runs) {
        if (r.ch === ' ') {
            words.push(word);
            word = [];
        } else {
            word.push(r);
        }
    }
    words.push(word);

    const lines = [];
    let line = [];
    for (const w of words) {
        if (w.length > maxLen) {
            if (line.length) lines.push(line);
            for (let i = 0; i < w.length; i += maxLen) {
                lines.push(w.slice(i, i + maxLen));
            }
            line = [];
        } else if (!line.length) {
            line = w.slice();
        } else if (line.length + 1 + w.length <= maxLen) {
            line.push({ch: ' ', href: null});
            line.push(...w);
        } else {
            lines.push(line);
            line = w.slice();
        }
    }
    if (line.length) lines.push(line);
    return lines;
}

function blockColor(kind) {
    return kind === 'heading' ? COLOR_ACCENT : COLOR_TEXT;
}

// Lay the prose onto the grid, centred in the band between the nav and the
// footer. Returns true on success, false if the grid is too narrow to ever
// hold it, or the canvas height (in px) that would make it fit vertically.
function layoutText() {
    const source = readSource();
    if (!source.length) return false;

    const lineWidth = min(visCols - 4, MAX_LINE);
    if (lineWidth < 16) return false;

    // The nav is fixed at the top; the footer sits at the bottom of the
    // body, which relayout() keeps at least as tall as the canvas — so
    // measure the footer's height rather than trusting its current top.
    const nav = document.querySelector('nav');
    const footer = document.querySelector('footer');
    const top = nav ? nav.getBoundingClientRect().bottom : 0;
    const footerH = footer ? footer.getBoundingClientRect().height : 0;
    const bottom = height - footerH;
    const rowTop = ceil((top - oy) / ch) + 1;
    const rowBot = floor((bottom - oy) / ch) - 2;
    const avail = rowBot - rowTop + 1;

    const wrapped = source.map((b) => ({
        kind: b.kind,
        lines: wrap(b.runs, lineWidth),
    }));
    let needed = 0;
    wrapped.forEach((b, i) => {
        needed += b.lines.length + (i ? 1 : 0);
    });
    if (needed > avail) return top + (needed + 4) * ch + footerH;

    cells = [];
    blocks = [];
    cellAt = new Array(rows * cols).fill(null);
    rowBlocks = new Array(rows);
    for (let r = 0; r < rows; r++) rowBlocks[r] = [];

    let idx = 0;
    let row = rowTop + floor((avail - needed) / 2);
    for (const b of wrapped) {
        const block = {
            kind: b.kind,
            color: blockColor(b.kind),
            cells: [],
            total: 0,
            revealed: 0,
            focus: 0,
            // Pointer inside the block's hitbox: the whole paragraph decodes,
            // the digits behind it black out and the text goes bold.
            hot: 0,
            hovered: false,
            r0: row,
            r1: row + b.lines.length - 1,
            c0: cols,
            c1: 0,
        };
        for (const src of b.lines) {
            // One cell of padding either side so the prose never butts up
            // against a neighbouring digit.
            const line = [{ch: ' ', href: null}];
            line.push(...src);
            line.push({ch: ' ', href: null});
            const c0 = floor((cols - line.length) / 2);
            for (let i = 0; i < line.length; i++) {
                const col = c0 + i;
                const cell = {
                    row, col,
                    ch: line[i].ch,
                    href: line[i].href,
                    idx: idx++,
                    block,
                    state: 0, // 0 hidden, 1 scrambling, 2 revealed
                    t: 0,
                    dur: 0,
                    // Non-ASCII glyphs (the Apple logo) are not monospace;
                    // draw them alone, centred, so they can't shift a run.
                    solo: line[i].ch.charCodeAt(0) > 126,
                    x: ox + col * cw,
                    yTop: oy + row * ch,
                };
                if (revealedIdx.has(cell.idx)) {
                    cell.state = 2;
                    block.revealed++;
                }
                cells.push(cell);
                block.cells.push(cell);
                block.total++;
                cellAt[row * cols + col] = cell;
            }
            block.c0 = min(block.c0, c0);
            block.c1 = max(block.c1, c0 + line.length - 1);
            row++;
        }
        for (let r = block.r0; r <= block.r1; r++) rowBlocks[r].push(block);
        blocks.push(block);
        row++; // blank line between blocks
    }
    return true;
}

// ---------------------------------------------------------------- reveal

function startScramble(cell, dur) {
    if (cell.state !== 0) return;
    cell.state = 1;
    cell.t = 0;
    cell.dur = dur;
}

// Decode a whole block, rippling out from (fx, fy) if given, else in
// reading order.
function revealBlock(block, fx, fy) {
    block.cells.forEach((cell, i) => {
        let dur;
        if (typeof fx === 'number') {
            const dx = cell.x + cw / 2 - fx;
            const dy = cell.yTop + ch / 2 - fy;
            dur = 4 + floor(sqrt(dx * dx + dy * dy) / (cw * 2.5));
        } else {
            dur = 4 + floor(i * 0.35);
        }
        startScramble(cell, dur);
    });
}

// Block hitbox, padded by a cell so the edge of the text is inside it.
function inBlock(b, px, py) {
    return px >= ox + (b.c0 - 1) * cw && px <= ox + (b.c1 + 2) * cw &&
        py >= oy + (b.r0 - 0.5) * ch && py <= oy + (b.r1 + 1.5) * ch;
}

function cellUnder(px, py) {
    const col = floor((px - ox) / cw);
    const row = floor((py - oy) / ch);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return cellAt[row * cols + col];
}

function updatePointer() {
    if (touches.length > 0) {
        pointer.x = touches[0].x;
        pointer.y = touches[0].y;
        pointer.active = true;
        pointer.touch = true;
        return;
    }
    if (pointer.touch) {
        pointer.touch = false;
        pointer.active = false;
        return;
    }
    if (pointer.mouseSeen) {
        pointer.x = mouseX;
        pointer.y = mouseY;
        pointer.active = true;
    }
}

function updateCells(radius) {
    const r2 = radius * radius;
    const px = pointer.x;
    const py = pointer.y;
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.state === 0) {
            if (!pointer.active) continue;
            const dx = cell.x + cw / 2 - px;
            const dy = cell.yTop + ch / 2 - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2) {
                // Nearer cells settle first.
                startScramble(cell, 5 + floor((sqrt(d2) / radius) * 14));
            }
        } else if (cell.state === 1) {
            cell.t++;
            if (cell.t >= cell.dur) {
                cell.state = 2;
                cell.block.revealed++;
                revealedIdx.add(cell.idx);
            }
        }
    }

    for (const b of blocks) {
        const hovered = pointer.active && inBlock(b, px, py);
        if (hovered && !b.hovered) revealBlock(b, px, py);
        b.hovered = hovered;
        b.hot += ((hovered ? 1 : 0) - b.hot) * 0.15;

        const ratio = b.total ? b.revealed / b.total : 0;
        // Once a block is a quarter decoded, dim the digits around it so the
        // prose reads cleanly.
        const target = min(1, ratio * 4);
        b.focus += (target - b.focus) * 0.08;
    }

    // Pointer affordance for links. The canvas sits behind the page, so the
    // cursor has to be set on the body.
    let href = null;
    if (pointer.active && !pointer.touch) {
        const cell = cellUnder(px, py);
        if (cell && cell.href && cell.state === 2) href = cell.href;
    }
    if (href !== hoverHref) {
        hoverHref = href;
        document.body.style.cursor = href ? 'pointer' : '';
    }
}

// ---------------------------------------------------------------- drawing

function drawField(radius) {
    const r2 = radius * radius;
    const px = pointer.x;
    const py = pointer.y;
    const near = pointer.active;
    const halfGroup = (GROUP_CHARS * cw) / 2;

    simulate();

    // Spring the drag offset toward the pointer while grabbing, and back
    // to rest once released (underdamped, so it wobbles a little).
    // The offset is soft-limited (tanh) so a long drag stretches the sheet
    // against increasing resistance rather than piling cells on top of each
    // other, and the falloff spans the whole screen so neighbours never
    // move far enough relative to one another to overlap.
    let tx = grab.active ? pointer.x - grab.x : 0;
    let ty = grab.active ? pointer.y - grab.y : 0;
    const mag = sqrt(tx * tx + ty * ty);
    if (mag > 0) {
        const lim = PULL_MAX * Math.tanh(mag / PULL_MAX) / mag;
        tx *= lim;
        ty *= lim;
    }
    grab.vx = (grab.vx + (tx - grab.ox) * 0.12) * 0.78;
    grab.vy = (grab.vy + (ty - grab.oy) * 0.12) * 0.78;
    grab.ox += grab.vx;
    grab.oy += grab.vy;
    const pulling = abs(grab.ox) > 0.05 || abs(grab.oy) > 0.05;
    const pullR = max(width, height) * 1.3;
    const pullR2 = pullR * pullR;

    const t = frameCount;
    const unfold = min(1, (frameCount - unfoldStart) / UNFOLD_FRAMES);
    if (unfold < 1) ctx.textAlign = 'center';
    for (let r = 0; r < rows; r++) {
        const yc = oy + r * ch + ch / 2;
        const rb = rowBlocks[r];
        for (let c = 0; c < groupsPerRow; c++) {
            const gi = r * groupsPerRow + c;
            const grp = groups[gi];

            // Surface height (h) and its quadrature (g): the cell orbits
            // like a water particle, up/down on h and side to side on g.
            // Indexed relative to the visible grid so the home page's outro
            // can compute the same positions without knowing the overscan.
            latticeSwell(c - padG, r - padR, t, swell);
            const h = swell.h;
            let x = ox + c * GROUP_PITCH * cw + swell.g * cw * SWAY_X;
            let y = yc + h * ch * SWAY_Y;

            if (pulling) {
                const dx = x + halfGroup - grab.x;
                const dy = y - grab.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < pullR2) {
                    let wgt = 1 - sqrt(d2) / pullR;
                    wgt *= wgt;
                    x += grab.ox * wgt;
                    y += grab.oy * wgt;
                }
            }

            if (x > width || x + 2 * halfGroup < 0 ||
                y < -ch || y > height + ch) {
                continue;
            }

            let f = 0;
            if (near) {
                const dx = x + halfGroup - px;
                const dy = y - py;
                const d2 = dx * dx + dy * dy;
                if (d2 < r2) {
                    f = 1 - sqrt(d2) / radius;
                    f *= f;
                    // The odd value ticks over under the pointer — a slow
                    // tick, not a flicker, so the field stays readable.
                    if (random() < f * 0.04) {
                        grp.v = constrain(grp.v + random(-1, 1) * 0.3 * f,
                            -0.99, 0.99);
                        grp.str = fmt(grp.v);
                    }
                }
            }

            // Crests are lit, troughs dim but never dark — the surface must
            // read as continuous, with no holes; activations sit on top.
            let b = bright[gi];
            let hueIdx = tint[gi];
            const crest = 0.10 + 0.30 * constrain((h + 1) / 2, 0, 1);
            if (crest > b) {
                b = crest;
                hueIdx = 2;
            }

            let dim = 1;
            if (rb.length) {
                const gc0 = c * GROUP_PITCH;
                const gc1 = gc0 + GROUP_CHARS - 1;
                for (let k = 0; k < rb.length; k++) {
                    const blk = rb[k];
                    if (blk.focus > 0.01 && gc1 >= blk.c0 - 1 &&
                        gc0 <= blk.c1 + 1) {
                        dim = min(dim, 1 - 0.5 * blk.focus);
                    }
                }
            }

            if (b > 0 && b < 1 && random() < 0.02 * b) {
                grp.v = randWeight();
                grp.str = fmt(grp.v);
            }

            if (unfold < 1) {
                // Opening: a bright point (the decimal point, which sits at
                // the middle of every value) that unfolds into the number,
                // dimming from the outro's green to the resting palette.
                const k = floor(unfold * 3);
                const l = 10 + 38 * b + (62 - 38 * b) * (1 - unfold);
                ctx.fillStyle = 'hsl(' + RAIN_HUE + ',100%,' +
                    (l * dim).toFixed(0) + '%)';
                ctx.fillText(grp.str.slice(2 - k, 3 + k), x + halfGroup, y);
                continue;
            }

            if (f === 0 && dim > 0.99) {
                ctx.fillStyle = b >= 1 ? HEAD :
                    TRAIL[hueIdx][floor(b * 15.99)];
            } else {
                // Pointer glow paints the site's cycling hue into the field.
                const base = HUES[hueIdx];
                const hh = f > 0 ? (base + f * ((hue + 180) % 360 - base) +
                    360) % 360 : base;
                const sat = b >= 1 ? 60 : 100;
                const l = max(b >= 1 ? 92 : 10 + 38 * b, 12 + 50 * f) * dim;
                ctx.fillStyle = 'hsl(' + hh.toFixed(0) + ',' + sat + '%,' +
                    l.toFixed(0) + '%)';
            }
            ctx.fillText(grp.str, x, y);
        }
    }
    if (unfold < 1) ctx.textAlign = 'left';
}

function drawCells() {
    // Black out the digits behind any block the pointer is on, so nothing
    // competes with the text.
    for (const b of blocks) {
        if (b.hot < 0.01) continue;
        ctx.fillStyle = 'rgba(0,0,0,' + (b.hot * 0.94).toFixed(2) + ')';
        ctx.fillRect(ox + (b.c0 - 1) * cw, oy + (b.r0 - 0.5) * ch,
            (b.c1 - b.c0 + 3) * cw, (b.r1 - b.r0 + 2) * ch);
    }

    const scrambleColor = 'hsl(' + ((hue + 150) % 360).toFixed(0) +
        ',95%,68%)';

    let run = null;
    let bold = false;
    const flush = () => {
        if (!run) return;
        if (run.bold !== bold) {
            bold = run.bold;
            ctx.font = (bold ? 'bold ' : '') + fontSize + 'px ' + FONT;
        }
        ctx.fillStyle = '#000';
        ctx.fillRect(run.x, run.yTop, run.len * cw, ch);
        ctx.fillStyle = run.color;
        if (run.solo) {
            ctx.textAlign = 'center';
            ctx.fillText(run.str, run.x + cw / 2, run.yTop + ch / 2);
            ctx.textAlign = 'left';
        } else {
            ctx.fillText(run.str, run.x, run.yTop + ch / 2);
        }
        if (run.link) {
            ctx.fillRect(run.x, run.yTop + ch - 3, run.len * cw, 1);
        }
        run = null;
    };

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.state === 0) {
            flush();
            continue;
        }
        let color;
        let chr;
        if (cell.state === 1) {
            color = scrambleColor;
            chr = SCRAMBLE[floor(random(SCRAMBLE.length))];
        } else {
            chr = cell.ch;
            if (cell.href) color = COLOR_ACCENT;
            else if (cell.block.hot > 0.5) color = '#fff';
            else color = cell.block.color;
        }
        const link = cell.state === 2 && !!cell.href;
        const heavy = cell.block.hot > 0.5;
        if (run && !run.solo && !cell.solo && run.row === cell.row &&
            run.col + run.len === cell.col && run.color === color &&
            run.link === link && run.bold === heavy) {
            run.str += chr;
            run.len++;
            continue;
        }
        flush();
        run = {
            row: cell.row,
            col: cell.col,
            len: 1,
            x: cell.x,
            yTop: cell.yTop,
            str: chr,
            color,
            link,
            bold: heavy,
            solo: cell.solo,
        };
    }
    flush();
    if (bold) setFont();
}

function draw() {
    if (!ready) return;
    updatePointer();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    setFont();
    hue = (hue + 0.2) % 360;

    // Digits react over a wider reach than prose decodes, so the glow leads
    // the pointer and the text only resolves once you are actually on it.
    const glow = max(130, ch * 7);
    const decode = max(80, ch * 4.5);

    if (intro && frameCount >= introEnd) {
        intro = false;
        // The heading decodes on its own once the swells have arrived, so
        // the visitor knows there is something to find.
        for (const b of blocks) {
            if (b.kind === 'heading') revealBlock(b);
        }
    }

    drawField(glow);
    if (!intro) updateCells(decode);
    drawCells();
}

function windowResized() {
    if (!ready) return;
    intro = false;
    if (!relayout()) bail();
}

// Click a link cell to follow it; click anywhere on a paragraph to decode the
// whole thing (this is also the tap gesture on touch screens, where there is
// no hover — p5 routes touchstart here when touchStarted is undefined).
// Any press also grabs the sheet, so a drag pulls the mesh around.
function mousePressed() {
    if (!ready || intro) return;
    const cell = cellUnder(mouseX, mouseY);
    if (cell && cell.href && cell.state === 2) {
        window.location.href = cell.href;
        return;
    }
    grab.active = true;
    grab.x = mouseX - grab.ox;
    grab.y = mouseY - grab.oy;
    pointer.x = mouseX;
    pointer.y = mouseY;
    pointer.active = true;
    for (const b of blocks) {
        const x0 = ox + b.c0 * cw;
        const x1 = ox + (b.c1 + 1) * cw;
        const y0 = oy + b.r0 * ch;
        const y1 = oy + (b.r1 + 1) * ch;
        if (mouseX >= x0 && mouseX <= x1 && mouseY >= y0 && mouseY <= y1) {
            revealBlock(b, mouseX, mouseY);
        }
    }
}

function mouseReleased() {
    grab.active = false;
}

// Enter decodes everything, for anyone without a pointer.
function keyPressed() {
    if (!ready || intro) return;
    if (keyCode === ENTER) {
        for (const b of blocks) revealBlock(b);
    }
}
