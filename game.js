const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const healthBar = document.getElementById('healthBar');
const furyBar = document.getElementById('furyBar');
const healthText = document.getElementById('healthText');
const furyText = document.getElementById('furyText');
const messageBanner = document.getElementById('messageBanner');
const joystickBase = document.getElementById('joystickBase');
const joystickKnob = document.getElementById('joystickKnob');
const attackButton = document.getElementById('attackButton');
const transformButton = document.getElementById('transformButton');
const dashButton = document.getElementById('dashButton');

const world = {
  w: 2200,
  h: 1800,
};

const keys = {};
const mouse = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5, down: false };

let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;
let DPR = Math.min(window.devicePixelRatio || 1, 2);
let camera = { x: 0, y: 0 };

const player = {
  x: world.w / 2,
  y: world.h / 2,
  r: 22,
  baseSpeed: 250,
  speed: 250,
  hp: 100,
  maxHp: 100,
  fury: 0,
  maxFury: 100,
  face: 0,
  transformed: false,
  attackCooldown: 0,
  dashCooldown: 0,
  dashTime: 0,
  hitFlash: 0,
  attackSwing: 0,
  runCycle: 0,
};

const particles = [];
const enemies = [];
const pickups = [];

const virtualPad = {
  active: false,
  pointerId: null,
  centerX: 60,
  centerY: HEIGHT - 100,
  maxDist: 38,
  dx: 0,
  dy: 0,
};

function resize() {
  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WIDTH * DPR;
  canvas.height = HEIGHT * DPR;
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  virtualPad.centerY = HEIGHT - 110;
}
window.addEventListener('resize', resize);
resize();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function showBanner(text) {
  messageBanner.textContent = text;
  messageBanner.classList.add('show');
  clearTimeout(showBanner.timeout);
  showBanner.timeout = setTimeout(() => {
    messageBanner.classList.remove('show');
  }, 1100);
}

function spawnParticles(x, y, color, count = 12, speed = 140) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const spd = rand(speed * 0.45, speed);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: rand(0.3, 0.9),
      color,
      size: rand(2, 5),
    });
  }
}

function spawnEnemy() {
  const pad = 180;
  let x = rand(pad, world.w - pad);
  let y = rand(pad, world.h - pad);
  let attempts = 0;

  while (dist(player, { x, y }) < 260 && attempts < 40) {
    x = rand(pad, world.w - pad);
    y = rand(pad, world.h - pad);
    attempts++;
  }

  enemies.push({
    x,
    y,
    r: rand(18, 28),
    hp: 42,
    maxHp: 42,
    speed: rand(75, 100),
    damage: 10,
    hitFlash: 0,
    attackCooldown: rand(0.7, 1.3),
    dead: false,
  });
}

function spawnPickup(x, y, type = 'fury') {
  pickups.push({
    x,
    y,
    r: 10,
    type,
    pulse: rand(0, Math.PI * 2),
  });
}

function createInitialEnemies() {
  for (let i = 0; i < 10; i++) spawnEnemy();
}
createInitialEnemies();

function playerAimFromPointer(px, py) {
  const dx = px - WIDTH / 2;
  const dy = py - HEIGHT / 2;
  player.face = Math.atan2(dy, dx);
}

function handlePointerMove(clientX, clientY) {
  mouse.x = clientX;
  mouse.y = clientY;
  playerAimFromPointer(clientX, clientY);
}

window.addEventListener('pointermove', (event) => {
  handlePointerMove(event.clientX, event.clientY);
});

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') {
    mouse.down = true;
    handlePointerMove(event.clientX, event.clientY);
  }
});

window.addEventListener('pointerup', () => {
  mouse.down = false;
});

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;
  if (event.code === 'Space' || event.code === 'KeyE') {
    event.preventDefault();
    transformForm();
  }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    dash();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

function startAttack() {
  if (player.attackCooldown > 0) return;
  player.attackCooldown = player.transformed ? 0.38 : 0.48;
  player.attackSwing = 1;

  const slashAngle = player.face;
  const range = player.transformed ? 120 : 80;
  const damage = player.transformed ? 22 : 11;

  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distToEnemy = Math.hypot(dx, dy);
    if (distToEnemy > range || distToEnemy === 0) continue;

    const enemyAngle = Math.atan2(dy, dx);
    const diff = Math.abs(Math.atan2(Math.sin(enemyAngle - slashAngle), Math.cos(enemyAngle - slashAngle)));

    if (diff < (player.transformed ? 1.25 : 0.8)) {
      enemy.hp -= damage;
      enemy.hitFlash = 0.2;
      spawnParticles(enemy.x, enemy.y, player.transformed ? '#ff9a7a' : '#ffc76e', 12, 150);
      if (enemy.hp <= 0) {
        enemy.dead = true;
        player.fury = clamp(player.fury + 18, 0, 100);
        spawnPickup(enemy.x, enemy.y, 'fury');
      }
    }
  }

  if (player.transformed) {
    spawnParticles(player.x + Math.cos(player.face) * 18, player.y + Math.sin(player.face) * 18, '#ff9b66', 16, 200);
  } else {
    spawnParticles(player.x + Math.cos(player.face) * 18, player.y + Math.sin(player.face) * 18, '#ffd76f', 12, 160);
  }
}

function transformForm() {
  if (player.fury < 50) {
    showBanner('FURY TOO LOW');
    return;
  }

  player.transformed = !player.transformed;
  if (player.transformed) {
    player.speed = player.baseSpeed * 1.45;
    showBanner('DEVIL FORM');
    spawnParticles(player.x, player.y, '#ff5f5f', 25, 220);
  } else {
    player.speed = player.baseSpeed;
    showBanner('HUMAN FORM');
    spawnParticles(player.x, player.y, '#dfeeff', 20, 170);
  }
}

function dash() {
  if (player.dashCooldown > 0) return;

  const vx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const vy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);

  const pushX = (virtualPad.dx || vx || Math.cos(player.face));
  const pushY = (virtualPad.dy || vy || Math.sin(player.face));
  const length = Math.hypot(pushX, pushY) || 1;

  player.x += (pushX / length) * 120;
  player.y += (pushY / length) * 120;
  player.x = clamp(player.x, player.r, world.w - player.r);
  player.y = clamp(player.y, player.r, world.h - player.r);

  player.dashCooldown = 1.3;
  player.dashTime = 0.16;
  spawnParticles(player.x, player.y, '#cfe3ff', 18, 210);
}

function updateHud() {
  const hpPct = (player.hp / player.maxHp) * 100;
  const furyPct = (player.fury / player.maxFury) * 100;
  healthBar.style.width = hpPct + '%';
  furyBar.style.width = furyPct + '%';
  healthText.textContent = Math.ceil(player.hp) + ' / ' + player.maxHp;
  furyText.textContent = Math.ceil(player.fury) + ' / ' + player.maxFury;
}

function update(dt) {
  const moveX = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const moveY = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);

  let dx = moveX * player.speed * dt;
  let dy = moveY * player.speed * dt;

  if (virtualPad.active) {
    dx = virtualPad.dx * player.speed * dt;
    dy = virtualPad.dy * player.speed * dt;
  }

  if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
    const angle = Math.atan2(dy, dx);
    player.face = angle;
  }

  player.x += dx;
  player.y += dy;
  player.x = clamp(player.x, player.r, world.w - player.r);
  player.y = clamp(player.y, player.r, world.h - player.r);

  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.dashTime = Math.max(0, player.dashTime - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);
  player.attackSwing = Math.max(0, player.attackSwing - dt * 3.5);
  player.runCycle += (Math.hypot(dx, dy) > 0 ? 1 : 0) * dt * 14;

  if (mouse.down && player.attackCooldown <= 0) {
    startAttack();
  }

  if (player.transformed) {
    player.fury = clamp(player.fury - dt * 10, 0, 100);
    if (player.fury <= 0) {
      player.transformed = false;
      player.speed = player.baseSpeed;
      showBanner('FORM COLLAPSE');
    }
  } else {
    player.fury = clamp(player.fury + dt * 9.5, 0, 100);
  }

  for (const enemy of enemies) {
    if (enemy.dead) continue;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.attackCooldown -= dt;

    const dxEnemy = player.x - enemy.x;
    const dyEnemy = player.y - enemy.y;
    const distEnemy = Math.hypot(dxEnemy, dyEnemy) || 1;
    const nx = dxEnemy / distEnemy;
    const ny = dyEnemy / distEnemy;

    if (distEnemy > 1) {
      enemy.x += nx * enemy.speed * dt * (distEnemy < 160 ? 1.2 : 0.82);
      enemy.y += ny * enemy.speed * dt * (distEnemy < 160 ? 1.2 : 0.82);
    }

    if (distEnemy < enemy.r + player.r + 6 && enemy.attackCooldown <= 0) {
      player.hp -= enemy.damage;
      player.hitFlash = 0.2;
      enemy.attackCooldown = 1.2;
      spawnParticles(player.x, player.y, '#ff5f5f', 12, 140);

      if (player.hp <= 0) {
        player.hp = player.maxHp;
        player.fury = 0;
        player.transformed = false;
        player.speed = player.baseSpeed;
        player.x = world.w / 2;
        player.y = world.h / 2;
        showBanner('YOU WERE DEFEATED');
      }
    }
  }

  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    const d = Math.hypot(player.x - pickup.x, player.y - pickup.y);
    if (d < player.r + pickup.r + 6) {
      if (pickup.type === 'fury') {
        player.fury = clamp(player.fury + 25, 0, 100);
      }
      pickups.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].dead) {
      enemies.splice(i, 1);
      spawnEnemy();
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  camera.x += (player.x - WIDTH * 0.5 - camera.x) * 0.12;
  camera.y += (player.y - HEIGHT * 0.5 - camera.y) * 0.12;

  updateHud();
}

function drawBackground() {
  ctx.fillStyle = '#0a1118';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  ctx.fillStyle = '#111e2a';
  ctx.fillRect(0, 0, world.w, world.h);

  const grid = 80;
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.w; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.h);
    ctx.stroke();
  }
  for (let y = 0; y <= world.h; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.w, y);
    ctx.stroke();
  }

  for (let i = 0; i < 18; i++) {
    const bx = (i * 160) % world.w;
    const by = (i * 104) % world.h;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,117,110,0.025)';
    ctx.fillRect(bx, by, 120, 60);
  }

  ctx.restore();
}

function drawPlayer() {
  const px = player.x - camera.x;
  const py = player.y - camera.y;

  ctx.save();
  ctx.translate(px, py);

  if (player.transformed) {
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 110, 90, 0.26)';
    ctx.arc(0, 0, player.r + 18, 0, Math.PI * 2);
    ctx.fill();
  }

  const bodyColor = player.transformed ? '#ff5e46' : '#dfe9f6';
  const highlight = player.transformed ? '#ffc4aa' : '#9bb7d8';

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, player.r + 14, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#161d2b';
  ctx.beginPath();
  ctx.arc(0, -10, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-18, -2, 36, 44, 12);
  ctx.fill();

  ctx.fillStyle = player.transformed ? '#ffb29b' : '#ff5a5a';
  ctx.fillRect(-12, 0, 24, 7);

  const swing = Math.sin(player.runCycle) * 18;
  const armSwing = player.attackSwing > 0 ? 48 : swing;
  const armLen = player.transformed ? 26 : 18;

  for (const sign of [-1, 1]) {
    const ax = Math.cos(player.face + (sign * 0.7)) * armLen;
    const ay = Math.sin(player.face + (sign * 0.7)) * armLen;
    ctx.strokeStyle = highlight;
    ctx.lineWidth = player.transformed ? 8 : 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sign * 9, 8);
    ctx.lineTo(sign * 9 + ax, 8 + ay + (sign * armSwing * 0.2));
    ctx.stroke();
  }

  const legShift = Math.sin(player.runCycle) * 8;
  ctx.strokeStyle = '#182333';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-7, 42);
  ctx.lineTo(-10 + legShift, 56);
  ctx.moveTo(7, 42);
  ctx.lineTo(10 - legShift, 56);
  ctx.stroke();

  if (player.attackCooldown > 0.12) {
    ctx.beginPath();
    const start = player.face - (player.transformed ? 0.9 : 0.65);
    const end = player.face + (player.transformed ? 0.9 : 0.65);
    ctx.arc(0, 0, player.transformed ? 90 : 72, start, end, false);
    ctx.strokeStyle = player.transformed ? 'rgba(255,168,120,0.95)' : 'rgba(255,220,140,0.9)';
    ctx.lineWidth = player.transformed ? 12 : 8;
    ctx.stroke();
  }

  if (player.transformed) {
    ctx.strokeStyle = '#ffe2d7';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const angle = player.face + (i - 2) * 0.45;
      const x1 = Math.cos(angle) * (player.r + 18);
      const y1 = Math.sin(angle) * (player.r + 18);
      const x2 = Math.cos(angle) * (player.r + 32);
      const y2 = Math.sin(angle) * (player.r + 32);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  if (player.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + player.hitFlash * 0.8})`;
    ctx.beginPath();
    ctx.arc(0, 0, player.r + 18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    const ex = enemy.x - camera.x;
    const ey = enemy.y - camera.y;

    ctx.save();
    ctx.translate(ex, ey);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, enemy.r + 17, enemy.r + 4, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = enemy.hitFlash > 0 ? '#ffc0c7' : '#7d2138';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1d0d14';
    ctx.beginPath();
    ctx.arc(0, -6, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff6b7f';
    ctx.fillRect(-enemy.r, enemy.r + 10, enemy.r * 2, 5);
    ctx.fillStyle = '#ffb3bf';
    ctx.fillRect(-enemy.r, enemy.r + 10, (enemy.hp / enemy.maxHp) * enemy.r * 2, 5);

    ctx.restore();
  }
}

function drawPickups() {
  for (const item of pickups) {
    const px = item.x - camera.x;
    const py = item.y - camera.y;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(performance.now() * 0.008 + item.pulse);

    ctx.fillStyle = '#ffcf6c';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * 2 / 6) * i;
      const radius = i % 2 === 0 ? 9 : 5;
      const x = Math.cos(ang) * radius;
      const y = Math.sin(ang) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 1.7);
    ctx.fillRect(p.x - camera.x, p.y - camera.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawPickups();
  drawParticles();
  drawEnemies();
  drawPlayer();
}

function bindVirtualJoystick() {
  const updateFromPointer = (clientX, clientY) => {
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, virtualPad.maxDist);
    const ang = Math.atan2(dy, dx);

    const tx = Math.cos(ang) * clamped;
    const ty = Math.sin(ang) * clamped;
    virtualPad.dx = dist > 2 ? tx / virtualPad.maxDist : 0;
    virtualPad.dy = dist > 2 ? ty / virtualPad.maxDist : 0;

    joystickKnob.style.transform = `translate(${tx - 23}px, ${ty - 23}px)`;
  };

  joystickBase.addEventListener('pointerdown', (event) => {
    virtualPad.active = true;
    virtualPad.pointerId = event.pointerId;
    joystickBase.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  });

  joystickBase.addEventListener('pointermove', (event) => {
    if (!virtualPad.active || event.pointerId !== virtualPad.pointerId) return;
    updateFromPointer(event.clientX, event.clientY);
  });

  const releasePad = (event) => {
    if (event.pointerId !== virtualPad.pointerId) return;
    virtualPad.active = false;
    virtualPad.dx = 0;
    virtualPad.dy = 0;
    joystickKnob.style.transform = 'translate(-50%, -50%)';
  };

  joystickBase.addEventListener('pointerup', releasePad);
  joystickBase.addEventListener('pointercancel', releasePad);
}

attackButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  startAttack();
});

transformButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  transformForm();
});

dashButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  dash();
});

bindVirtualJoystick();

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

showBanner('DEVIL FORM READY');
