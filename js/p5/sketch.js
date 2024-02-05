/*
    Let's make some Perlin noise!

    Colorful particles that move around the screen. I REALLLLLY tried hard to make this mobile 
    friendly. I think it's pretty good. Plus, THE CONTRAST OF THE RAINBOW COLORS AGAINST
    THE BLACK BACKGROUND IS SO SICK!!!

    The effect is SO MUCH COOLER ON AN OLED SCREEN :D

    Credits to Daniel Shiffman for inspiring me to learn p5.js and for the code for this sketch
    All aboard the Coding Train! https://thecodingtrain.com/
*/

var inc = 0.1;
var scl = innerWidth / 100;
var cols, rows;

var zoff = 0;

var particles = [];

var flowfield;

var canvas;

function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.style('z-index', '-1');

    colorMode(HSB, 255);
    cols = floor(width / scl);
    rows = floor(height / scl);

    flowfield = new Array(cols * rows);

    for (var i = 0; i < 300; i++) {
        particles[i] = new Particle();
    }
    background(0);
    canvas.position(0, 0);
}

function draw() {
    var yoff = 0;
    for (var y = 0; y < rows; y++) {
        var xoff = 0;
        for (var x = 0; x < cols; x++) {
            var index = x + y * cols;
            var angle = noise(xoff, yoff, zoff) * TWO_PI * 4;
            var v = p5.Vector.fromAngle(angle);
            v.setMag(1);
            flowfield[index] = v;
            xoff += inc;
            stroke(0, 50);
        }
        yoff += inc;

        zoff += 0.0003;
    }

    for (var i = 0; i < particles.length; i++) {
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