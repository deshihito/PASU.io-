const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const C = require('../shared/constants');
const maps = require('./maps');
const physics = require('./physics');
const weapons = require('./weapons');
const shop = require('./shop');
const rooms = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../docs')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/index.html'));
});

const { BLOCK_SIZE, GAME_WIDTH, GAME_HEIGHT } = maps;

// ===== オブジェクト =====
const WARP_PADS = [
  { x: 500, y: 520, w: 50, h: 10 },
  { x: 1500, y: 520, w: 50, h: 10 },
  { x: 2500, y: 520, w: 50, h: 10 }
];
const REST_ZONE = { x: 3200, y: 0, w: 600, h: 800 };
const SHOP_NPC = { x: 3450, y: 400, w: 40, h: 50 };
const MAPS = maps.getMapList();
const WORLD_STATES = MAPS.map((map, index) => ({
  terrain: maps.createWorld(index),
  levers: index === 0 ? [
    { id: 'lever1', x: 400, y: 520, w: 30, h: 40, pulled: false, targetDoor: 'door1' },
    { id: 'lever2', x: 1200, y: 360, w: 30, h: 40, pulled: false, targetDoor: 'door2' }
  ] : [],
  doors: index === 0 ? [
    { id: 'door1', x: 800, y: 400, w: 40, h: 120, open: false, openHeight: 0 },
    { id: 'door2', x: 1800, y: 280, w: 40, h: 120, open: false, openHeight: 0 }
  ] : [],
  movables: index === 0 ? [
    { id: 'box1', x: 300, y: 500, w: 40, h: 40, vx: 0, vy: 0, heldBy: null },
    { id: 'box2', x: 900, y: 400, w: 50, h: 50, vx: 0, vy: 0, heldBy: null },
    { id: 'box3', x: 1600, y: 300, w: 35, h: 60, vx: 0, vy: 0, heldBy: null }
  ] : []
}));

const players = {};
const bullets = [];
const traps = [];
const globalKillLog = [];
const killStreaks = {}; // 連続キル管理

function createPlayer(id) {
  return {
    id, x: 300, y: 500, vx: 0, vy: 0,
    width: C.PLAYER_W, height: C.PLAYER_H,
    angle: 0, state: 'normal',
    hook: { active: false, x: 0, y: 0, attached: false, len: 0, angle: 0 },
    hand: { active: false, x: 0, y: 0, attached: false, angle: 0, len: 0, moveAngle: 0, targetType: null, targetId: null },
    zone: 'battle', hp: 100, maxHp: 100, coins: 0,
    color: `hsl(${Math.random() * 360}, 70%, 55%)`,
    facing: 1, mouseX: 0, mouseY: 0,
    onGround: false, invincible: 0,
    slots: [null, null, null, null],
    activeSlot: 0,
    subWeapon: null,
    skinColor: null,
    returning: false, returnTimer: 0,
    inBush: false, onIce: false,
    windX: 0, windY: 0,
    coyoteTime: 0,
    dashCooldown: 0, lastDashDir: 0, dashCount: 0,
    speedBoost: 0, speedMult: 1,
    roomId: null, team: C.TEAM_NONE,
    lastKeyTime: {},
    hookCooldown: 0,
    chargeLevel: 0,
    charging: false,
    bufferedAttack: false,
    airBrake: false,
    hookInputWasDown: false,
    hookJumpTimer: 0,
    mapIndex: 0
  };
}

function getPlayerWeapon(p) {
  const slot = p.slots[p.activeSlot];
  return slot || weapons.createWeapon(C.WEAPON_SPAGHETTI_GUN);
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  players[socket.id] = createPlayer(socket.id);
  
  socket.on('joinRoom', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const room = rooms.getOrCreateRoom(data.mode || C.MODE_DEATHMATCH);
    if (rooms.joinRoom(socket.id, room, data.team || C.TEAM_NONE)) {
      p.roomId = room.id;
      p.team = rooms.rooms[room.id].teams[C.TEAM_RED].includes(socket.id) ? C.TEAM_RED :
               rooms.rooms[room.id].teams[C.TEAM_BLUE].includes(socket.id) ? C.TEAM_BLUE : C.TEAM_NONE;
      socket.join(room.id);
      socket.emit('roomJoined', rooms.getRoomState(room));
      io.to(room.id).emit('playerJoined', { id: socket.id, count: room.players.length });
      if (room.players.length >= 2 && !room.matchStarted) {
        rooms.startMatch(room);
        io.to(room.id).emit('matchStart', { mode: room.mode, startTime: room.startTime });
      }
    }
  });
  
  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const worldState = WORLD_STATES[p.mapIndex] || WORLD_STATES[0];
    if (data.mouseX !== undefined) p.mouseX = data.mouseX;
    if (data.mouseY !== undefined) p.mouseY = data.mouseY;
    
    const now = Date.now();
    const hookDown = Boolean(data.hook);
    const hookPressed = hookDown && !p.hookInputWasDown;
    p.hookInputWasDown = hookDown;
    
    // 帰還キャンセル
    if (p.returning) {
      if (data.rest) { 
        p.returning = false; 
        p.returnTimer = 0; 
      }
      return;
    }
    
    if (p.zone === 'rest') return;
    
    // 移動はフックのみ。左右入力・ダッシュ・空中ブレーキは受け付けない。
    p.vx = 0;
    p.airBrake = false;
    
    if (p.state === 'hand_mode' && p.hand.attached) {
      if (data.left) p.hand.moveAngle -= 3;
      if (data.right) p.hand.moveAngle += 3;
      if (data.pasta) {
        const mv = worldState.movables.find(m => m.id === p.hand.targetId);
        if (mv) mv.heldBy = null;
        physics.releaseHand(p);
      }
      return;
    }
    
    // コヨーテタイム
    if (data.jump && (p.onGround || p.coyoteTime > 0)) {
      p.vy = -12 * C.TIME_SCALE; p.onGround = false; p.coyoteTime = 0;
    }
    
    // マウス／S長押し：押している間だけフックを維持する。
    if (!hookDown && p.hook.active) {
      physics.releaseHook(p);
    } else if (hookPressed && !p.hook.active && p.state !== 'hand_mode' && p.hookCooldown <= 0) {
      const angle = Math.atan2(p.mouseY - (p.y + p.height/2), p.mouseX - (p.x + p.width/2));
      p.hook.active = true; p.hook.attached = false; p.hook.len = 0;
      p.hook.angle = angle * 180 / Math.PI;
      p.hookCooldown = C.HOOK_COOLDOWN;
    }
    
    // W: ハンド
    if (data.pasta && p.state !== 'hand_mode') {
      if (p.hand.active && !p.hand.attached) { physics.releaseHand(p); }
      else if (!p.hand.active) {
        const angle = Math.atan2(p.mouseY - (p.y + p.height/2), p.mouseX - (p.x + p.width/2));
        p.hand.active = true; p.hand.attached = false; p.hand.len = 0;
        p.hand.angle = angle * 180 / Math.PI;
      }
    }
    
    // Q/E: スロット切り替え
    if (data.slotPrev) p.activeSlot = (p.activeSlot + 3) % 4;
    if (data.slotNext) p.activeSlot = (p.activeSlot + 1) % 4;
    if (data.slot1 !== undefined) p.activeSlot = 0;
    if (data.slot2 !== undefined) p.activeSlot = 1;
    if (data.slot3 !== undefined) p.activeSlot = 2;
    if (data.slot4 !== undefined) p.activeSlot = 3;
    
    // F: サブウェポン
    if (data.subWeapon && p.subWeapon) {
      weapons.useSubWeapon(p, p.subWeapon, now, traps, rooms.rooms[p.roomId]?.smokeScreens || []);
    }
    
    // H: 帰還（3秒）
    if (data.rest && !p.returning && p.zone !== 'rest') {
      p.returning = true; p.returnTimer = C.RETURN_TIME;
      p.vx = 0; p.vy = 0;
    }
  });
  
  socket.on('buyItem', (itemId) => {
    const p = players[socket.id];
    if (!p || p.zone !== 'rest') return;
    const result = shop.buyItem(p, itemId);
    socket.emit('shopResult', result);
  });
  
  socket.on('selectSpawn', (mapIndex, spawnIndex) => {
    const p = players[socket.id];
    if (!p) return;
    const safeMapIndex = Number.isInteger(mapIndex) && MAPS[mapIndex] ? mapIndex : 0;
    const selectedMap = MAPS[safeMapIndex];
    const safeSpawnIndex = Number.isInteger(spawnIndex) && selectedMap.spawnPoints[spawnIndex]
      ? spawnIndex : 0;
    p.zone = 'battle'; p.returning = false;
    p.mapIndex = safeMapIndex;
    const sp = selectedMap.spawnPoints[safeSpawnIndex];
    p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0;
    p.invincible = C.SPAWN_INVINCIBLE;
  });
  
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const p = players[socket.id];
    if (p && p.roomId && rooms.rooms[p.roomId]) {
      rooms.leaveRoom(socket.id, rooms.rooms[p.roomId]);
    }
    delete players[socket.id];
    delete killStreaks[socket.id];
  });
});

// ===== ゲームループ =====
setInterval(() => {
  const now = Date.now();
  for (const id in players) {
    const p = players[id];
    const worldState = WORLD_STATES[p.mapIndex] || WORLD_STATES[0];
    p.invincible = Math.max(0, p.invincible - 1);
    p.hookJumpTimer = Math.max(0, p.hookJumpTimer - 1);
    p.speedBoost = Math.max(0, p.speedBoost - 1);
    p.hookCooldown = Math.max(0, p.hookCooldown - 1);
    if (p.speedBoost <= 0) p.speedMult = 1;
    
    // 帰還処理
    if (p.returning) {
      p.returnTimer--;
      if (p.returnTimer <= 0) {
        p.returning = false; p.zone = 'rest';
        p.x = REST_ZONE.x + REST_ZONE.w/2;
        p.y = REST_ZONE.y + REST_ZONE.h/2;
        p.vx = 0; p.vy = 0;
        p.hook.active = false; p.hand.active = false; p.state = 'normal';
      }
      continue;
    }
    
    if (p.zone === 'rest') {
      p.x += p.vx * C.TIME_SCALE; p.y += p.vy * C.TIME_SCALE;
      p.vx *= 0.9; p.vy *= 0.9;
      p.x = Math.max(REST_ZONE.x, Math.min(REST_ZONE.x + REST_ZONE.w - p.width, p.x));
      p.y = Math.max(REST_ZONE.y, Math.min(REST_ZONE.y + REST_ZONE.h - p.height, p.y));
      continue;
    }
    
    // 物理
    if (p.state !== 'hand_mode') p.vy += C.GRAVITY * C.TIME_SCALE;
    physics.resolveBlockCollision(p, worldState.terrain);
    physics.checkWarpPads(p, WARP_PADS, worldState.terrain);
    
    // コヨーテタイム
    if (p.onGround) p.coyoteTime = 6;
    else p.coyoteTime = Math.max(0, p.coyoteTime - 1);
    
    // 氷上滑り
    if (p.onIce) { p.vx *= 0.99; }
    else if (!p.onGround && p.state !== 'hooked' && p.state !== 'hand_mode') {
      p.vx *= 0.98;
    } else if (p.state === 'normal') {
      p.vx *= 0.85;
    }
    
    // 壁・天井制限
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x > GAME_WIDTH - p.width) { p.x = GAME_WIDTH - p.width; p.vx = 0; }
    if (p.y < 0 && !MAPS[p.mapIndex].infinite) { p.y = 0; p.vy = 0; }
    
    // 落下ダメージ
    if (p.vy > 15 && p.onGround) {
      const fallDmg = Math.floor((p.vy - 15) * 2);
      if (fallDmg > 0 && p.invincible <= 0) {
        p.hp -= fallDmg;
        p.invincible = 10;
      }
    }
    
    physics.updateHook(p, worldState.terrain);
    physics.updateHand(p, worldState.levers, worldState.doors, worldState.movables, worldState.terrain);
    physics.checkDeath(p, worldState.terrain);
  }
  
  for (const worldState of WORLD_STATES) {
    const worldPlayers = Object.fromEntries(Object.entries(players).filter(([, p]) => p.mapIndex === worldState.terrain.mapIndex));
    maps.ensureWorldChunks(worldState.terrain, worldPlayers);
    physics.updateMovables(worldState.movables, worldPlayers, worldState.terrain);
    physics.updateDoors(worldState.doors);
    physics.updateCollapseBlocks(worldState.terrain.blocks);
  }
  // 射撃を無効化しているため、共有弾配列は毎フレーム空に保つ。
  bullets.length = 0;
  physics.updateTraps(traps, players);
  
  // キル処理・スコア・連続キル
  for (const id in players) {
    const p = players[id];
    if (p.hp <= 0 && p.zone === 'battle') {
      // 最後にダメージを与えたプレイヤーを探す
      // 簡易実装：弾のownerを追跡する必要があるが、現状では難しいので
      // 代わりに近くのプレイヤーを探す（簡易版）
      let killer = null;
      let minDist = Infinity;
      for (const otherId in players) {
        if (otherId === id) continue;
        const other = players[otherId];
        if (other.zone !== 'battle') continue;
        const dx = other.x - p.x;
        const dy = other.y - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist && dist < 500) {
          minDist = dist;
          killer = otherId;
        }
      }
      
      if (killer) {
        const room = p.roomId ? rooms.rooms[p.roomId] : null;
        if (room) {
          rooms.addKillLog(room, killer, id, 'default');
          room.scores[killer].kills++;
          room.scores[id].deaths++;
          
          // 連続キル
          killStreaks[killer] = (killStreaks[killer] || 0) + 1;
          if (killStreaks[killer] >= 2) {
            io.to(room.id).emit('combo', { player: killer, count: killStreaks[killer] });
          }
          killStreaks[id] = 0;
          
          shop.onKill(players[killer]);
        }
      }
      
      // リスポーン
      p.hp = p.maxHp; p.vx = 0; p.vy = 0;
      p.hook.active = false; p.hand.active = false; p.state = 'normal';
      p.invincible = C.SPAWN_INVINCIBLE;
      const respawnMap = MAPS[p.mapIndex] || MAPS[0];
      const sp = respawnMap.spawnPoints[Math.floor(Math.random() * respawnMap.spawnPoints.length)];
      p.x = sp.x; p.y = sp.y;
    }
  }
  
  // ルーム更新
  for (const roomId in rooms.rooms) {
    const room = rooms.rooms[roomId];
    rooms.updateKOTH(room, players);
    rooms.updateBR(room);
    const winner = rooms.checkWinCondition(room);
    if (winner) {
      rooms.endMatch(room);
      io.to(roomId).emit('matchEnd', { winner, scores: room.scores });
    }
  }
  
  // マップごとに独立した状態だけを各クライアントへ配信する。
  for (const id in players) {
    const player = players[id];
    const worldState = WORLD_STATES[player.mapIndex] || WORLD_STATES[0];
    const visiblePlayers = Object.fromEntries(
      Object.entries(players).filter(([, other]) => other.mapIndex === player.mapIndex)
    );
    io.to(id).emit('state', {
      players: visiblePlayers,
      blocks: worldState.terrain.blocks,
      bullets: [],
      levers: worldState.levers,
      doors: worldState.doors,
      movables: worldState.movables,
      warpPads: WARP_PADS,
      restZone: REST_ZONE,
      shopNpc: SHOP_NPC,
      maps: MAPS,
      currentMapIndex: player.mapIndex,
      blockSize: BLOCK_SIZE,
      killLog: globalKillLog.slice(0, 5),
      traps: traps.map(t => ({ x: t.x, y: t.y, radius: t.radius, life: t.life })),
      smokeScreens: rooms.rooms[Object.keys(rooms.rooms)[0]]?.smokeScreens || []
    });
  }
}, 1000 / 60);

server.listen(PORT, () => {
  console.log(`PASU.io Server running on port ${PORT}`);
});
