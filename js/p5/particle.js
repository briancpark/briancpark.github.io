function Particle() {
    this.pos = createVector(random(width), random(height));
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxspeed = 4.5;
    this.h = 0;

    this.trail = [];
    this.maxTrail = 2; // Length of visible trail

    this.update = function() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxspeed);
        this.pos.add(this.vel);
        this.acc.mult(0);

        // Store a copy of the current position
        this.trail.push(this.pos.copy());
        if (this.trail.length > this.maxTrail) {
            this.trail.shift(); // Remove oldest point
        }
    };

    this.follow = function(vectors) {
        const x = floor(this.pos.x / scl);
        const y = floor(this.pos.y / scl);
        const index = x + y * cols;
        const force = vectors[index];
        this.applyForce(force);
    };

    this.applyForce = function(force) {
        this.acc.add(force);
    };

    this.show = function() {
        noFill();
        beginShape();
        for (let i = 0; i < this.trail.length; i++) {
            let pos = this.trail[i];
            stroke(this.h, 255, 255, 255);
            strokeWeight(2.5);
            vertex(pos.x, pos.y);
        }
        endShape();

        this.h = (this.h + 1) % 256;
    };

    this.edges = function() {
        if (this.pos.x > width) {
            this.pos.x = 0;
            this.trail = [];
        }
        if (this.pos.x < 0) {
            this.pos.x = width;
            this.trail = [];
        }
        if (this.pos.y > height) {
            this.pos.y = 0;
            this.trail = [];
        }
        if (this.pos.y < 0) {
            this.pos.y = height;
            this.trail = [];
        }
    };
}
