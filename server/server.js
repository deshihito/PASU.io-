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

// ===== 静的ファイル配信 =====
app.use(express.static(path.join(__dirname, '../docs')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/index.html'));
});

// ===== ゲーム定数 =====
const GRAVITY = 0.6;
const BLOCK_SIZE = 40;
const GAME_WIDTH = 2000;
const GAME_HEIGHT = 600;
const PLAYER_W = 50;
const PLAYER_H = 36;
const HOOK_SPEED = 25;
const HOOK_MAX_LEN = 500;
const HAND_SPEED = 20;
const HAND_MAX_LEN = 400;
const BULLET_SPEED = 15;
const BULLET_LIFE = 120;

// ===== ブロックマップ（サンドボックス） =====
// 0=空, 1=壁, 2=氷, 3=ジャンプ台
const BLOCKS = [];
const MAP_COLS = Math.ceil(GAME_WIDTH / BLOCK_SIZE);
const MAP_ROWS = Math.ceil(GAME_HEIGHT / BLOCK_SIZE);

function initMap() {
  BLOCKS.length = 0;
  // 床
  for (let x = 0; x < MAP_COLS; x++) {
    BLOCKS.push({ c: x, r: MAP_ROWS - 1, type: 1 });
    BLOCKS.push({ c: x, r: MAP_ROWS - 2, type: 1 });
  }
  // 壁（左右）
  for (let y = 0; y < MAP_ROWS; y++) {
    BLOCKS.push({ c: 0, r: y, type: 1 });
    BLOCKS.push({ c: MAP_COLS - 1, r: y, type: 1 });
  }
  // プラットフォーム
  const platforms = [
    { c: 5, r: 10, w: 6 }, { c: 15, r: 8, w: 4 },
    { c: 25, r: 11, w: 5 }, { c: 35, r: 7, w: 6 },
    { c: 12, r: 5, w: 3 }, { c: 30, r: 9, w: 4 },
    { c: 42, r: 6, w: 5 }, { c: 8, r: 13, w: 4 }
  ];
  for (const p of platforms) {
    for (let i = 0; i < p.w; i++) {
      BLOCKS.push({ c: p.c + i, r: p.r, type: 1 });
    }
  }
}

initMap();

// ===== 休憩所 =====
const REST_AREA = { x: 60, y: 80, w: 120, h: 120 };

// ===== ワープポイント =====
const WARP_POINTS = [{ x: 140, y: 360, w: 40, h: 40 }];

// ===== マップデータ =====
const MAPS = [
  { name: 'Battlefield', spawnPoints: [{x: 200, y: 300}, {x: 800, y: 300}, {x: 1400, y: 300}] },
  { name: 'Sky Arena', spawnPoints: [{x: 300, y: 200}, {x: 1000, y: 150}, {x: 1600, y: 200}] }
];

const players = {};
const bullets = [];

function createPlayer(id) {
  return {
    id,
    x: 300, y: 300,
    vx: 0, vy: 0,
    width: PLAYER_W, height: PLAYER_H,
    angle: 0,
    state: 'normal',
    hook: { active: false, x: 0, y: 0, attached: false, len: 0, angle: 0 },
    hand: { active: false, x: 0, y: 0, attached: false, angle: 0, len: 0, moveAngle: 0 },
    zone: 'battle',
    hp: 100, maxHp: 100,
    coins: 0,
    color: `hsl(${Math.random() * 360}, 70%, 55%)`,
    facing: 1,
    mouseX: 0, mouseY: 0,
    onGround: false,
    invincible: 0
  };
}

function blockAt(cx, cy) {
  for (const b of BLOCKS) {
    if (b.c === cx && b.r === cy) return b;
  }
  return null;
}

function lineBlockIntersect(x1, y1, x2, y2) {
  const steps = Math.ceil(Math.max(Math.abs(x2-x1), Math.abs(y2-y1)) / (BLOCK_SIZE/2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const cx = Math.floor(px / BLOCK_SIZE);
    const cy = Math.floor(py / BLOCK_SIZE);
    const b = blockAt(cx, cy);
    if (b && b.type === 1) {
      return { x: px, y: py, block: b };
    }
  }
  return null;
}

function rectBlocksIntersect(rx, ry, rw, rh) {
  const c1 = Math.floor(rx / BLOCK_SIZE);
  const c2 = Math.floor((rx + rw) / BLOCK_SIZE);
  const r1 = Math.floor(ry / BLOCK_SIZE);
  const r2 = Math.floor((ry + rh) / BLOCK_SIZE);
  for (let c = c1; c <= c2; c++) {
    for (let r = r1; r <= r2; r++) {
      const b = blockAt(c, r);
      if (b && b.type === 1) return true;
    }
  }
  return false;
}

function resolveBlockCollision(p) {
  const c1 = Math.floor(p.x / BLOCK_SIZE);
  const c2 = Math.floor((p.x + p.width) / BLOCK_SIZE);
  const r1 = Math.floor(p.y / BLOCK_SIZE);
  const r2 = Math.floor((p.y + p.height) / BLOCK_SIZE);
  
  p.onGround = false;
  
  for (let c = c1; c <= c2; c++) {
    for (let r = r1; r <= r2; r++) {
      const b = blockAt(c, r);
      if (!b || b.type !== 1) continue;
      
      const bx = b.c * BLOCK_SIZE;
      const by = b.r * BLOCK_SIZE;
      const bw = BLOCK_SIZE;
      const bh = BLOCK_SIZE;
      
      const overlapLeft = (p.x + p.width) - bx;
      const overlapRight = (bx + bw) - p.x;
      const overlapTop = (p.y + p.height) - by;
      const overlapBottom = (by + bh) - p.y;
      
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      
      if (minOverlap === overlapTop && p.vy >= 0) {
        p.y = by - p.height;
        p.vy = 0;
        p.onGround = true;
      } else if (minOverlap === overlapBottom && p.vy < 0) {
        p.y = by + bh;
        p.vy = 0;
      } else if (minOverlap === overlapLeft && p.vx > 0) {
        p.x = bx - p.width;
        p.vx = 0;
      } else if (minOverlap === overlapRight && p.vx < 0) {
        p.x = bx + bw;
        p.vx = 0;
      }
    }
  }
}

function updateHook(p) {
  if (!p.hook.active) return;
  const sx = p.x + p.width/2;
  const sy = p.y + p.height/2;
  
  if (!p.hook.attached) {
    p.hook.len += HOOK_SPEED;
    const rad = p.hook.angle * Math.PI / 180;
    p.hook.x = sx + Math.cos(rad) * p.hook.len;
    p.hook.y = sy + Math.sin(rad) * p.hook.len;
    
    if (p.hook.len > HOOK_MAX_LEN) { p.hook.active = false; return; }
    
    const hit = lineBlockIntersect(sx, sy, p.hook.x, p.hook.y);
    if (hit) {
      p.hook.attached = true;
      p.hook.x = hit.x;
      p.hook.y = hit.y;
    }
    
    if (p.hook.x < 0 || p.hook.x > GAME_WIDTH || p.hook.y < 0 || p.hook.y > GAME_HEIGHT) {
      p.hook.active = false;
    }
  } else {
    const dx = p.hook.x - sx;
    const dy = p.hook.y - sy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 15) {
      const pull = 0.025;
      p.vx += dx * pull;
      p.vy += dy * pull;
      p.state = 'hooked';
    } else {
      p.hook.active = false;
      p.state = 'normal';
    }
  }
}

function updateHand(p) {
  if (!p.hand.active) return;
  const sx = p.x + p.width/2;
  const sy = p.y + p.height/2;
  
  if (!p.hand.attached) {
    p.hand.len += HAND_SPEED;
    const rad = p.hand.angle * Math.PI / 180;
    p.hand.x = sx + Math.cos(rad) * p.hand.len;
    p.hand.y = sy + Math.sin(rad) * p.hand.len;
    
    if (p.hand.len > HAND_MAX_LEN) { p.hand.active = false; p.state = 'normal'; return; }
    
    const hit = lineBlockIntersect(sx, sy, p.hand.x, p.hand.y);
    if (hit) {
      p.hand.attached = true;
      p.hand.x = hit.x;
      p.hand.y = hit.y;
      p.hand.moveAngle = p.hand.angle;
      p.state = 'hand_mode';
    }
    
    if (p.hand.x < 0 || p.hand.x > GAME_WIDTH || p.hand.y < 0 || p.hand.y > GAME_HEIGHT) {
      p.hand.active = false; p.state = 'normal';
    }
  } else {
    // ハンドに張り付き、A/Dで角度変更
    const rad = p.hand.moveAngle * Math.PI / 180;
    p.vx += Math.cos(rad) * 0.8;
    p.vy += Math.sin(rad) * 0.8;
    p.vy *= 0.95;
    p.vx *= 0.95;
  }
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    
    const hit = lineBlockIntersect(b.x - b.vx, b.y - b.vy, b.x, b.y);
    if (hit) { bullets.splice(i, 1); continue; }
    
    for (const id in players) {
      const p = players[id];
      if (p.id === b.owner || p.zone !== 'battle') continue;
      const dx = (p.x + p.width/2) - b.x;
      const dy = (p.y + p.height/2) - b.y;
      if (Math.sqrt(dx*dx + dy*dy) < 30) {
        p.hp -= 15;
        p.vx += b.vx * 0.3;
        p.vy += b.vy * 0.3;
        bullets.splice(i, 1);
        break;
      }
    }
    
    if (b.life <= 0 || b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT) {
      bullets.splice(i, 1);
    }
  }
}

function updatePhysics() {
  for (const id in players) {
    const p = players[id];
    p.invincible = Math.max(0, p.invincible - 1);
    
    if (p.zone === 'rest') {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.9; p.vy *= 0.9;
      p.x = Math.max(0, Math.min(200, p.x));
      p.y = Math.max(0, Math.min(400, p.y));
      continue;
    }
    
    if (p.state !== 'hand_mode') {
      p.vy += GRAVITY;
    }
    
    p.x += p.vx;
    p.y += p.vy;
    
    resolveBlockCollision(p);
    
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x > GAME_WIDTH - p.width) { p.x = GAME_WIDTH - p.width; p.vx = 0; }
    
    if (!p.onGround && p.state !== 'hooked' && p.state !== 'hand_mode') {
      p.vx *= 0.98;
    } else if (p.state === 'normal') {
      p.vx *= 0.85;
    }
    
    updateHook(p);
    updateHand(p);
  }
  updateBullets();
}

function checkDeath(p) {
  if (p.y > GAME_HEIGHT + 200 || p.hp <= 0) {
    p.hp = p.maxHp;
    p.vx = 0; p.vy = 0;
    p.hook.active = false;
    p.hand.active = false;
    p.state = 'normal';
    if (p.zone === 'battle') {
      const sp = MAPS[0].spawnPoints[Math.floor(Math.random() * MAPS[0].spawnPoints.length)];
      p.x = sp.x; p.y = sp.y;
    }
  }
}

setInterval(() => {
  updatePhysics();
  for (const id in players) checkDeath(players[id]);
  
  io.emit('state', {
    players, blocks: BLOCKS, bullets,
    warpPoints: WARP_POINTS, restArea: REST_AREA,
    maps: MAPS, blockSize: BLOCK_SIZE
  });
}, 1000 / 60);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  players[socket.id] = createPlayer(socket.id);
  
  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;
    
    // マウス位置更新
    if (data.mouseX !== undefined) p.mouseX = data.mouseX;
    if (data.mouseY !== undefined) p.mouseY = data.mouseY;
    
    const speed = 1.0;
    
    if (p.zone === 'rest') {
      if (data.left) p.vx -= speed;
      if (data.right) p.vx += speed;
      if (data.up) p.vy -= speed;
      if (data.down) p.vy += speed;
      return;
    }
    
    if (p.state === 'hand_mode' && p.hand.attached) {
      // A/Dでハンドの進行方向を変更
      if (data.left) p.hand.moveAngle -= 2.5;
      if (data.right) p.hand.moveAngle += 2.5;
      // Wでハンドモード解除
      if (data.pasta) {
        p.hand.active = false;
        p.state = 'normal';
      }
      // スペースで攻撃
      if (data.attack) {
        const angle = Math.atan2(p.mouseY - (p.y + p.height/2), p.mouseX - (p.x + p.width/2));
        bullets.push({
          x: p.x + p.width/2,
          y: p.y + p.height/2,
          vx: Math.cos(angle) * BULLET_SPEED,
          vy: Math.sin(angle) * BULLET_SPEED,
          owner: p.id,
          life: BULLET_LIFE,
          color: p.color
        });
      }
      return;
    }
    
    if (p.state === 'hooked') {
      if (data.left) p.vx -= speed * 0.3;
      if (data.right) p.vx += speed * 0.3;
    } else if (p.state === 'normal') {
      if (data.left) { p.vx -= speed; p.facing = -1; }
      if (data.right) { p.vx += speed; p.facing = 1; }
    }
    
    // S: パスタフック（マウス方向）
    if (data.hook && !p.hook.active && p.state !== 'hand_mode') {
      const angle = Math.atan2(p.mouseY - (p.y + p.height/2), p.mouseX - (p.x + p.width/2));
      p.hook.active = true;
      p.hook.attached = false;
      p.hook.len = 0;
      p.hook.angle = angle * 180 / Math.PI;
    }
    
    // W: パスタハンド（マウス方向）
    if (data.pasta && p.state !== 'hand_mode') {
      if (p.hand.active && !p.hand.attached) {
        p.hand.active = false;
      } else if (!p.hand.active) {
        const angle = Math.atan2(p.mouseY - (p.y + p.height/2), p.mouseX - (p.x + p.width/2));
        p.hand.active = true;
        p.hand.attached = false;
        p.hand.len = 0;
        p.hand.angle = angle * 180 / Math.PI;
      }
    }
    
    // スペース: 通常攻撃（パスタ弾）
    if (data.attack && p.state === 'normal') {
      const angle = Math.atan2(p.mouseY - (p.y + p.height/2), p.mouseX - (p.x + p.width/2));
      bullets.push({
        x: p.x + p.width/2,
        y: p.y + p.height/2,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        owner: p.id,
        life: BULLET_LIFE,
        color: p.color
      });
    }
    
    if (data.rest) {
      p.zone = 'rest';
      p.x = REST_AREA.x + REST_AREA.w/2;
      p.y = REST_AREA.y + REST_AREA.h/2;
      p.vx = 0; p.vy = 0;
      p.hook.active = false;
      p.hand.active = false;
      p.state = 'normal';
    }
  });
  
  socket.on('selectSpawn', (mapIndex, spawnIndex) => {
    const p = players[socket.id];
    if (!p) return;
    p.zone = 'battle';
    const sp = MAPS[mapIndex].spawnPoints[spawnIndex];
    p.x = sp.x; p.y = sp.y;
    p.vx = 0; p.vy = 0;
  });
  
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
