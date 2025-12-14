import './style.css';



// set active menu item (Играть)
(function setActiveLink(){
  const baseDir = window.location.pathname.replace(/\/[^\/]*$/, '');
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link-mob, .nav-link');
  navLinks.forEach((link) => {
    let linkPath = link.getAttribute('href');
    if (linkPath) linkPath = `${baseDir}${linkPath.replace('./', '/')}`;
    if (linkPath === currentPath) link.classList.add('active');
  });
})();

// Controls wiring (moved below UI elements)

// UI elements
const startBtn = document.getElementById('start') as HTMLButtonElement | null;
// land button removed: auto-landing implemented
const fullscreenBtn = document.getElementById('fullscreen') as HTMLButtonElement | null;
const resetBtn = document.getElementById('reset') as HTMLButtonElement | null;
const cashoutBtn = document.getElementById('cashout') as HTMLButtonElement | null;
const multiplierEl = document.getElementById('multiplier') as HTMLElement | null;
const scoreEl = document.getElementById('score') as HTMLElement | null;
const statusEl = document.getElementById('status') as HTMLElement | null;
const _canvasEl = document.getElementById('canvas');
if (!(_canvasEl instanceof HTMLCanvasElement)) throw new Error('Canvas not found');
const canvas = _canvasEl;
const ctx = canvas.getContext('2d')!;

// Game state
let running = false;
let crashed = false;
let falling = false;
let multiplier = 1.0;
let score = 0;
let lastTime = 0;
let crashAt = 0; // multiplier at which crash happens

// Plane physics
let planeX = 60;
let planeY = 120;
let planeVY = 0;
let planeVX = 160; // px/s
let planeAngle = 0;
let isUp = false;
// autopilot threshold (multiplier until which plane tries to climb)
let ascendUntil = 1.5;
// failure display timer (timestamp until which 'НЕУДАЧА' is shown)
let failureUntil: number | null = null;

// Static obstacles and bonuses
type Bonus = { x: number; y: number; type: number; used?: boolean };
type Rocket = { x: number; y: number; r: number; hit?: boolean };
type MultNode = { x: number; y: number; value: number; hit?: boolean };
const bonuses: Bonus[] = [];
const rockets: Rocket[] = [];
const mults: MultNode[] = [];
type Carrier = { x: number; y: number; w: number; h: number; tried?: boolean };
const carriers: Carrier[] = [];

// Helpers
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function formatMult(n: number) { return n.toFixed(2) + 'x'; }

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = Math.round(cssW * ratio);
  canvas.height = Math.round(cssH * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function generateLevel() {
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  // clear lists
  bonuses.length = 0;
  rockets.length = 0;
  mults.length = 0;
  carriers.length = 0;

  // create multiple carriers spaced across the playable width
  const carrierCount = Math.max(1, Math.floor(cw / 360));
  const startX = 200;
  const span = Math.max(200, cw - 400);
  const spacingCar = carrierCount > 1 ? span / (carrierCount - 1) : 0;
  for (let i = 0; i < carrierCount; i++) {
    const cx = startX + i * spacingCar;
    carriers.push({ x: cx, y: ch - 40, w: 220, h: 36, tried: false });
  }

  // bonuses (static)
  const bonusTypes = [1, 5, 10, 2, 5];
  for (let i = 0; i < bonusTypes.length; i++) {
    const bx = 100 + i * 110;
    const by = ch - 140 - ((i % 2) * 36);
    bonuses.push({ x: bx, y: by, type: bonusTypes[i] });
  }

  // rockets: put several around carriers
  for (const c of carriers) {
    const rcount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rcount; i++) {
      const rx = c.x + Math.random() * (c.w + 120) - 40;
      const ry = c.y - 60 - Math.random() * 80;
      rockets.push({ x: rx, y: ry, r: 10 });
    }
  }

  // multiplier nodes (values similar to aviator multipliers), spread across level
  const multValues = [1.05, 1.1, 1.2, 1.4, 1.8, 2.6, 3.5, 5, 8, 12];
  const totalNodes = Math.max(8, multValues.length * carriers.length);
  const nodeStart = 120;
  const nodeEnd = Math.max(cw - 120, nodeStart + 300);
  const nodeSpacing = (nodeEnd - nodeStart) / Math.max(1, totalNodes - 1);
  for (let i = 0; i < totalNodes; i++) {
    const mx = nodeStart + i * nodeSpacing + (Math.random() - 0.5) * 24;
    const my = ch - 140 - ((i % 2) * 24) + (Math.sin(i) * 12);
    const idx = Math.min(multValues.length - 1, Math.floor(i / Math.max(1, totalNodes / multValues.length)));
    const v = multValues[idx] || 1.1;
    mults.push({ x: mx, y: my, value: v, hit: false });
  }
}

function resetGame() {
  running = false;
  crashed = false;
  multiplier = 1.0;
  lastTime = performance.now();
  score = 0;
  planeX = 60;
  planeY = canvas.clientHeight - 120;
  planeVY = 0;
  planeAngle = 0;
  multiplierEl && (multiplierEl.textContent = formatMult(multiplier));
  scoreEl && (scoreEl.textContent = String(score));
  statusEl && (statusEl.textContent = 'Ожидание');
  cashoutBtn && (cashoutBtn.disabled = true);
  startBtn && (startBtn.disabled = false);
  generateLevel();
  draw();
}


function randomCrash() {
  // random crash multiplier 2..8
  return 2 + Math.random() * 8;
}

function startRound() {
  if (running) return;
  crashAt = randomCrash();
  console.log('game: startRound crashAt=', crashAt);
  // set ascend threshold relative to crash multiplier
  ascendUntil = crashAt * (0.35 + Math.random() * 0.25);
  console.log('game: ascendUntil=', ascendUntil.toFixed(2));
  running = true;
  crashed = false;
  lastTime = performance.now();
  planeX = 60;
  planeY = canvas.clientHeight - 120;
  planeVY = 0;
  multiplier = 1.0;
  startBtn && (startBtn.disabled = true);
  cashoutBtn && (cashoutBtn.disabled = false);
  statusEl && (statusEl.textContent = 'В полёте');
  requestAnimationFrame(loop);
}

function cashout() {
  if (!running || crashed) return;
  running = false;
  cashoutBtn && (cashoutBtn.disabled = true);
  const reward = Math.round(multiplier * 10);
  score += reward;
  scoreEl && (scoreEl.textContent = String(score));
  statusEl && (statusEl.textContent = `Вы забрали: ${formatMult(multiplier)} (+${reward})`);
  startBtn && (startBtn.disabled = false);
}

// manual landing removed (auto-landing implemented)

// landing state for current pass
let landingTried = false;


function loop(now: number) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (running) {
    // autopilot: target the next multiplier node
    const next = mults.find(m => !m.hit && m.x > planeX);
    let desiredUp = false;
    if (next) {
      // aim slightly above the node to 'hit' it
      desiredUp = planeY > next.y - 6;
    } else {
      // no next node: try to gently descend towards carrier height
      desiredUp = planeY > (carrier.y - 60);
    }
    isUp = desiredUp;

    // update plane position
    planeX += planeVX * dt;
    planeVY += isUp ? -420 * dt : 420 * dt; // gentler up/down
    planeY += planeVY * dt;
    planeAngle = clamp(-planeVY / 240, -0.7, 0.7);

    // limits
    const minY = 24;
    const maxY = canvas.clientHeight - 24;
    if (planeY < minY) { planeY = minY; planeVY = 0; }
    if (planeY > maxY) {
      if (falling) {
        // fell into water — show failure and reset after delay
        running = false;
        falling = false;
        multiplier = 1.0;
        multiplierEl && (multiplierEl.textContent = formatMult(multiplier));
        statusEl && (statusEl.textContent = 'НЕУДАЧА');
        cashoutBtn && (cashoutBtn.disabled = true);
        startBtn && (startBtn.disabled = true);
        planeY = maxY;
        planeVY = 0;
        if (!failureUntil) {
          failureUntil = performance.now() + 5000;
          setTimeout(() => {
            failureUntil = null;
            resetGame();
          }, 5000);
        }
      } else {
        planeY = maxY; planeVY = 0;
      }
    }

    // check collisions with rockets
    for (const r of rockets) {
      if (r.hit) continue;
      const dx = planeX - r.x; const dy = planeY - r.y;
      const rr = r.r + 10;
      if (dx * dx + dy * dy < rr * rr) {
        // hit by rocket: start falling but don't stop the loop immediately
        r.hit = true;
        falling = true;
        planeVY = Math.max(planeVY, 800);
        statusEl && (statusEl.textContent = `Сбит ракетой — падает`);
        cashoutBtn && (cashoutBtn.disabled = true);
      }
    }

    // bonuses collision
    for (const b of bonuses) {
      if (b.used) continue;
      const dx = planeX - b.x; const dy = planeY - b.y;
      if (dx * dx + dy * dy < (10 + 12) * (10 + 12)) {
        b.used = true;
        score += b.type * 20;
        scoreEl && (scoreEl.textContent = String(score));
        // visual feedback
        statusEl && (statusEl.textContent = `Бонус x${b.type} собран`);
      }
    }

    // multiplier nodes collision: only when touching node multiplier changes
    for (const m of mults) {
      if (m.hit) continue;
      const dx = planeX - m.x; const dy = planeY - m.y;
      if (dx * dx + dy * dy < 18 * 18) {
        m.hit = true;
        multiplier = m.value;
        multiplierEl && (multiplierEl.textContent = formatMult(multiplier));
        statusEl && (statusEl.textContent = `Множитель достигнут: ${formatMult(multiplier)}`);
        // if node meets crash threshold — start falling
        if (multiplier >= crashAt) {
          falling = true;
          planeVY = Math.max(planeVY, 800);
          statusEl && (statusEl.textContent = `Краш @ ${formatMult(multiplier)} — падает`);
          cashoutBtn && (cashoutBtn.disabled = true);
          startBtn && (startBtn.disabled = true);
        }
      }
    }

    // crash by multiplier: start falling instead of immediate stop
    if (multiplier >= crashAt) {
      falling = true;
      planeVY = Math.max(planeVY, 800);
      statusEl && (statusEl.textContent = `Краш @ ${formatMult(multiplier)} — падает`);
      cashoutBtn && (cashoutBtn.disabled = true);
      startBtn && (startBtn.disabled = true);
    }

    // wrap plane to left if goes off screen and regenerate level for next pass
    const cw = canvas.clientWidth;
    if (planeX > cw + 80) {
      planeX = -40;
      generateLevel();
    }

    // check passing over each carrier to attempt auto-landing (per-carrier state)
    for (const c of carriers) {
      if (c.tried) continue;
      if (planeX >= c.x - 10 && planeX <= c.x + c.w + 10) {
        c.tried = true;
        // landing chance decreases with higher multiplier (more risk)
        const baseChance = 0.65;
        const penalty = clamp((multiplier - 1) / 6, 0, 0.5);
        const chance = clamp(baseChance - penalty, 0.05, 0.95);
        console.log('game: landing attempt chance=', chance.toFixed(2));
        if (Math.random() < chance && Math.abs(planeVY) < 500) {
          // successful landing — plane aligns to deck
          running = false;
          const reward = Math.round(multiplier * 30);
          score += reward;
          scoreEl && (scoreEl.textContent = String(score));
          statusEl && (statusEl.textContent = `Приземление успешно! +${reward}`);
          cashoutBtn && (cashoutBtn.disabled = true);
          startBtn && (startBtn.disabled = false);
          planeY = c.y - 8;
          planeVY = 0;
        } else {
          // failed — start falling into water; multiplier is lost
          falling = true;
          multiplier = 1.0;
          multiplierEl && (multiplierEl.textContent = formatMult(multiplier));
          statusEl && (statusEl.textContent = 'Самолёт упал в воду — множитель сброшен');
          cashoutBtn && (cashoutBtn.disabled = true);
          startBtn && (startBtn.disabled = true);
          planeVY = Math.max(planeVY, 800);
        }
      }
    }
  draw();
  if (running) requestAnimationFrame(loop);
}

function draw() {
  resizeCanvas();
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  ctx.clearRect(0, 0, cw, ch);

  // background gradient
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#021428');
  g.addColorStop(1, '#002b3e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);

  // water / sea line
  ctx.fillStyle = '#032c3b';
  ctx.fillRect(0, ch - 28, cw, 28);

  // draw carrier
  // draw carrier (runway + deck markings)
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(carrier.x, carrier.y, carrier.w, carrier.h);
  // deck stripe
  ctx.fillStyle = '#d5d8dc';
  ctx.fillRect(carrier.x + 12, carrier.y + 6, carrier.w - 24, 6);
  // center runway line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(carrier.x + carrier.w / 2, carrier.y + 4);
  ctx.lineTo(carrier.x + carrier.w / 2, carrier.y + carrier.h - 4);
  ctx.stroke();

  // draw bonuses
  for (const b of bonuses) {
    if (b.used) continue;
    ctx.fillStyle = '#39d353';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('x' + b.type, b.x - 10, b.y + 5);
  }

  // draw multiplier nodes
  for (const m of mults) {
    ctx.fillStyle = m.hit ? 'rgba(255,255,255,0.06)' : '#ffd166';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '12px sans-serif';
    ctx.fillText(formatMult(m.value), m.x - 14, m.y + 4);
  }

  // draw rockets
  for (const r of rockets) {
    ctx.fillStyle = r.hit ? '#612020' : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.fill();
    // simple rocket nose
    ctx.fillStyle = '#aa0000';
    ctx.fillRect(r.x - 3, r.y - r.r - 6, 6, 4);
  }

  // path line
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, ch - 30);
  const t = clamp(multiplier / 20, 0, 1);
  for (let x = 20; x <= cw - 40; x += 18) {
    const y = ch - 30 - Math.sin((x / cw) * Math.PI * 2) * 28 - t * 90;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // draw plane
  ctx.save();
  ctx.translate(planeX, planeY);
  ctx.rotate(planeAngle);
  // more detailed plane: body, wings, tail
  // body
  ctx.fillStyle = '#e6e6e6';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // cockpit
  ctx.fillStyle = '#2b4b66';
  ctx.fillRect(4, -4, 6, 6);
  // wings
  ctx.fillStyle = '#cfcfcf';
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(10, 14);
  ctx.lineTo(12, 12);
  ctx.lineTo(-4, -2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.lineTo(12, -14);
  ctx.lineTo(10, -12);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fill();
  // tail
  ctx.fillStyle = '#aab7c2';
  ctx.beginPath();
  ctx.moveTo(-14, -3);
  ctx.lineTo(-20, -9);
  ctx.lineTo(-20, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // text overlays (multiplier / status / score)
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Multiplier: ' + formatMult(multiplier), 10, 22);
  ctx.fillText('Score: ' + score, 10, 44);
  // no global CRASHED overlay — handle end of round via status text and plane position

  // draw HUD: upcoming next multiplier
  const next = mults.find(m => !m.hit && m.x > planeX);
  if (next) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Next: ' + formatMult(next.value), cw - 140, 24);
  }

  // Failure overlay (НЕУДАЧА)
  if (failureUntil && performance.now() < failureUntil) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#ff2e2e';
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.fillText('НЕУДАЧА', cw / 2, ch / 2 + 16);
    ctx.textAlign = 'start';
  }
}

// set active menu item (Играть)
(function setActiveLink(){
  const baseDir = window.location.pathname.replace(/\/[^\/]*$/, '');
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link-mob, .nav-link');
  navLinks.forEach((link) => {
    let linkPath = link.getAttribute('href');
    if (linkPath) linkPath = `${baseDir}${linkPath.replace('./', '/')}`;
    if (linkPath === currentPath) link.classList.add('active');
  });
})();

// Controls wiring
startBtn?.addEventListener('click', () => { console.log('game: start clicked'); resetGame(); startRound(); });
fullscreenBtn?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});
resetBtn?.addEventListener('click', () => { resetGame(); });
cashoutBtn?.addEventListener('click', () => { cashout(); });
// toggle fullscreen with 'F'
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'f') { if (!document.fullscreenElement) canvas.requestFullscreen().catch(()=>{}); else document.exitFullscreen().catch(()=>{}); } });

window.addEventListener('resize', () => { generateLevel(); draw(); });

// final init (after UI elements and handlers are attached)
console.log('game: module ready');
resizeCanvas();
generateLevel();
resetGame();
// auto-start one round on load for demo
// no auto-start: require user to press Start button
/** removed final duplicated block **/
