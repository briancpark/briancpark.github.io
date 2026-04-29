function Particle(spawnX, spawnY) {
    const sx = (typeof spawnX === 'number') ? spawnX : random(width);
    const sy = (typeof spawnY === 'number') ? spawnY : random(height);
    this.pos = createVector(sx, sy);
    this.protected = false;
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxspeed = 4.5;

    // Two trail points stored as plain {x, y} — avoids p5.Vector
    // allocation each frame. Updated in-place; -9999 means "uninitialized".
    this.prevX = -9999;
    this.prevY = -9999;

    this.update = function() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxspeed);
        this.prevX = this.pos.x;
        this.prevY = this.pos.y;
        this.pos.add(this.vel);
        this.acc.x = 0;
        this.acc.y = 0;
    };

    this.follow = function(vectors) {
        let x = floor(this.pos.x / scl);
        let y = floor(this.pos.y / scl);
        // Clamp into the field so floating-point edge values (or particles
        // spawned slightly outside the canvas) always read a valid cell.
        if (x < 0) x = 0; else if (x >= cols) x = cols - 1;
        if (y < 0) y = 0; else if (y >= rows) y = rows - 1;
        const f = vectors[x + y * cols];
        if (!f) return;
        this.acc.x += f.x;
        this.acc.y += f.y;
    };

    // Caller sets stroke + strokeWeight once per frame.
    this.show = function() {
        if (this.prevX === -9999) {
            point(this.pos.x, this.pos.y);
            return;
        }

        // If the particle wrapped this frame, prev and pos are on opposite
        // sides of the canvas. Detect via delta > half-dimension and draw
        // two segments — one continuing off the leaving edge, one starting
        // off the entering edge — so the wrap looks visually continuous.
        const dx = this.pos.x - this.prevX;
        const dy = this.pos.y - this.prevY;
        let realDx = dx;
        let realDy = dy;
        if (dx > width / 2) realDx = dx - width;
        else if (dx < -width / 2) realDx = dx + width;
        if (dy > height / 2) realDy = dy - height;
        else if (dy < -height / 2) realDy = dy + height;

        if (realDx === dx && realDy === dy) {
            line(this.prevX, this.prevY, this.pos.x, this.pos.y);
        } else {
            line(this.prevX, this.prevY,
                this.prevX + realDx, this.prevY + realDy);
            line(this.pos.x - realDx, this.pos.y - realDy,
                this.pos.x, this.pos.y);
        }
    };

    this.edges = function() {
        if (this.pos.x > width) this.pos.x -= width;
        else if (this.pos.x < 0) this.pos.x += width;
        if (this.pos.y > height) this.pos.y -= height;
        else if (this.pos.y < 0) this.pos.y += height;
    };
}
