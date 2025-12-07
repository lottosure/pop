// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Matter.js setup
const { Engine, World, Bodies, Body } = Matter;
const engine = Engine.create();
engine.gravity.y = 0.3; // Reduced gravity for better control

// Game state
let gameState = 'playing'; // 'playing', 'gameover', 'won'
let temperature = 50;
let scrollSpeed = 5;
let distanceTraveled = 0;
let targetDistance = 2000; // Distance to win
let obstaclesPassed = 0;
let maxObstacles = 20;

// Balloon setup (Matter.js body)
const balloonX = 200;
const balloonRadius = 40;
const balloon = Bodies.circle(balloonX, canvas.height / 2, balloonRadius, {
    restitution: 0.3,
    friction: 0.01,
    frictionAir: 0.02,
    density: 0.001,
    render: { fillStyle: '#FF6B6B' }
});
World.add(engine.world, balloon);

// Gas molecules for visualization
class Molecule {
    constructor() {
        this.angle = Math.random() * Math.PI * 2;
        this.distance = Math.random() * (balloonRadius - 5);
        this.speed = 0;
        this.vx = 0;
        this.vy = 0;
    }

    update(temp) {
        const tempFactor = temp / 50; // Normalized temperature
        this.speed = 1 + tempFactor * 4; // Speed based on temperature

        // Random movement
        this.vx += (Math.random() - 0.5) * this.speed;
        this.vy += (Math.random() - 0.5) * this.speed;

        // Apply drag
        this.vx *= 0.95;
        this.vy *= 0.95;

        // Update position
        const localX = this.distance * Math.cos(this.angle);
        const localY = this.distance * Math.sin(this.angle);

        const newX = localX + this.vx;
        const newY = localY + this.vy;

        // Keep within balloon
        const dist = Math.sqrt(newX * newX + newY * newY);
        if (dist > balloonRadius - 5) {
            this.angle = Math.atan2(newY, newX) + Math.PI;
            this.distance = balloonRadius - 5;
            this.vx *= -0.8;
            this.vy *= -0.8;
        } else {
            this.angle = Math.atan2(newY, newX);
            this.distance = dist;
        }
    }

    draw(x, y) {
        const moleculeX = x + this.distance * Math.cos(this.angle);
        const moleculeY = y + this.distance * Math.sin(this.angle);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(moleculeX, moleculeY, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

const molecules = Array.from({ length: 20 }, () => new Molecule());

// Obstacles
class Obstacle {
    constructor(type) {
        this.type = type; // 'mountain' or 'cloud'
        this.x = canvas.width + 50;
        this.passed = false;

        if (type === 'mountain') {
            this.y = canvas.height - 80;
            this.height = 80 + Math.random() * 120;
            this.width = 80;
        } else { // cloud or bird
            this.y = 50 + Math.random() * (canvas.height - 200);
            this.radius = 30 + Math.random() * 20;
        }
    }

    update() {
        this.x -= scrollSpeed;

        // Check if passed
        if (!this.passed && this.x < balloonX - 50) {
            this.passed = true;
            obstaclesPassed++;
        }
    }

    draw() {
        if (this.type === 'mountain') {
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.width / 2, this.y + this.height);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height);
            ctx.closePath();
            ctx.fill();

            // Snow cap
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.width / 4, this.y + this.height / 3);
            ctx.lineTo(this.x + this.width / 4, this.y + this.height / 3);
            ctx.closePath();
            ctx.fill();
        } else {
            // Cloud
            ctx.fillStyle = '#B0C4DE';
            ctx.beginPath();
            ctx.arc(this.x - this.radius / 2, this.y, this.radius * 0.6, 0, Math.PI * 2);
            ctx.arc(this.x, this.y - this.radius / 4, this.radius * 0.8, 0, Math.PI * 2);
            ctx.arc(this.x + this.radius / 2, this.y, this.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    checkCollision(balloonPos) {
        if (this.type === 'mountain') {
            // Triangle collision
            const inXRange = balloonPos.x + balloonRadius > this.x - this.width / 2 &&
                balloonPos.x - balloonRadius < this.x + this.width / 2;
            const mountainTop = this.y + (this.height * (1 - Math.abs(balloonPos.x - this.x) / (this.width / 2)));
            const inYRange = balloonPos.y + balloonRadius > mountainTop;
            return inXRange && inYRange;
        } else {
            // Circle collision
            const dx = balloonPos.x - this.x;
            const dy = balloonPos.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < balloonRadius + this.radius;
        }
    }
}

let obstacles = [];
let obstacleTimer = 0;

// Cloud background
class Cloud {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height * 0.6;
        this.size = 40 + Math.random() * 40;
        this.speed = 1 + Math.random() * 2;
    }

    update() {
        this.x -= this.speed;
        if (this.x < -this.size * 2) {
            this.x = canvas.width + this.size;
            this.y = Math.random() * canvas.height * 0.6;
        }
    }

    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x - this.size / 2, this.y, this.size * 0.5, 0, Math.PI * 2);
        ctx.arc(this.x, this.y - this.size / 3, this.size * 0.7, 0, Math.PI * 2);
        ctx.arc(this.x + this.size / 2, this.y, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

const backgroundClouds = Array.from({ length: 8 }, () => new Cloud());

// UI Elements
const slider = document.getElementById('temperatureSlider');
const tempValue = document.getElementById('temperatureValue');
const gameMessage = document.getElementById('gameMessage');
const restartButton = document.getElementById('restartButton');

// Temperature control
slider.addEventListener('input', (e) => {
    temperature = parseInt(e.target.value);
    tempValue.textContent = temperature + '°C';
});

// Keyboard control
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        temperature = Math.min(100, temperature + 2);
        slider.value = temperature;
        tempValue.textContent = temperature + '°C';
    } else if (e.key === 'ArrowDown') {
        temperature = Math.max(0, temperature - 2);
        slider.value = temperature;
        tempValue.textContent = temperature + '°C';
    }
});

// Restart button
restartButton.addEventListener('click', () => {
    location.reload();
});

// Physics update
function applyBuoyancy() {
    if (gameState !== 'playing') return;

    // Calculate buoyancy force based on temperature
    // At 0°C: +0.008 (descends), At 50°C: -0.002 (balanced), At 100°C: -0.012 (ascends strongly)
    // Note: Negative Y = UP in canvas coordinates!
    const tempFactor = temperature / 100;
    const buoyancyForce = tempFactor * 0.020 - 0.008;

    Body.applyForce(balloon, balloon.position, { x: 0, y: -buoyancyForce });

    // Keep balloon within bounds
    if (balloon.position.y < balloonRadius) {
        Body.setPosition(balloon, { x: balloon.position.x, y: balloonRadius });
        Body.setVelocity(balloon, { x: balloon.velocity.x, y: Math.max(0, balloon.velocity.y) });
    }
    if (balloon.position.y > canvas.height - balloonRadius) {
        Body.setPosition(balloon, { x: balloon.position.x, y: canvas.height - balloonRadius });
        Body.setVelocity(balloon, { x: balloon.velocity.x, y: Math.min(0, balloon.velocity.y) });
    }
}

// Spawn obstacles
function spawnObstacle() {
    if (obstaclesPassed >= maxObstacles) return;

    const type = Math.random() > 0.5 ? 'mountain' : 'cloud';
    obstacles.push(new Obstacle(type));
}

// Draw balloon
function drawBalloon() {
    const pos = balloon.position;

    // Glow effect when hot
    if (temperature > 70) {
        const glowIntensity = (temperature - 70) / 30;
        ctx.shadowBlur = 30 * glowIntensity;
        ctx.shadowColor = '#FF4444';
    }

    // Balloon envelope (colorful stripes)
    const stripeColors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9D4EDD'];
    const stripeAngle = Math.PI * 2 / stripeColors.length;

    stripeColors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, balloonRadius,
            stripeAngle * i, stripeAngle * (i + 1));
        ctx.lineTo(pos.x, pos.y);
        ctx.closePath();
        ctx.fill();
    });

    // Reset shadow
    ctx.shadowBlur = 0;

    // Basket
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(pos.x - 15, pos.y + balloonRadius + 5, 30, 25);
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x - 15, pos.y + balloonRadius + 5, 30, 25);

    // Ropes
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x - 12, pos.y + balloonRadius);
    ctx.lineTo(pos.x - 15, pos.y + balloonRadius + 5);
    ctx.moveTo(pos.x + 12, pos.y + balloonRadius);
    ctx.lineTo(pos.x + 15, pos.y + balloonRadius + 5);
    ctx.stroke();

    // Burner flame
    if (temperature > 30) {
        const flameSize = (temperature - 30) / 70 * 15;
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y + balloonRadius + 8, flameSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y + balloonRadius + 8, flameSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw molecules
function drawMolecules() {
    molecules.forEach(mol => {
        mol.update(temperature);
        mol.draw(balloon.position.x, balloon.position.y);
    });
}

// Fireworks effect
function createFireworks() {
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = Math.random() * window.innerWidth + 'px';
            firework.style.top = Math.random() * window.innerHeight + 'px';
            firework.style.background = `hsl(${Math.random() * 360}, 100%, 50%)`;
            document.body.appendChild(firework);

            setTimeout(() => firework.remove(), 1000);
        }, i * 50);
    }
}

// Game over
function gameOver() {
    gameState = 'gameover';
    gameMessage.textContent = '💥 GAME OVER';
    gameMessage.style.color = '#e74c3c';
    gameMessage.style.display = 'block';
    restartButton.style.display = 'block';
}

// Win
function win() {
    gameState = 'won';
    gameMessage.textContent = '🎉 GOAL!';
    gameMessage.style.color = '#FFD700';
    gameMessage.style.display = 'block';
    restartButton.style.display = 'block';
    createFireworks();
}

// Update HUD
function updateHUD() {
    const progress = Math.max(0, 100 - (obstaclesPassed / maxObstacles * 100));
    document.getElementById('distance').textContent = Math.round(progress) + '%';
    document.getElementById('currentTemp').textContent = temperature;
    document.getElementById('speed').textContent = scrollSpeed;
}

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background clouds
    backgroundClouds.forEach(cloud => {
        cloud.update();
        cloud.draw();
    });

    if (gameState === 'playing') {
        // Update physics
        Engine.update(engine);
        applyBuoyancy();

        // Update obstacles
        obstacleTimer++;
        if (obstacleTimer > 100) {
            spawnObstacle();
            obstacleTimer = 0;
        }

        obstacles.forEach((obs, i) => {
            obs.update();
            obs.draw();

            // Check collision
            if (obs.checkCollision(balloon.position)) {
                gameOver();
            }

            // Remove off-screen obstacles
            if (obs.x < -200) {
                obstacles.splice(i, 1);
            }
        });

        // Check win condition
        if (obstaclesPassed >= maxObstacles) {
            win();
        }

        distanceTraveled += scrollSpeed;
    }

    // Draw balloon and molecules
    drawBalloon();
    drawMolecules();

    // Update HUD
    updateHUD();

    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();

// Responsive canvas
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
