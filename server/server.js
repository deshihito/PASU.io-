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

app.use(express.static(path.join(__dirname, '../docs')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/index.html'));
});

// ===== ゲーム定数 =====
const GRAVITY = 0.6;
const BLOCK_SIZE = 40;
const GAME_WIDTH = 3000;
const GAME_HEIGHT = 800;
const PLAYER_W = 50;
const PLAYER_H = 36;
const HOOK_SPEED = 25;
const HOOK_MAX_LEN = 500;
const HAND_SPEED = 20;
const HAND_MAX_LEN = 400;
const BULLET_SPEED = 15;
const BULLET_LIFE = 120;

// ===== ブロックマップ =====
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
  // 天井
  for (let x = 0; x < MAP_COLS; x++) {
    BLOCKS.push({ c: x, r: 0, type: 1 });
    BLOCKS.push({ c: x, r: 1, type: 1 });
  }
  // 壁（左右）
  for (let y = 2; y < MAP_ROWS - 2; y++) {
    BLOCKS.push({ c: 0, r: y, type: 1 });
    BLOCKS.push({ c: 1, r: y, type: 1 });
    BLOCKS.push({ c: MAP_COLS - 1, r: y, type: 1 });
    BLOCKS.push({ c: MAP_COLS - 2, r: y, type: 1 });
  }
  // プラットフォーム
  const platforms = [
    { c: 6, r: 14, w: 8 }, { c: 20, r: 12, w: 6 },
    { c: 35, r: 15, w: 7 }, { c: 50, r: 10, w: 5 },
    { c: 15, r: 8, w: 4 }, { c: 40, r: 13, w: 5 },
    { c: 58, r: 9, w: 6 }, { c: 8, r: 18, w: 5 },
    { c: 28, r: 16, w: 4 }, { c: 45, r: 7, w: 6 },
    { c: 65, r: 14, w: 5 }, { c: 22, r: 5, w: 4 }
  ];
  for (const p of platforms) {
    for (let i = 0; i < p.w; i++) BLOCKS.push({ c: p.c + i, r: p.r, type: 1 });
  }
  // ブッシュ（type: 4）
  const bushes = [
    { c: 10, r: 16, w: 4, h: 2 }, { c: 25, r: 13, w: 3, h: 3 },
    { c: 45, r: 15, w: 5, h: 2 }, { c: 55, r: 11, w: 4, h: 3 },
    { c: 18, r: 17, w: 3, h: 2 }, { c: 38, r: 14, w: 4, h: 2 }
  ];
  for (const bush of bushes) {
    for (let i = 0; i < bush.w; i++) {
      for (let j = 0; j < bush.h; j++) {
        BLOCKS.push({ c: bush.c + i, r: bush.r + j, type: 4 });
      }
    }
  }
}

initMap();

// ===== レバー（トグル式） =====
const LEVERS = [
  { id: 'lever1', x: 400, y: 520, w: 30, h: 40, pulled: false, targetDoor: 'door1' },
  { id: 'lever2', x: 1200, y: 360, w: 30, h: 40, pulled: false, targetDoor: 'door2' }
];

// ===== ドア =====
const DOORS = [
  { id: 'door1', x: 800, y: 400, w: 40, h: 120, open: false, openHeight: 0 },
  { id: 'door2', x: 1800, y: 280, w: 40, h: 120, open: false, openHeight: 0 }
];

// ===== 動かせる物体 =====
const MOVABLES = [
  { id: 'box1', x: 300, y: 500, w: 40, h: 40, vx: 0, vy: 0, heldBy: null },
  { id: 'box2', x: 900, y: 400, w: 50, h: 50, vx: 0, vy: 0, heldBy: null },
  { id: 'box3', x: 1600, y: 300, w: 35, h: 60, vx: 0, vy: 0, heldBy: null }
];

// ===== ワープパッド =====
const WARP_PADS = [
  { x: 500, y: 520, w: 50, h: 10 },
  { x: 1500, y: 520, w: 50, h: 10 },
  { x: 2500, y: 520, w: 50, h: 10 }
];

// ===== 休憩所ルーム（別エリア） =====
const REST_ZONE = { x: 3200, y: 0, w: 600, h: 800 };
const SHOP_NPC = { x: 3450, y: 400, w: 40, h: 50 };

// ===== マップデータ =====
const MAPS = [
  { name: 'Battlefield', spawnPoints: [{x: 200, y: 500}, {x: 1000, y: 400}, {x: 2000, y: 500}] },
  { name: 'Sky Arena', spawnPoints: [{x: 300, y: 300}, {x: 1500, y: 200}, {x: 2500, y: 300}] }
];

const players = {};
const bullets = [];

function createPlayer(id) {
  return {
    id,
    x: 300, y: 500,
    vx: 0, vy: 0,
    width: PLAYER_W, height: PLAYER_H,
    angle: 0,
    state: 'normal',
    hook: { active: false, x: 0, y: 0, attached: false, len: 0, angle: 0 },
    hand: { active: false, x: 0, y: 0, attached: false, angle: 0, len: 0, moveAngle: 0, targetType: null, targetId: null },
    zone: 'battle',
    hp: 100, maxHp: 100,
    coins: 0,
    color: `hsl(${Math.random() * 360}, 70%, 55%)`,
    facing: 1,
    mouseX: 0, mouseY: 0,
    onGround: false,
    invincible: 0,
    slots: [null, null, null, null],
    returning: false,
    returnTimer: 0,
    inBush: false
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
    if (b && b.type === 1) return { x: px, y: py, block: b };
  }
  return null;
}

function resolveBlockCollision(p) {
  const c1 = Math.floor(p.x / BLOCK_SIZE);
  const c2 = Math.floor((p.x + p.width) / BLOCK_SIZE);
  const r1 = Math.floor(p.y / BLOCK_SIZE);
  const r2 = Math.floor((p.y + p.height) / BLOCK_SIZE);
  
  p.onGround = false;
  p.inBush = false;
  
  for (let c = c1; c <= c2; c++) {
    for (let r = r1; r <= r2; r++) {
      const b = blockAt(c, r);
      if (!b) continue;
      
      if (b.type === 4) {
        p.inBush = true;
        continue;
      }
      if (b.type !== 1) continue;
      
      const bx = b.c * BLOCK_SIZE;
      const by = b.r * BLOCK_SIZE;
      
      const overlapLeft = (p.x + p.width) - bx;
      const overlapRight = (bx + BLOCK_SIZE) - p.x;
      const overlapTop = (p.y + p.height) - by;
      const overlapBottom = (by + BLOCK_SIZE) - p.y;
      
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      
      if (minOverlap === overlapTop && p.vy >= 0) {
        p.y = by - p.height; p.vy = 0; p.onGround = true;
      } else if (minOverlap === overlapBottom && p.vy < 0) {
        p.y = by + BLOCK_SIZE; p.vy = 0;
      } else if (minOverlap === overlapLeft && p.vx > 0) {
        p.x = bx - p.width; p.vx = 0;
      } else if (minOverlap === overlapRight && p.vx < 0) {
        p.x = bx + BLOCK_SIZE; p.vx = 0;
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
      p.vx += dx * 0.025;
      p.vy += dy * 0.025;
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
    
    // レバー
    for (const lever of LEVERS) {
      if (p.hand.x >= lever.x && p.hand.x <= lever.x + lever.w &&
          p.hand.y >= lever.y && p.hand.y <= lever.y + lever.h) {
        p.hand.attached = true;
        p.hand.x = lever.x + lever.w/2;
        p.hand.y = lever.y + lever.h/2;
        p.hand.targetType = 'lever';
        p.hand.targetId = lever.id;
        p.state = 'hand_mode';
        return;
      }
    }
    
    // 動かせる物体
    for (const mv of MOVABLES) {
      if (mv.heldBy && mv.heldBy !== p.id) continue;
      if (p.hand.x >= mv.x && p.hand.x <= mv.x + mv.w &&
          p.hand.y >= mv.y && p.hand.y <= mv.y + mv.h) {
        p.hand.attached = true;
        p.hand.x = mv.x + mv.w/2;
        p.hand.y = mv.y + mv.h/2;
        p.hand.targetType = 'movable';
        p.hand.targetId = mv.id;
        mv.heldBy = p.id;
        p.state = 'hand_mode';
        return;
      }
    }
    
    // 壁
    const hit = lineBlockIntersect(sx, sy, p.hand.x, p.hand.y);
    if (hit) {
      p.hand.attached = true;
      p.hand.x = hit.x;
      p.hand.y = hit.y;
      p.hand.targetType = 'wall';
      p.state = 'hand_mode';
      return;
    }
    
    if (p.hand.x < 0 || p.hand.x > GAME_WIDTH || p.hook.y < 0 || p.hand.y > GAME_HEIGHT) {
      p.hand.active = false; p.state = 'normal';
    }
  } else {
    if (p.hand.targetType === 'lever') {
      const lever = LEVERS.find(l => l.id === p.hand.targetId);
      if (lever) {
        const dx = lever.x + lever.w/2 - sx;
        const dy = lever.y + lever.h/2 - sy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 60) {
          lever.pulled = !lever.pulled;
          const door = DOORS.find(d => d.id === lever.targetDoor);
          if (door) door.open = lever.pulled;
          p.hand.active = false;
          p.state = 'normal';
        } else {
          p.vx += dx * 0.01;
          p.vy += dy * 0.01;
        }
      }
    } else if (p.hand.targetType === 'movable') {
      const mv = MOVABLES.find(m => m.id === p.hand.targetId);
      if (mv) {
        const targetX = sx + Math.cos(p.hand.moveAngle * Math.PI / 180) * 50;
        const targetY = sy + Math.sin(p.hand.moveAngle * Math.PI / 180) * 50;
        mv.x += (targetX - mv.x - mv.w/2) * 0.15;
        mv.y += (targetY - mv.y - mv.h/2) * 0.15;
        mv.vx = p.vx * 0.5;
        mv.vy = p.vy * 0.5;
        p.hand.x = mv.x + mv.w/2;
        p.hand.y = mv.y + mv.h/2;
      }
    } else if (p.hand.targetType === 'wall') {
      const dx = p.hand.x - sx;
      const dy = p.hand.y - sy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 10) {
        p.hand.active = false;
        p.state = 'normal';
      }
    }
  }
}

function updateMovables() {
  for (const mv of MOVABLES) {
    if (mv.heldBy) {
      const holder = players[mv.heldBy];
      if (!holder || !holder.hand.active || holder.hand.targetId !== mv.id) {
        mv.heldBy = null;
      }
    }
    if (!mv.heldBy) {
      mv.vy += GRAVITY;
      mv.x += mv.vx;
      mv.y += mv.vy;
      
      const c1 = Math.floor(mv.x / BLOCK_SIZE);
      const c2 = Math.floor((mv.x + mv.w) / BLOCK_SIZE);
      const r1 = Math.floor(mv.y / BLOCK_SIZE);
      const r2 = Math.floor((mv.y + mv.h) / BLOCK_SIZE);
      
      for (let c = c1; c <= c2; c++) {
        for (let r = r1; r <= r2; r++) {
          const b = blockAt(c, r);
          if (b && b.type === 1) {
            const by = b.r * BLOCK_SIZE;
            if (mv.vy > 0 && mv.y + mv.h > by && mv.y + mv.h - mv.vy <= by) {
              mv.y = by - mv.h;
              mv.vy = 0;
            }
          }
        }
      }
      mv.vx *= 0.9;
      if (Math.abs(mv.vx) < 0.1) mv.vx = 0;
    }
  }
}

function updateDoors() {
  for (const d of DOORS) {
    if (d.open && d.openHeight < d.h) d.openHeight += 2;
    if (!d.open && d.openHeight > 0) d.openHeight -= 2;
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

function checkWarpPads(p) {
  if (p.zone !== 'battle') return;
  for (const wp of WARP_PADS) {
    if (p.x + p.width > wp.x && p.x < wp.x + wp.w &&
        p.y + p.height > wp.y && p.y < wp.y + wp.h) {
      const sp = MAPS[0].spawnPoints[Math.floor(Math.random() * MAPS[0].spawnPoints.length)];
      p.x = sp.x + (Math.random() - 0.5) * 100;
      p.y = sp.y;
      p.vx = 0; p.vy = 0;
      break;
    }
  }
}

function updatePhysics() {
  for (const id in players) {
    const p = players[id];
    p.invincible = Math.max(0, p.invincible - 1);
    
    // 帰還タイマー
    if (p.returning) {
      p.returnTimer--;
      if (p.returnTimer <= 0) {
        p.returning = false;
        p.zone = 'rest';
        p.x = REST_ZONE.x + REST_ZONE.w/2;
        p.y = REST_ZONE.y + REST_ZONE.h/2;
        p.vx = 0; p.vy = 0;
        p.hook.active = false;
        p.hand.active = false;
        p.state = 'normal';
      }
      continue;
    }
    
    if (p.zone === 'rest') {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.9; p.vy *= 0.9;
      p.x = Math.max(REST_ZONE.x, Math.min(REST_ZONE.x + REST_ZONE.w - p.width, p.x));
      p.y = Math.max(REST_ZONE.y, Math.min(REST_ZONE.y + REST_ZONE.h - p.height, p.y));
      continue;
    }
    
    if (p.state !== 'hand_mode') p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    
    resolveBlockCollision(p);
    checkWarpPads(p);
    
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
  updateMovables();
  updateDoors();
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
    levers: LEVERS, doors: DOORS, movables: MOVABLES,
    warpPads: WARP_PADS, restZone: REST_ZONE,
    shopNpc: SHOP_NPC, maps: MAPS,
    blockSize: BLOCK_SIZE
  });
}, 1000 / 60);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  players[socket.id] = createPlayer(socket.id);
  
  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;
    
    if (data.mouseX !== undefined) p.mouseX = data.mouseX;
    if (data.mouseY !== undefined) p.mouseY = data.mouseY;
    
    const speed = 1.0;
    
    // 帰還中は操作不可
    if (p.returning) return;
    
    if (p.zone === 'rest') {
      if (data.left) p.vx -= speed;
      if (data.right) p.vx += speed;
      if (data.up) p.vy -= speed;
      if (data.down) p.vy += speed;
      return;
    }
    
    if (p.state === 'hand_mode' && p.hand.attached) {
      if (data.left) p.hand.moveAngle -= 3;
      if (data.right) p.hand.moveAngle += 3;
      
      if (data.pasta) {
        const mv = MOVABLES.find(m => m.id === p.hand.targetId);
        if (mv) mv.heldBy = null;
        p.hand.active = false;
        p.state = 'normal';
      }
      
      // 休憩所では射撃不可
      if (data.attack && p.x < REST_ZONE.x) {
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
    
    // S: フック（トグル）
    if (data.hook) {
      if (p.hook.active) {
        p.hook.active = false;
        p.state = 'normal';
      } else if (p.state !== 'hand_mode') {
        const angle = Math.atan2(p.mouseY - (p.y + p.height/2), p.mouseX - (p.x + p.width/2));
        p.hook.active = true;
        p.hook.attached = false;
        p.hook.len = 0;
        p.hook.angle = angle * 180 / Math.PI;
      }
    }
    
    // W: ハンド
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
    
    // スペース: 攻撃（休憩所では不可）
    if (data.attack && p.state === 'normal' && p.x < REST_ZONE.x) {
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
    
    // H: 帰還（3秒ディレイ）
    if (data.rest && !p.returning && p.zone !== 'rest') {
      p.returning = true;
      p.returnTimer = 180; // 3秒 (60fps)
      p.vx = 0; p.vy = 0;
    }
  });
  
  socket.on('selectSpawn', (mapIndex, spawnIndex) => {
    const p = players[socket.id];
    if (!p) return;
    p.zone = 'battle';
    p.returning = false;
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
