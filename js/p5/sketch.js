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

const particles = [];

let flowfield;

let canvas;

function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.style('z-index', '-1');

    colorMode(HSB, 255);
    cols = floor(width / scl);
    rows = floor(height / scl);

    flowfield = new Array(cols * rows);

    for (let i = 0; i < 300; i++) {
        particles[i] = new Particle();
    }
    background(0);
    canvas.position(0, 0);
}

function draw() {
    let yoff = 0;
    for (let y = 0; y < rows; y++) {
        let xoff = 0;
        for (let x = 0; x < cols; x++) {
            const index = x + y * cols;
            const angle = noise(xoff, yoff, zoff) * TWO_PI * 4;
            const v = p5.Vector.fromAngle(angle);
            v.setMag(1);
            flowfield[index] = v;
            xoff += inc;
            stroke(0, 50);
        }
        yoff += inc;

        zoff += 0.0003;
    }

    for (let i = 0; i < particles.length; i++) {
        particles[i].follow(flowfield);
        particles[i].update();
        particles[i].edges();
        particles[i].show();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    background(0);
}
