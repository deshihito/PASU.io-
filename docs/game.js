const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const hpEl = document.getElementById('hp');
const coinsEl = document.getElementById('coins');
const zoneEl = document.getElementById('zone');
const hudEl = document.getElementById('hud');
const mapSelectEl = document.getElementById('mapSelect');
const mapListEl = document.getElementById('mapList');

const SERVER_URL = window.location.hostname === 'deshihito.github.io' 
  ? 'https://pasu-io.onrender.com' 
  : window.location.origin;

const socket = io(SERVER_URL);

let players = {};
let blocks = [];
let bullets = [];
let levers = [];
let doors = [];
let movables = [];
let myId = null;
let cameraX = 0;
let cameraY = 0;
let blockSize = 40;

const keys = {};
let mouseX = 0;
let mouseY = 0;
let joystickActive = false;
let joystickDX = 0;
let isMobile = false;

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX + cameraX;
  mouseY = (e.clientY - rect.top) * scaleY + cameraY;
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (touch.clientX - rect.left) * scaleX + cameraX;
  mouseY = (touch.clientY - rect.top) * scaleY + cameraY;
}, { passive: false });

if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  isMobile = true;
}

// ジョイスティック
const joystickArea = document.getElementById('joystickArea');
const joystickStick = document.getElementById('joystickStick');

joystickArea.addEventListener('touchstart', (e) => {
  e.preventDefault();
  joystickActive = true;
  updateJoystick(e.touches[0]);
}, { passive: false });

joystickArea.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (joystickActive) updateJoystick(e.touches[0]);
}, { passive: false });

joystickArea.addEventListener('touchend', () => {
  joystickActive = false;
  joystickDX = 0;
  joystickStick.style.transform = 'translate(-50%, -50%)';
});

function updateJoystick(touch) {
  const rect = joystickArea.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = touch.clientX - centerX;
  const maxDist = 35;
  const dist = Math.min(Math.sqrt(dx*dx), maxDist);
  const dir = dx >= 0 ? 1 : -1;
  joystickDX = (dist / maxDist) * dir;
  const stickX = Math.cos(0) * dist * dir;
  joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), -50%)`;
}

document.getElementById('btnHook').addEventListener('touchstart', (e) => {
  e.preventDefault(); keys['s'] = true;
});
document.getElementById('btnHook').addEventListener('touchend', (e) => {
  e.preventDefault(); keys['s'] = false;
});
document.getElementById('btnHand').addEventListener('touchstart', (e) => {
  e.preventDefault(); keys['w'] = true;
});
document.getElementById('btnHand').addEventListener('touchend', (e) => {
  e.preventDefault(); keys['w'] = false;
});
document.getElementById('btnAttack').addEventListener('touchstart', (e) => {
  e.preventDefault(); keys[' '] = true;
});
document.getElementById('btnAttack').addEventListener('touchend', (e) => {
  e.preventDefault(); keys[' '] = false;
});
document.getElementById('btnRest').addEventListener('touchstart', (e) => {
  e.preventDefault(); keys['h'] = true;
});
document.getElementById('btnRest').addEventListener('touchend', (e) => {
  e.preventDefault(); keys['h'] = false;
});

socket.on('connect', () => {
  myId = socket.id;
  statusEl.textContent = '接続完了';
  statusEl.style.color = '#34c759';
  hudEl.style.display = 'flex';
});

socket.on('disconnect', () => {
  statusEl.textContent = '切断';
  statusEl.style.color = '#e94560';
});

socket.on('state', (data) => {
  players = data.players;
  blocks = data.blocks;
  bullets = data.bullets;
  levers = data.levers;
  doors = data.doors;
  movables = data.movables;
  blockSize = data.blockSize || 40;
  
  if (players[myId]) {
    const p = players[myId];
    hpEl.textContent = Math.round(p.hp);
    coinsEl.textContent = p.coins;
    zoneEl.textContent = p.zone === 'rest' ? 'REST' : 'BATTLE';
    if (p.zone === 'rest') showMapSelect(data.maps);
    else hideMapSelect();
  }
});

function showMapSelect(maps) {
  mapSelectEl.style.display = 'block';
  if (mapListEl.children.length > 0) return;
  mapListEl.innerHTML = '';
  maps.forEach((map, mi) => {
    const d = document.createElement('div');
    d.style.marginBottom = '12px';
    const t = document.createElement('h3');
    t.textContent = map.name;
    t.style.color = '#e94560';
    t.style.fontSize = '14px';
    d.appendChild(t);
    const s = document.createElement('div');
    s.style.display = 'flex'; s.style.gap = '8px'; s.style.flexWrap = 'wrap';
    map.spawnPoints.forEach((sp, si) => {
      const b = document.createElement('button');
      b.className = 'map-btn';
      b.textContent = `地点${si+1}`;
      b.onclick = () => socket.emit('selectSpawn', mi, si);
      s.appendChild(b);
    });
    d.appendChild(s);
    mapListEl.appendChild(d);
  });
}

function hideMapSelect() {
  mapSelectEl.style.display = 'none';
}

function updateCamera() {
  if (players[myId]) {
    const p = players[myId];
    cameraX = p.x - canvas.width / 2 + p.width / 2;
    cameraY = p.y - canvas.height / 2 + p.height / 2;
    cameraX = Math.max(0, Math.min(cameraX, 3000 - canvas.width));
    cameraY = Math.max(0, Math.min(cameraY, 800 - canvas.height));
  }
}

// ===== パスタ戦車描画 =====
function drawPastaTank(p, isMe) {
  const x = p.x - cameraX;
  const y = p.y - cameraY;
  const w = p.width;
  const h = p.height;
  
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h + 2, w/2 + 4, 6, 0, 0, Math.PI*2);
  ctx.fill();
  
  ctx.fillStyle = '#2c2c2e';
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h - 6, w/2 + 2, 10, 0, 0, Math.PI*2);
  ctx.fill();
  
  ctx.strokeStyle = '#48484a';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + w/2 + i * 10, y + h - 14);
    ctx.lineTo(x + w/2 + i * 10, y + h - 2);
    ctx.stroke();
  }
  
  ctx.fillStyle = '#e5e5ea';
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h/2 + 2, w/2 + 4, h/2 + 2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#c7c7cc';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  const pastaColors = ['#ffd60a', '#ffcc00', '#ffb800'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = pastaColors[i];
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h/2 - i * 3, w/2 - 2, 8, 0, 0, Math.PI*2);
    ctx.fill();
  }
  
  ctx.fillStyle = '#e94560';
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h/2 - 8, w/2 - 4, 9, 0, 0, Math.PI*2);
  ctx.fill();
  
  const meatballPos = [[-8, -10], [6, -12], [0, -6]];
  ctx.fillStyle = '#8b4513';
  for (const mp of meatballPos) {
    ctx.beginPath();
    ctx.arc(x + w/2 + mp[0], y + h/2 + mp[1], 4, 0, Math.PI*2);
    ctx.fill();
  }
  
  let angle = 0;
  if (p.state === 'hand_mode' && p.hand.active) {
    angle = p.hand.moveAngle * Math.PI / 180;
  } else {
    const mx = p.mouseX || (p.x + p.facing * 100);
    const my = p.mouseY || p.y;
    angle = Math.atan2(my - (p.y + h/2), mx - (p.x + w/2));
  }
  
  const barrelLen = 28;
  const bx = x + w/2 + Math.cos(angle) * barrelLen;
  const by = y + h/2 + Math.sin(angle) * barrelLen;
  
  ctx.strokeStyle = '#ffd60a';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + w/2, y + h/2 - 6);
  ctx.lineTo(bx, by);
  ctx.stroke();
  
  ctx.fillStyle = '#ffb800';
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, Math.PI*2);
  ctx.fill();
  
  const eyeDir = p.facing;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + w/2 + eyeDir * 12, y + h/2 - 4, 5, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#1d1d1f';
  ctx.beginPath();
  ctx.arc(x + w/2 + eyeDir * 13, y + h/2 - 4, 2.5, 0, Math.PI*2);
  ctx.fill();
  
  ctx.fillStyle = isMe ? '#e94560' : '#8e8e93';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isMe ? 'YOU' : p.id.slice(0, 6), x + w/2, y - 12);
  
  const barW = w + 8;
  const barH = 4;
  ctx.fillStyle = '#e5e5ea';
  ctx.fillRect(x + w/2 - barW/2, y - 8, barW, barH);
  ctx.fillStyle = p.hp > 50 ? '#34c759' : p.hp > 25 ? '#ff9500' : '#e94560';
  ctx.fillRect(x + w/2 - barW/2, y - 8, barW * (p.hp / p.maxHp), barH);
}

function drawHook(p) {
  if (!p.hook.active) return;
  const sx = p.x + p.width/2 - cameraX;
  const sy = p.y + p.height/2 - cameraY;
  const ex = p.hook.x - cameraX;
  const ey = p.hook.y - cameraY;
  
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.hook.attached ? '#34c759' : '#ff9500';
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  ctx.fillStyle = p.hook.attached ? '#34c759' : '#ff9500';
  ctx.beginPath();
  ctx.arc(ex, ey, 5, 0, Math.PI*2);
  ctx.fill();
}

function drawHand(p) {
  if (!p.hand.active) return;
  const sx = p.x + p.width/2 - cameraX;
  const sy = p.y + p.height/2 - cameraY;
  const ex = p.hand.x - cameraX;
  const ey = p.hand.y - cameraY;
  
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = 4;
  
  if (p.hand.targetType === 'lever') {
    ctx.strokeStyle = '#5856d6';
  } else if (p.hand.targetType === 'movable') {
    ctx.strokeStyle = '#af52de';
  } else {
    ctx.strokeStyle = '#ff2d55';
  }
  
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  ctx.fillStyle = p.hand.targetType === 'lever' ? '#5856d6' : 
                  p.hand.targetType === 'movable' ? '#af52de' : '#ff2d55';
  ctx.beginPath();
  ctx.arc(ex, ey, 7, 0, Math.PI*2);
  ctx.fill();
  
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  const icon = p.hand.targetType === 'lever' ? '🔧' : 
               p.hand.targetType === 'movable' ? '📦' : '✋';
  ctx.fillText(icon, ex, ey + 3);
}

function drawBullets() {
  for (const b of bullets) {
    const x = b.x - cameraX;
    const y = b.y - cameraY;
    ctx.fillStyle = b.color || '#e94560';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, 2, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawBlocks() {
  for (const b of blocks) {
    const x = b.c * blockSize - cameraX;
    const y = b.r * blockSize - cameraY;
    
    if (x + blockSize < 0 || x > canvas.width || y + blockSize < 0 || y > canvas.height) continue;
    
    if (b.type === 1) {
      ctx.fillStyle = '#e5e5ea';
      ctx.fillRect(x, y, blockSize, blockSize);
      ctx.strokeStyle = '#c7c7cc';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, blockSize, blockSize);
      
      ctx.fillStyle = '#d1d1d6';
      ctx.fillRect(x + 4, y + 4, blockSize - 8, 3);
      ctx.fillRect(x + 4, y + blockSize/2, blockSize - 8, 3);
    }
  }
}

function drawLevers() {
  for (const l of levers) {
    const x = l.x - cameraX;
    const y = l.y - cameraY;
    
    // 台座
    ctx.fillStyle = '#8e8e93';
    ctx.fillRect(x, y + l.h - 8, l.w, 8);
    
    // レバー
    ctx.save();
    ctx.translate(x + l.w/2, y + l.h - 8);
    const angle = l.pulled ? Math.PI / 3 : -Math.PI / 6;
    ctx.rotate(angle);
    
    ctx.fillStyle = l.pulled ? '#34c759' : '#ff9500';
    ctx.fillRect(-3, -30, 6, 30);
    
    // 握り
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(0, -30, 6, 0, Math.PI*2);
    ctx.fill();
    
    ctx.restore();
    
    // ラベル
    ctx.fillStyle = '#8e8e93';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(l.pulled ? 'ON' : 'OFF', x + l.w/2, y - 4);
  }
}

function drawDoors() {
  for (const d of doors) {
    const x = d.x - cameraX;
    const y = d.y - cameraY;
    
    if (d.openHeight >= d.h) continue;
    
    const drawH = d.h - d.openHeight;
    
    // ドア枠
    ctx.fillStyle = '#48484a';
    ctx.fillRect(x - 2, y - 2, d.w + 4, d.h + 4);
    
    // ドア本体
    ctx.fillStyle = '#2c2c2e';
    ctx.fillRect(x, y, d.w, drawH);
    
    // 模様
    ctx.strokeStyle = '#636366';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, d.w - 8, drawH - 8);
    
    // 開いた部分は空
    if (d.openHeight > 0) {
      ctx.fillStyle = '#f5f5f7';
      ctx.fillRect(x, y + drawH, d.w, d.openHeight);
    }
  }
}

function drawMovables() {
  for (const m of movables) {
    const x = m.x - cameraX;
    const y = m.y - cameraY;
    
    ctx.fillStyle = m.heldBy ? '#af52de' : '#5856d6';
    ctx.fillRect(x, y, m.w, m.h);
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, m.w - 6, m.h - 6);
    
    // 掴まれている印
    if (m.heldBy) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✋', x + m.w/2, y + m.h/2 + 3);
    }
  }
}

function drawBackground() {
  ctx.fillStyle = '#f5f5f7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 1;
  const offX = -cameraX % 40;
  const offY = -cameraY % 40;
  for (let x = offX; x < canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = offY; y < canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

function drawMinimap() {
  const mw = 120, mh = 32;
  const mx = canvas.width - mw - 10;
  const my = 10;
  
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#c7c7cc';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);
  
  const scaleX = mw / 3000;
  const scaleY = mh / 800;
  
  for (const id in players) {
    const p = players[id];
    ctx.fillStyle = id === myId ? '#e94560' : '#34c759';
    ctx.fillRect(mx + p.x * scaleX, my + p.y * scaleY, 3, 3);
  }
}

function draw() {
  drawBackground();
  updateCamera();
  drawBlocks();
  drawDoors();
  drawLevers();
  drawMovables();
  
  for (const id in players) {
    const p = players[id];
    drawPastaTank(p, id === myId);
    drawHook(p);
    drawHand(p);
  }
  
  drawBullets();
  drawMinimap();
  
  if (players[myId]) {
    const p = players[myId];
    const sx = p.x + p.width/2 - cameraX;
    const sy = p.y + p.height/2 - cameraY;
    const mx = mouseX - cameraX;
    const my = mouseY - cameraY;
    
    ctx.strokeStyle = 'rgba(233,69,96,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 6, my); ctx.lineTo(mx + 6, my);
    ctx.moveTo(mx, my - 6); ctx.lineTo(mx, my + 6);
    ctx.stroke();
  }
  
  requestAnimationFrame(draw);
}

setInterval(() => {
  let left = keys['a'] || keys['arrowleft'];
  let right = keys['d'] || keys['arrowright'];
  
  if (isMobile && joystickActive) {
    if (joystickDX < -0.2) left = true;
    if (joystickDX > 0.2) right = true;
  }
  
  socket.emit('input', {
    left, right,
    up: keys['w'] || keys['arrowup'],
    down: keys['s'] || keys['arrowdown'],
    hook: keys['s'],
    pasta: keys['w'],
    attack: keys[' '],
    rest: keys['h'],
    mouseX, mouseY
  });
}, 1000 / 60);

draw();
