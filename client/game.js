const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const hpEl = document.getElementById('hp');
const coinsEl = document.getElementById('coins');
const zoneEl = document.getElementById('zone');
const hudEl = document.getElementById('hud');
const mapSelectEl = document.getElementById('mapSelect');
const mapListEl = document.getElementById('mapList');

// サーバーURL（本番ではRenderのURLに変更）
const SERVER_URL = 'http://localhost:3000';
const socket = io(SERVER_URL);

let players = {};
let walls = [];
let warpPoints = [];
let restArea = {};
let maps = [];
let myId = null;
let cameraX = 0;

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

socket.on('connect', () => {
  myId = socket.id;
  statusEl.textContent = '接続完了！';
  statusEl.style.color = '#0f0';
  hudEl.style.display = 'flex';
});

socket.on('disconnect', () => {
  statusEl.textContent = 'サーバーから切断';
  statusEl.style.color = '#f00';
});

socket.on('state', (data) => {
  players = data.players;
  walls = data.walls;
  warpPoints = data.warpPoints;
  restArea = data.restArea;
  maps = data.maps;
  
  if (players[myId]) {
    const p = players[myId];
    hpEl.textContent = Math.round(p.hp);
    coinsEl.textContent = p.coins;
    zoneEl.textContent = p.zone === 'rest' ? '休憩所' : '戦場';
    
    if (p.zone === 'rest') {
      showMapSelect();
    } else {
      hideMapSelect();
    }
  }
});

function showMapSelect() {
  mapSelectEl.style.display = 'block';
  mapListEl.innerHTML = '';
  
  maps.forEach((map, mapIdx) => {
    const mapDiv = document.createElement('div');
    mapDiv.style.marginBottom = '15px';
    
    const mapTitle = document.createElement('h3');
    mapTitle.textContent = map.name;
    mapTitle.style.color = '#e94560';
    mapDiv.appendChild(mapTitle);
    
    const spawnDiv = document.createElement('div');
    spawnDiv.style.display = 'flex';
    spawnDiv.style.gap = '10px';
    spawnDiv.style.flexWrap = 'wrap';
    
    map.spawnPoints.forEach((sp, spawnIdx) => {
      const btn = document.createElement('button');
      btn.className = 'map-btn';
      btn.textContent = `地点 ${spawnIdx + 1}`;
      btn.onclick = () => {
        socket.emit('selectSpawn', mapIdx, spawnIdx);
      };
      spawnDiv.appendChild(btn);
    });
    
    mapDiv.appendChild(spawnDiv);
    mapListEl.appendChild(mapDiv);
  });
}

function hideMapSelect() {
  mapSelectEl.style.display = 'none';
}

function updateCamera() {
  if (players[myId]) {
    const p = players[myId];
    cameraX = p.x - canvas.width / 2 + 20;
    cameraX = Math.max(0, Math.min(cameraX, 1600 - canvas.width));
  }
}

function drawTank(p, isMe) {
  const x = p.x - cameraX;
  const y = p.y;
  
  // ボディ
  ctx.fillStyle = isMe ? '#e94560' : p.color;
  ctx.fillRect(x, y, p.width, p.height);
  
  // 砲塔
  ctx.fillStyle = isMe ? '#ff6b6b' : '#fff';
  const centerX = x + p.width / 2;
  const centerY = y + p.height / 2;
  
  let angle = 0;
  if (p.state === 'pasta_mode' && p.pastaHook.active) {
    angle = p.pastaHook.angle * Math.PI / 180;
  } else {
    angle = p.facing === 1 ? -Math.PI / 4 : -Math.PI * 0.75;
  }
  
  const barrelLen = 25;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + Math.cos(angle) * barrelLen, centerY + Math.sin(angle) * barrelLen);
  ctx.lineWidth = 6;
  ctx.strokeStyle = isMe ? '#ff6b6b' : '#fff';
  ctx.stroke();
  
  // 目
  ctx.fillStyle = '#fff';
  const eyeX = p.facing === 1 ? x + 28 : x + 4;
  ctx.fillRect(eyeX, y + 8, 8, 8);
  ctx.fillStyle = '#000';
  ctx.fillRect(eyeX + (p.facing === 1 ? 4 : 0), y + 10, 4, 4);
  
  // 名前
  ctx.fillStyle = isMe ? '#ff0' : '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isMe ? 'YOU' : p.id.slice(0, 6), x + p.width/2, y - 8);
  
  // HPバー
  const barW = p.width;
  const barH = 4;
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y - 16, barW, barH);
  ctx.fillStyle = '#0f0';
  ctx.fillRect(x, y - 16, barW * (p.hp / p.maxHp), barH);
}

function drawHook(p) {
  if (!p.hook.active) return;
  const startX = p.x + p.width/2 - cameraX;
  const startY = p.y + p.height/2;
  const endX = p.hook.x - cameraX;
  const endY = p.hook.y;
  
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.hook.attached ? '#0f0' : '#ff0';
  ctx.stroke();
  
  ctx.fillStyle = '#ff0';
  ctx.beginPath();
  ctx.arc(endX, endY, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPastaHook(p) {
  if (!p.pastaHook.active) return;
  const startX = p.x + p.width/2 - cameraX;
  const startY = p.y + p.height/2;
  const endX = p.pastaHook.x - cameraX;
  const endY = p.pastaHook.y;
  
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.lineWidth = 4;
  ctx.strokeStyle = p.pastaHook.attached ? '#e94560' : '#ff6b6b';
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  ctx.fillStyle = '#e94560';
  ctx.beginPath();
  ctx.arc(endX, endY, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawWalls() {
  ctx.fillStyle = '#533483';
  for (const w of walls) {
    ctx.fillRect(w.x - cameraX, w.y, w.w, w.h);
    ctx.strokeStyle = '#7b2cbf';
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x - cameraX, w.y, w.w, w.h);
  }
}

function drawWarpPoints() {
  for (const wp of warpPoints) {
    const x = wp.x - cameraX;
    ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.fillRect(x, wp.y, wp.w, wp.h);
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, wp.y, wp.w, wp.h);
    
    ctx.fillStyle = '#0ff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WARP', x + wp.w/2, wp.y + wp.h/2 + 4);
  }
}

function drawRestArea() {
  if (!restArea) return;
  const x = restArea.x - cameraX;
  ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
  ctx.fillRect(x, restArea.y, restArea.w, restArea.h);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, restArea.y, restArea.w, restArea.h);
  
  ctx.fillStyle = '#ffd700';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('REST', x + restArea.w/2, restArea.y + restArea.h/2 + 4);
}

function drawGround() {
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 340, canvas.width, 60);
  ctx.fillStyle = '#0f3460';
  ctx.fillRect(0, 340, canvas.width, 5);
  
  // グリッド線
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = -cameraX % 50; x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function draw() {
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  updateCamera();
  drawGround();
  drawWalls();
  drawWarpPoints();
  drawRestArea();
  
  for (const id in players) {
    const p = players[id];
    drawTank(p, id === myId);
    drawHook(p);
    drawPastaHook(p);
  }
  
  // ミニマップ
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(canvas.width - 110, 10, 100, 50);
  ctx.strokeStyle = '#e94560';
  ctx.lineWidth = 1;
  ctx.strokeRect(canvas.width - 110, 10, 100, 50);
  
  const scaleX = 100 / 1600;
  const scaleY = 50 / 400;
  for (const id in players) {
    const p = players[id];
    ctx.fillStyle = id === myId ? '#e94560' : '#0f0';
    ctx.fillRect(canvas.width - 110 + p.x * scaleX, 10 + p.y * scaleY, 3, 3);
  }
  
  requestAnimationFrame(draw);
}

// 入力送信（60FPS）
setInterval(() => {
  socket.emit('input', {
    left: keys['a'] || keys['arrowleft'],
    right: keys['d'] || keys['arrowright'],
    up: keys['w'] || keys['arrowup'],
    down: keys['s'] || keys['arrowdown'],
    hook: keys['s'],
    pasta: keys['w'],
    rest: keys['h']
  });
}, 1000 / 60);

draw();
