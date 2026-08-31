const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const TICK_MS = 50;
const WORLD = { width: 2400, floorY: 700 };
const COLORS = ['#f26a3d', '#18a8a8', '#f0bf4d', '#a56dff', '#70c1b3', '#ef476f'];

app.use(express.static(path.join(__dirname, '../docs')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../docs/index.html')));

const rooms = new Map();

function code() {
  let value;
  do value = Math.random().toString(36).slice(2, 6).toUpperCase();
  while (rooms.has(value));
  return value;
}

function randomSeed() { return Math.floor(Math.random() * 0xffffffff); }

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createMap(seed) {
  const next = rng(seed);
  const platforms = [{ id: 'start', x: 860, y: WORLD.floorY, w: 680, h: 30, tier: 0, gimmick: 'start', broken: false }];
  const items = [];
  let previousX = 1060;

  for (let index = 1; index <= 26; index += 1) {
    const tier = Math.floor(index / 4);
    const width = Math.max(72, 268 - index * 6 - tier * 9 + Math.floor(next() * 34));
    const gap = 82 + index * 5 + tier * 7;
    const jump = Math.floor(next() * (330 + index * 7)) - Math.floor(165 + index * 2);
    const x = Math.max(70, Math.min(WORLD.width - width - 70, previousX + jump));
    const y = WORLD.floorY - index * gap;
    const gimmick = index < 5 ? 'plain' : index % 6 === 0 ? 'needle' : index % 5 === 0 ? 'collapse' : index % 3 === 0 ? 'sway' : 'plain';
    const platform = {
      id: `p${index}`, x, baseX: x, y, w: width, h: 22, tier, gimmick, broken: false,
      phase: next() * Math.PI * 2,
      amp: gimmick === 'sway' ? Math.min(170, 48 + index * 5) : 0,
      speed: 0.0008 + index * 0.00004,
      breakAt: 0,
    };
    platforms.push(platform);
    if (index % 2 === 0 || index === 3) {
      items.push({ id: `scrap${index}`, x: x + width * (0.3 + next() * 0.4), y: y - 34, type: index % 6 === 0 ? 'relic' : 'scrap', collected: false });
    }
    previousX = x + width / 2;
  }

  const top = platforms[platforms.length - 1];
  platforms.push({ id: 'finish', x: Math.max(80, top.x - 50), y: top.y - 92, w: top.w + 100, h: 24, tier: 7, gimmick: 'finish', broken: false });
  return { platforms, items, finish: { x: top.x + top.w / 2, y: top.y - 130 }, maxTier: 7 };
}

function createPlayer(id, name, index) {
  return {
    id,
    name: String(name || 'PASTA').slice(0, 12).toUpperCase(),
    color: COLORS[index % COLORS.length],
    x: 1100 + index * 42,
    y: WORLD.floorY - 62,
    vx: 0,
    vy: 0,
    w: 58,
    h: 30,
    onGround: false,
    score: 0,
    input: { move: 0, hook: false, aimX: 1100, aimY: 580 },
    hook: null,
    roomId: null,
    finished: false,
    fallCount: 0,
    checkpointY: WORLD.floorY - 62,
  };
}

function addPlayer(room, id, name) {
  const player = createPlayer(id, name, room.players.size);
  player.roomId = room.id;
  room.players.set(id, player);
  return player;
}

function createRoom(hostId, hostName) {
  const id = code();
  const room = { id, hostId, seed: randomSeed(), map: null, players: new Map(), started: false };
  room.map = createMap(room.seed);
  addPlayer(room, hostId, hostName);
  rooms.set(id, room);
  return room;
}

function spawnPlayer(player, room, preserveCheckpoint = false) {
  if (!preserveCheckpoint) {
    const start = room.map.platforms[0];
    const slot = Array.from(room.players.keys()).indexOf(player.id);
    player.checkpointY = start.y - player.h;
    player.x = start.x + 80 + slot * 44;
    player.y = player.checkpointY;
  } else {
    player.y = player.checkpointY;
    player.x = Math.max(80, Math.min(WORLD.width - player.w - 80, player.x));
  }
  player.vx = 0;
  player.vy = 0;
  player.hook = null;
  player.finished = false;
}

function removePlayer(socketId) {
  for (const room of rooms.values()) {
    if (!room.players.has(socketId)) continue;
    room.players.delete(socketId);
    if (room.hostId === socketId) room.hostId = room.players.keys().next().value || null;
    if (room.players.size === 0) rooms.delete(room.id);
    return room;
  }
  return null;
}

function distance(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function difficulty(platform) { return Math.min(99, Math.round((platform.tier / 7) * 100)); }

function chooseHookTarget(player, room) {
  const aimX = Number.isFinite(player.input.aimX) ? player.input.aimX : player.x;
  const aimY = Number.isFinite(player.input.aimY) ? player.input.aimY : player.y;
  const originX = player.x + player.w / 2;
  const originY = player.y + player.h / 2;
  const aimAngle = Math.atan2(aimY - originY, aimX - originX);
  const candidates = [];

  for (const other of room.players.values()) {
    if (other.id === player.id || other.finished) continue;
    const targetX = other.x + other.w / 2;
    const targetY = other.y + other.h / 2;
    const dist = distance(originX, originY, targetX, targetY);
    const angle = Math.atan2(targetY - originY, targetX - originX);
    const delta = Math.abs(Math.atan2(Math.sin(angle - aimAngle), Math.cos(angle - aimAngle)));
    if (dist < 560 && delta < 0.6) candidates.push({ type: 'player', id: other.id, x: targetX, y: targetY, dist, delta });
  }

  for (const platform of room.map.platforms) {
    if (platform.broken) continue;
    const targetX = Math.max(platform.x + 12, Math.min(platform.x + platform.w - 12, aimX));
    const targetY = platform.y;
    const dist = distance(originX, originY, targetX, targetY);
    const angle = Math.atan2(targetY - originY, targetX - originX);
    const delta = Math.abs(Math.atan2(Math.sin(angle - aimAngle), Math.cos(angle - aimAngle)));
    const range = 640 - Math.min(220, platform.tier * 16);
    if (dist < range && delta < 0.46) candidates.push({ type: 'platform', id: platform.id, x: targetX, y: targetY, dist, delta, tier: platform.tier });
  }

  candidates.sort((a, b) => (a.delta * 310 + a.dist) - (b.delta * 310 + b.dist));
  const target = candidates[0];
  return target ? { type: target.type, id: target.id, x: target.x, y: target.y, len: target.dist, tier: target.tier || 0 } : null;
}

function beginHook(player, room) { if (!player.hook) player.hook = chooseHookTarget(player, room); }

function updateHook(player, room) {
  if (!player.input.hook) { player.hook = null; return; }
  beginHook(player, room);
  if (!player.hook) return;

  let tx = player.hook.x;
  let ty = player.hook.y;
  if (player.hook.type === 'player') {
    const target = room.players.get(player.hook.id);
    if (!target) { player.hook = null; return; }
    tx = target.x + target.w / 2;
    ty = target.y + target.h / 2;
    player.hook.x = tx;
    player.hook.y = ty;
    const targetDx = player.x + player.w / 2 - tx;
    const targetDy = player.y + player.h / 2 - ty;
    target.vx += targetDx * 0.008;
    target.vy += targetDy * 0.006;
  }

  const originX = player.x + player.w / 2;
  const originY = player.y + player.h / 2;
  const dx = tx - originX;
  const dy = ty - originY;
  const len = Math.hypot(dx, dy);
  player.hook.len = len;
  if (len > 700) { player.hook = null; return; }
  if (len > 48) {
    const force = player.hook.type === 'platform' ? 0.54 + player.hook.tier * 0.035 : 0.4;
    player.vx += (dx / len) * force;
    player.vy += (dy / len) * force;
  }
}

function updateMap(room, now) {
  for (const platform of room.map.platforms) {
    if (platform.amp) platform.x = platform.baseX + Math.sin(now * platform.speed + platform.phase) * platform.amp;
    if (platform.breakAt && now >= platform.breakAt) platform.broken = true;
  }
}

function collidePlatforms(player, room, oldBottom, now) {
  player.onGround = false;
  for (const platform of room.map.platforms) {
    if (platform.broken) continue;
    const overlapsX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
    const bottom = player.y + player.h;
    if (overlapsX && player.vy >= 0 && oldBottom <= platform.y + 8 && bottom >= platform.y) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
      if (platform.gimmick === 'needle' && player.x + player.w * 0.75 > platform.x + platform.w * 0.42 && player.x + player.w * 0.25 < platform.x + platform.w * 0.7) {
        spawnPlayer(player, room, false);
        player.fallCount += 1;
        return;
      }
      if (platform.gimmick === 'collapse' && !platform.breakAt) platform.breakAt = now + 680;
      if (platform.tier > 0) player.checkpointY = platform.y - player.h;
      return;
    }
  }
}

function updatePlayer(player, room, now) {
  if (!room.started || player.finished) return;
  if (player.input.move) player.vx += player.input.move * (0.56 + Math.min(0.22, player.y < -700 ? 0.22 : 0));
  player.vx = Math.max(-7.2, Math.min(7.2, player.vx));
  if (!player.input.move) player.vx *= 0.82;
  player.vy += 0.47;
  const oldBottom = player.y + player.h;
  updateHook(player, room);
  player.x += player.vx;
  player.y += player.vy;
  player.x = Math.max(0, Math.min(WORLD.width - player.w, player.x));
  collidePlatforms(player, room, oldBottom, now);
  if (player.y > WORLD.floorY + 520) {
    player.fallCount += 1;
    spawnPlayer(player, room, true);
  }

  for (const item of room.map.items) {
    if (item.collected) continue;
    if (distance(player.x + player.w / 2, player.y + player.h / 2, item.x, item.y) < 42) {
      item.collected = true;
      player.score += item.type === 'relic' ? 3 : 1;
      io.to(room.id).emit('itemCollected', { itemId: item.id, playerId: player.id, score: player.score });
    }
  }

  if (player.y < room.map.finish.y + 40 && distance(player.x + player.w / 2, player.y + player.h / 2, room.map.finish.x, room.map.finish.y) < 110) {
    player.finished = true;
    io.to(room.id).emit('finish', { playerId: player.id });
  }
}

function publicState(room) {
  return {
    room: { id: room.id, hostId: room.hostId, started: room.started, seed: room.seed },
    map: room.map,
    players: Array.from(room.players.values()).map((player) => ({ id: player.id, name: player.name, color: player.color, x: player.x, y: player.y, w: player.w, h: player.h, vx: player.vx, vy: player.vy, onGround: player.onGround, score: player.score, finished: player.finished, fallCount: player.fallCount, hook: player.hook })),
  };
}

function broadcast(room) { io.to(room.id).emit('state', publicState(room)); }

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => {
    const room = createRoom(socket.id, name);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.emit('roomJoined', publicState(room));
  });

  socket.on('joinRoom', ({ code: roomCode, name }) => {
    const room = rooms.get(String(roomCode || '').trim().toUpperCase());
    if (!room || room.started || room.players.size >= 6) { socket.emit('roomError', 'ROOM'); return; }
    const player = addPlayer(room, socket.id, name);
    spawnPlayer(player, room);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.emit('roomJoined', publicState(room));
    broadcast(room);
  });

  socket.on('startGame', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.hostId !== socket.id || room.started) return;
    room.started = true;
    for (const player of room.players.values()) spawnPlayer(player, room);
    broadcast(room);
  });

  socket.on('input', (input) => {
    const room = rooms.get(socket.data.roomId);
    const player = room?.players.get(socket.id);
    if (!player) return;
    player.input = { move: Math.max(-1, Math.min(1, Number(input?.move) || 0)), hook: Boolean(input?.hook), aimX: Number(input?.aimX) || player.x, aimY: Number(input?.aimY) || player.y };
  });

  socket.on('leaveRoom', () => {
    const room = removePlayer(socket.id);
    socket.leave(room?.id || '');
    socket.data.roomId = null;
    if (room) broadcast(room);
  });

  socket.on('disconnect', () => {
    const room = removePlayer(socket.id);
    if (room) broadcast(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    updateMap(room, now);
    for (const player of room.players.values()) updatePlayer(player, room, now);
    broadcast(room);
  }
}, TICK_MS);

server.listen(PORT, () => console.log(`Past.io server listening on ${PORT}`));
