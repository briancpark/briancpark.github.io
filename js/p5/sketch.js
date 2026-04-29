/*
    Let's make some Perlin noise!

    Colorful particles that move around the screen. I REALLLLLY
    tried hard to make this mobile friendly. I think it's
    pretty good. Plus, THE CONTRAST OF THE RAINBOW COLORS AGAINST
    THE BLACK BACKGROUND IS SO SICK!!!

    The effect is SO MUCH COOLER ON AN OLED SCREEN :D

    Credits to Daniel Shiffman for inspiring me to learn p5.js
    and for the code for this sketch.

    All aboard the Coding Train! https://thecodingtrain.com/
*/

const inc = 0.1;
const scl = innerWidth / 100;
let cols; let rows;

let zoff = 0;
// All particles share this hue per frame and cycle in lockstep — the
// original behaviour, restored after experimenting with per-particle and
// spatial schemes.
let globalHue = 0;

const particles = [];
let particleCap = 0;

let flowfield;

let canvas;

const pointer = {
    x: -9999,
    y: -9999,
    prevX: -9999,
    prevY: -9999,
    strength: 0,
    mouseSeen: false,
    touchActive: false,
};

function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.style('z-index', '-1');

    colorMode(HSB, 255);
    // ceil so the field covers the full canvas — with floor, the right/
    // bottom strip narrower than `scl` has no cell, and particles drifting
    // into it receive no force and stick there.
    cols = ceil(width / scl);
    rows = ceil(height / scl);

    flowfield = new Array(cols * rows);
    for (let i = 0; i < flowfield.length; i++) {
        flowfield[i] = {x: 0, y: 0};
    }

    const particleCount = floor((windowWidth * windowHeight) / 500);
    // Hard cap so typed-pulse spawns can't grow the pool unbounded.
    particleCap = particleCount * 2;
    for (let i = 0; i < particleCount; i++) {
        particles[i] = new Particle();
    }

    background(0);
    canvas.position(0, 0);

    // Only treat real mouse movement as a pointer signal — ignore the
    // synthetic mousemove that mobile browsers fire after a tap, otherwise
    // the influence would linger at the last touch point.
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

function draw() {
    // Draw a slightly transparent black background to fade old trails
    background(0, 0, 0, 40); // HSB mode: black with low alpha

    updatePointer();

    const radius = min(width, height) * 0.28;
    const radiusSq = radius * radius;
    const influence = pointer.strength > 0.005;

    let yoff = 0;
    for (let y = 0; y < rows; y++) {
        let xoff = 0;
        const cellY = y * scl + scl * 0.5;
        for (let x = 0; x < cols; x++) {
            const index = x + y * cols;
            const angle = noise(xoff, yoff, zoff) * TWO_PI * 4;
            const fv = flowfield[index];
            // Mutate in place — no per-cell vector allocation.
            fv.x = cos(angle);
            fv.y = sin(angle);

            if (influence) {
                const cellX = x * scl + scl * 0.5;
                const dx = cellX - pointer.x;
                const dy = cellY - pointer.y;
                const dSq = dx * dx + dy * dy;
                if (dSq < radiusSq) {
                    const dist = sqrt(dSq) || 0.0001;
                    const falloff = 1 - dist / radius;
                    const f2 = falloff * falloff;
                    const s = pointer.strength;
                    const inv = 1 / dist;
                    const swirl = f2 * s * 2.5;
                    const push = f2 * s * 1.4;
                    fv.x += (-dy * inv) * swirl + (dx * inv) * push;
                    fv.y += (dx * inv) * swirl + (dy * inv) * push;
                    const mag = sqrt(fv.x * fv.x + fv.y * fv.y) || 1;
                    const target = 1 + f2 * s * 1.8;
                    fv.x = fv.x / mag * target;
                    fv.y = fv.y / mag * target;
                }
            }

            xoff += inc;
        }
        yoff += inc;
    }
    // Noise evolves a touch faster while the user is interacting
    zoff += 0.0003 + pointer.strength * 0.0008;

    stroke(globalHue, 255, 255, 255);
    strokeWeight(2.5);
    for (let i = 0; i < particles.length; i++) {
        particles[i].follow(flowfield);
        particles[i].update();
        particles[i].edges();
        particles[i].show();
    }
    globalHue = (globalHue + 1) % 256;
}

function updatePointer() {
    let px;
    let py;
    let source = null;

    if (touches.length > 0) {
        px = touches[0].x;
        py = touches[0].y;
        source = 'touch';
        pointer.touchActive = true;
    } else if (pointer.touchActive) {
        // Touch just released — let the influence fade in place rather than
        // snapping to the synthetic mouse position browsers leave behind.
        pointer.strength *= 0.85;
        if (pointer.strength < 0.02) pointer.touchActive = false;
        return;
    } else if (pointer.mouseSeen) {
        px = mouseX;
        py = mouseY;
        source = 'mouse';
    }

    if (source === null) {
        pointer.strength *= 0.9;
        return;
    }

    const dx = px - pointer.prevX;
    const dy = py - pointer.prevY;
    const movement = sqrt(dx * dx + dy * dy);

    pointer.x = px;
    pointer.y = py;
    pointer.prevX = px;
    pointer.prevY = py;

    const burst = constrain(movement / 22, 0, 1);
    const baseline = source === 'touch' ? 0.45 : 0.22;
    pointer.strength = max(pointer.strength * 0.93, max(burst, baseline));
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    cols = ceil(width / scl);
    rows = ceil(height / scl);
    flowfield = new Array(cols * rows);
    for (let i = 0; i < flowfield.length; i++) {
        flowfield[i] = {x: 0, y: 0};
    }
    background(0);
}

// eslint-disable-next-line no-unused-vars
function addParticles(count, centerX, centerY, spreadX, spreadY) {
    const hasCenter =
        (typeof centerX === 'number' && typeof centerY === 'number');
    const rx = (typeof spreadX === 'number') ? spreadX : 40;
    const ry = (typeof spreadY === 'number') ? spreadY : rx;

    // Evict oldest particles in one batch before pushing — keeps the pool
    // bounded so typed pulses can't degrade frame rate over time.
    const overflow = particles.length + count - particleCap;
    if (overflow > 0) particles.splice(0, overflow);

    for (let i = 0; i < count; i++) {
        let p;
        if (hasCenter) {
            const px = centerX + random(-rx, rx);
            const py = centerY + random(-ry, ry);
            p = new Particle(px, py);
            p.protected = true;
        } else {
            p = new Particle();
        }
        particles.push(p);
    }
}

// eslint-disable-next-line no-unused-vars
function removeParticles(count) {
    let removed = 0;
    for (let i = particles.length - 1; i >= 0 && removed < count; i--) {
        if (!particles[i].protected) {
            particles.splice(i, 1);
            removed++;
        }
    }
}
