const canvas = document.getElementById("game-canvas");
const context = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const currentScoreElement = document.getElementById("current-score");

const gameOverContainer = document.getElementById("game-over-container-div");
const finalScoreElement = document.getElementById("final-score");
const startGameButton = document.getElementById("start-game-button");

// globals
const projectiles = [];
const enemies = [];
const particles = [];
let score = 0;
let gameOver = false;

const maxNumberOfEnemies = 100;
const maxEnemyRadius = 40;
const minEnemyRadius = 10;
const spawnRate = 500;

// board
class Board {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.center = {
            x: x + width / 2,
            y: y + height / 2,
        }
    }

    draw() {
        context.fillStyle = "black";
        context.lineWidth = 5;
        context.strokeRect(this.x, this.y, this.width, this.height);
    }
};

// const board = new Board(100, 50, canvas.width - 500, canvas.height - 100);
const board = new Board(0, 0, canvas.width, canvas.height);

// keyboard
const keyboard = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
};

window.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key === "w") { keyboard.up = -1; return; }
    if (key === "a") { keyboard.left = -1; return; }
    if (key === "s") { keyboard.down = 1; return; }
    if (key === "d") { keyboard.right = 1; return; }
});

window.addEventListener("keyup", (event) => {
    const key = event.key;
    if (key === "w") { keyboard.up = 0; return; }
    if (key === "a") { keyboard.left = 0; return; }
    if (key === "s") { keyboard.down = 0; return; }
    if (key === "d") { keyboard.right = 0; return; }
});

// player
const player = {
    x: board.center.x,
    y: board.center.y,
    radius: 10,
    color: "white",
    speed: 5,
    velX: 0,
    velY: 0,

    update() {
        const velX = this.speed * (keyboard.left + keyboard.right);
        const velY = this.speed * (keyboard.up + keyboard.down);

        const x = this.x;
        const y = this.y;

        this.x = clamp(x + velX, board.x + this.radius, board.x + board.width - this.radius);
        this.y = clamp(y + velY, board.y + this.radius, board.y + board.height - this.radius);

        this.velX = this.x - x;
        this.velY = this.y - y;
    },

    draw() {
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
    },

    reset() {
        this.x = board.center.x;
        this.y = board.center.y;
        this.velX = 0;
        this.velY = 0;
    }
};

function handlePlayer() {
    player.update();
    player.draw();
}

// projectiles
class Projectile {
    constructor(x, y, radius, color, velX, velY) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velX = velX;
        this.velY = velY;
    }

    update() {
        this.x += this.velX;
        this.y += this.velY;
    }

    draw() {
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
    }
};

function drawClick(x, y) {
    context.fillStyle = "black";
    context.beginPath();
    context.arc(x, y, 20, 0, Math.PI * 2);
    context.stroke();
}

function shoot(event) {
    // drawClick(event.clientX, event.clientY);

    const direction = unitVector(event.clientX - player.x, event.clientY - player.y);
    const radius = 5;
    const initialX = player.x + direction.x * (player.radius + radius);
    const initialY = player.y + direction.y * (player.radius + radius);
    const boost = vectorSize(player.velX, player.velY) * 0.5;
    const velX = direction.x * (2 + boost);
    const velY = direction.y * (2 + boost);
    const projectile = new Projectile(initialX, initialY, radius, "white", velX, velY);
    projectiles.push(projectile);
}

window.addEventListener("click", shoot);

function handleProjectiles() {
    projectiles.forEach((p, i) => {
        p.update();
        p.draw();
        if (outOfBoundary(p.x, p.y, p.radius)) {
            projectiles.splice(i, 1);
        }
    });
}

// enemies
class Enemy {
    constructor(x, y, radius, color, velX, velY) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velX = velX;
        this.velY = velY;

        this.shrinkCount = 0;
        this.shrinking = false;
        this.shrinkTime = 0.;
        this.shrinkRadius = radius;
    }

    update() {
        this.x += this.velX;
        this.y += this.velY;

        if (this.shrinking) {
            if (this.shrinkTime >= 1.) {
                this.shrinking = false;
                this.shrinkTime = 0.;
                this.radius = this.shrinkRadius;
            } else {
                this.shrinkRadius = this.radius - 10 * easeOutExpo(this.shrinkTime);
                this.shrinkTime += 0.05;
            }
        } else {
            if (this.shrinkCount > 0) {
                this.shrinkCount -= 1;
                this.shrinking = true;
            }
        }
  }

    draw() {
        context.beginPath();
        context.arc(this.x, this.y, this.shrinkRadius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
    }
};

function randomBoardPosition(radius) {
    if (Math.random() < 0.5) {
        return {
            x: (Math.random() < 0.5) ? board.x + radius : board.x + board.width - radius,
            y: Math.random() * (board.height - radius) + board.y + radius,
        };
    } else {
        return {
            x: Math.random() * (board.width - radius) + board.x + radius,
            y: (Math.random() < 0.5) ? board.y + radius : board.y + board.height - radius,
        };
    }
}

function spawnEnemy() {
    if (enemies.length <= maxNumberOfEnemies) {
        const radius = Math.random() * (maxEnemyRadius - minEnemyRadius) + minEnemyRadius;
        // const pos = randomCirclePosition(board.center.x, board.center.y, board.height / 2);
        const pos = randomBoardPosition(radius);
        const direction = unitVector(player.x - pos.x, player.y - pos.y);
        const velX = direction.x * 2;
        const velY = direction.y * 2;

        const color = `hsl(${Math.random() * 360}, 50%, 50%)`;

        const enemy = new Enemy(pos.x, pos.y, radius, color, velX, velY);
        enemies.push(enemy);
    }
}

function handleEnemies() {
    enemies.forEach((e, i) => {
        e.update();
        e.draw();
        if (outOfBoundary(e.x, e.y, e.radius) || (e.radius < minEnemyRadius)) {
            deleteIndex(enemies, i);
            scoreUpdate(100);
        }
    });
}

// particles
class Particle {
    constructor(x, y, radius, color, velX, velY) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velX = velX;
        this.velY = velY;
        this.alpha = 1.;
    }

    update() {
        const friction = 0.99;
        this.velX *= friction;
        this.velY *= friction;
        this.x += this.velX;
        this.y += this.velY;
        this.alpha -= 0.01;
    }

    draw() {
        context.save();
        context.globalAlpha = this.alpha;
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
        context.restore();
    }
};

function generateParticles(enemy, projectile) {
    const x = projectile.x;
    const y = projectile.y;
    const color = enemy.color;
    for (let i = 0; i < enemy.radius; i += 1) {
        const velX = (Math.random() * 2 - 1) * (4 * Math.random());
        const velY = (Math.random() * 2 - 1) * (4 * Math.random());
        const radius = Math.random() * 2;
        const particle = new Particle(x, y, radius, color, velX, velY);
        particles.push(particle);
    }
}

function handleParticles() {
    particles.forEach((p, i) => {
        p.update();
        if (outOfBoundary(p.x, p.y, p.radius) || (p.alpha < 0)) {
            particles.splice(i, 1);
        } else {
            p.draw();
        }
    });
}

// collision
function handleCollisions() {
    enemies.forEach((e, i) => {
        if (ballCollision(e, player)) {
            gameOver = true;
            return;
        }
        projectiles.forEach((p, j) => {
            if (ballCollision(p, e)) {
                generateParticles(e, p);

                e.shrinkCount += 1;
                deleteIndex(projectiles, j);

                // scoreUpdate(100);
            }
        });
    });
}

// score
function scoreUpdate(val) {
    score += val;
    currentScoreElement.innerHTML = score;
}

// utilities
function outOfBoundary(x, y, r) {
    return (x + r < board.x) ||
           (x - r > board.width + board.x) ||
           (y + r < board.y) ||
           (y - r > board.height + board.y);
}

function vectorSize(x, y) {
    return Math.sqrt(x * x + y * y);
}

function unitVector(x, y) {
    const magnitude = vectorSize(x, y);
    return {
        x: x / magnitude,
        y: y / magnitude,
    };
}

function ballCollision(first, second) {
    const distance = vectorSize(first.x - second.x, first.y - second.y);
    return (distance < (first.radius + second.radius));
}

function clamp(n, min, max) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

function randomCirclePosition(x, y, radius) {
    // Placing enemies in the perimeter of a circle for now
    const angle = Math.random() * 2 * Math.PI;
    return {
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
    };
}

function deleteIndex(array, index) {
    setTimeout(() => {
        array.splice(index, 1);
    });
}

function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// animate
function animate() {
    context.fillStyle = "rgba(0, 0, 0, .1)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    board.draw();

    handlePlayer();
    handleProjectiles();
    handleEnemies();
    handleCollisions();
    handleParticles();

    if (!gameOver) {
        window.requestAnimationFrame(animate);
    } else {
        finalScoreElement.innerHTML = score;
        gameOverContainer.style.display = "flex";
    }
}

// restart game

function restartGame() {
    projectiles.splice(0, projectiles.length);
    enemies.splice(0, enemies.length);
    particles.splice(0, particles.length);
    player.reset();
    score = 0;
    gameOver = false;
}

// start game
function startGame() {
    restartGame();
    setInterval(spawnEnemy, spawnRate);
    animate();
    currentScoreElement.innerHTML = 0;
    gameOverContainer.style.display = "none";
}

startGameButton.addEventListener("click", (event) => {
    startGame()
});
