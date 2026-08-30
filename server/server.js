const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
// ===== 静的ファイル配信（docsフォルダ） =====
app.use(express.static(path.join(__dirname, '../docs')));

// ルートアクセス時にゲーム画面を返す
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/index.html'));
});


// ===== ゲーム定数 =====
const GRAVITY = 0.5;
const GROUND_Y = 340;
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 400;
const PLAYER_SIZE = 40;
const HOOK_SPEED = 20;
const HOOK_MAX_LENGTH = 400;

// ===== マップデータ =====
const MAPS = [
  { name: 'Battlefield', spawnPoints: [{x: 100, y: 200}, {x: 700, y: 200}, {x: 400, y: 100}] },
  { name: 'High Ground', spawnPoints: [{x: 50, y: 300}, {x: 750, y: 300}, {x: 400, y: 50}] }
];

// ===== 壁 =====
const WALLS = [
  { x: 200, y: 250, w: 20, h: 100 },
  { x: 500, y: 200, w: 20, h: 150 },
  { x: 800, y: 280, w: 100, h: 20 },
  { x: 1100, y: 220, w: 20, h: 130 },
  { x: 1400, y: 260, w: 20, h: 90 }
];

// ===== 休憩所 =====
const REST_AREA = { x: 50, y: 100, w: 100, h: 100 };

// ===== ワープポイント（休憩所→戦場） =====
const WARP_POINTS = [
  { x: 120, y: 300, w: 40, h: 40 }
];

const players = {};

function createPlayer(id) {
  return {
    id,
    x: 100 + Math.random() * 200,
    y: 200,
    vx: 0,
    vy: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    angle: 0,
    state: 'normal',
    hook: {
      active: false,
      x: 0, y: 0,
      attached: false,
      length: 0,
      angle: 0
    },
    pastaHook: {
      active: false,
      x: 0, y: 0,
      attached: false,
      angle: 0,
      length: 0
    },
    zone: 'battle',
    hp: 100,
    maxHp: 100,
    coins: 0,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    facing: 1
  };
}

function rectIntersect(r1, r2) {
  return !(r2.x > r1.x + r1.w || 
           r2.x + r2.w < r1.x || 
           r2.y > r1.y + r1.h ||
           r2.y + r2.h < r1.y);
}

function lineRectIntersect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  
  if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) {
    return false;
  }
  return true;
}

function updateHook(p) {
  if (!p.hook.active) return;
  
  const startX = p.x + p.width/2;
  const startY = p.y + p.height/2;
  
  if (!p.hook.attached) {
    p.hook.length += HOOK_SPEED;
    const rad = p.hook.angle * Math.PI / 180;
    p.hook.x = startX + Math.cos(rad) * p.hook.length;
    p.hook.y = startY + Math.sin(rad) * p.hook.length;
    
    if (p.hook.length > HOOK_MAX_LENGTH) {
      p.hook.active = false;
      return;
    }
    
    for (const wall of WALLS) {
      if (lineRectIntersect(startX, startY, p.hook.x, p.hook.y, wall.x, wall.y, wall.w, wall.h)) {
        p.hook.attached = true;
        break;
      }
    }
    
    if (p.hook.x < 0 || p.hook.x > GAME_WIDTH || p.hook.y < 0 || p.hook.y > GAME_HEIGHT) {
      p.hook.active = false;
    }
  } else {
    const dx = p.hook.x - (p.x + p.width/2);
    const dy = p.hook.y - (p.y + p.height/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 10) {
      p.vx += dx * 0.015;
      p.vy += dy * 0.015;
      p.state = 'hooked';
    } else {
      p.hook.active = false;
      p.state = 'normal';
    }
  }
}

function updatePastaHook(p) {
  if (!p.pastaHook.active) return;
  
  const startX = p.x + p.width/2;
  const startY = p.y + p.height/2;
  
  if (!p.pastaHook.attached) {
    p.pastaHook.length += HOOK_SPEED;
    const rad = p.pastaHook.angle * Math.PI / 180;
    p.pastaHook.x = startX + Math.cos(rad) * p.pastaHook.length;
    p.pastaHook.y = startY + Math.sin(rad) * p.pastaHook.length;
    
    if (p.pastaHook.length > HOOK_MAX_LENGTH) {
      p.pastaHook.active = false;
      return;
    }
    
    for (const wall of WALLS) {
      if (lineRectIntersect(startX, startY, p.pastaHook.x, p.pastaHook.y, wall.x, wall.y, wall.w, wall.h)) {
        p.pastaHook.attached = true;
        break;
      }
    }
  } else {
    const dx = p.pastaHook.x - (p.x + p.width/2);
    const dy = p.pastaHook.y - (p.y + p.height/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 5) {
      p.vx += dx * 0.08;
      p.vy += dy * 0.08;
    }
  }
}

function updatePhysics() {
  for (const id in players) {
    const p = players[id];
    
    if (p.zone === 'rest') {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.x = Math.max(0, Math.min(200, p.x));
      p.y = Math.max(0, Math.min(400, p.y));
      continue;
    }
    
    if (p.state !== 'pasta_mode') {
      p.vy += GRAVITY;
    }
    
    p.x += p.vx;
    p.y += p.vy;
    
    if (p.y + p.height > GROUND_Y) {
      p.y = GROUND_Y - p.height;
      p.vy = 0;
    }
    
    for (const wall of WALLS) {
      if (rectIntersect(
        {x: p.x, y: p.y, w: p.width, h: p.height},
        wall
      )) {
        const centerPx = p.x + p.width/2;
        const centerWx = wall.x + wall.w/2;
        if (centerPx < centerWx) {
          p.x = wall.x - p.width;
        } else {
          p.x = wall.x + wall.w;
        }
        p.vx = 0;
      }
    }
    
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x > GAME_WIDTH - p.width) { p.x = GAME_WIDTH - p.width; p.vx = 0; }
    
    p.vx *= 0.85;
    if (Math.abs(p.vx) < 0.1) p.vx = 0;
    
    updateHook(p);
    updatePastaHook(p);
  }
}

function checkPlayerDeath(p) {
  if (p.y > GAME_HEIGHT + 100 || p.hp <= 0) {
    p.hp = p.maxHp;
    p.vx = 0;
    p.vy = 0;
    p.hook.active = false;
    p.pastaHook.active = false;
    p.state = 'normal';
    
    if (p.zone === 'battle') {
      const spawn = MAPS[0].spawnPoints[Math.floor(Math.random() * MAPS[0].spawnPoints.length)];
      p.x = spawn.x;
      p.y = spawn.y;
    }
  }
}

setInterval(() => {
  updatePhysics();
  
  for (const id in players) {
    checkPlayerDeath(players[id]);
  }
  
  io.emit('state', { players, walls: WALLS, warpPoints: WARP_POINTS, restArea: REST_AREA, maps: MAPS });
}, 1000 / 60);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  players[socket.id] = createPlayer(socket.id);
  
  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;
    
    const speed = 1.2;
    
    if (p.zone === 'rest') {
      if (data.left) p.vx -= speed;
      if (data.right) p.vx += speed;
      if (data.up) p.vy -= speed;
      if (data.down) p.vy += speed;
      return;
    }
    
    if (p.state === 'pasta_mode') {
      if (data.left) p.pastaHook.angle -= 3;
      if (data.right) p.pastaHook.angle += 3;
      p.vy *= 0.95;
      p.vx *= 0.9;
    } else if (p.state === 'hooked') {
      if (data.left) p.vx -= speed * 0.3;
      if (data.right) p.vx += speed * 0.3;
    } else {
      if (data.left) {
        p.vx -= speed;
        p.facing = -1;
      }
      if (data.right) {
        p.vx += speed;
        p.facing = 1;
      }
    }
    
    if (data.hook && !p.hook.active && p.state !== 'pasta_mode') {
      p.hook.active = true;
      p.hook.attached = false;
      p.hook.length = 0;
      p.hook.angle = p.facing === 1 ? -45 : -135;
    }
    
    if (data.pasta) {
      if (p.state === 'pasta_mode') {
        p.state = 'normal';
        p.pastaHook.active = false;
      } else if (!p.pastaHook.active) {
        p.state = 'pasta_mode';
        p.pastaHook.active = true;
        p.pastaHook.attached = false;
        p.pastaHook.length = 0;
        p.pastaHook.angle = p.facing === 1 ? -45 : -135;
      }
    }
    
    if (data.rest) {
      p.zone = 'rest';
      p.x = REST_AREA.x + REST_AREA.w/2;
      p.y = REST_AREA.y + REST_AREA.h/2;
      p.vx = 0;
      p.vy = 0;
      p.hook.active = false;
      p.pastaHook.active = false;
      p.state = 'normal';
    }
  });
  
  socket.on('selectSpawn', (mapIndex, spawnIndex) => {
    const p = players[socket.id];
    if (!p) return;
    p.zone = 'battle';
    const spawn = MAPS[mapIndex].spawnPoints[spawnIndex];
    p.x = spawn.x;
    p.y = spawn.y;
    p.vx = 0;
    p.vy = 0;
  });
  
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
