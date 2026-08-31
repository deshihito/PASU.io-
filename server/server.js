const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../docs')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../docs/index.html')));

const rooms = new Map();
const TICK_MS = 50;
const WORLD = { width: 2400, height: 1500 };
const COLORS = ['#f26a3d', '#18a8a8', '#f0bf4d', '#a56dff', '#70c1b3', '#ef476f'];

function code() {
  let value;
  do value = Math.random().toString(36).slice(2, 6).toUpperCase();
  while (rooms.has(value));
  return value;
}

function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

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
  const platforms = [{ id: 'start', x: 860, y: 670, w: 680, h: 32 }];
  const items = [];
  let previousX = 1050;
  for (let index = 1; index <= 18; index += 1) {
    const width = 150 + Math.floor(next() * 140);
    const shift = Math.floor(next() * 420) - 210;
    const x = Math.max(120, Math.min(WORLD.width - width - 120, previousX + shift));
    const y = 670 - index * 82;
    platforms.push({ id: `p${index}`, x, y, w: width, h: 24 });
    if (index % 2 === 0) {
      items.push({ id: `scrap${index}`, x: x + width / 2, y: y - 38, type: index % 4 === 0 ? 'relic' : 'scrap', collected: false });
    }
    previousX = x + width / 2;
  }
  const top = platforms[platforms.length - 1];
  platforms.push({ id: 'finish', x: top.x - 40, y: top.y - 78, w: top.w + 80, h: 24 });
  return { platforms, items, finish: { x: top.x + top.w / 2, y: top.y - 114 } };
}

function createPlayer(id, name, index) {
  return {
    id,
    name: String(name || 'PLAYER').slice(0, 12).toUpperCase(),
    color: COLORS[index % COLORS.length],
    x: 1100 + index * 42,
    y: 610,
    vx: 0,
    vy: 0,
    w: 28,
    h: 44,
    onGround: false,
    score: 0,
    input: { move: 0, jump: false, hook: false, aimX: 1100, aimY: 600 },
    previousHook: false,
    hook: null,
    roomId: null,
    finished: false,
  };
}

function createRoom(hostId, hostName) {
  const id = code();
  const room = {
    id,
    hostId,
    seed: randomSeed(),
    map: null,
    players: new Map(),
    started: false,
    createdAt: Date.now(),
  };
  room.map = createMap(room.seed);
  addPlayer(room, hostId, hostName);
  rooms.set(id, room);
  return room;
}

function addPlayer(room, id, name) {
  const player = createPlayer(id, name, room.players.size);
  player.roomId = room.id;
  room.players.set(id, player);
  return player;
}

function spawnPlayer(player, room) {
  const start = room.map.platforms[0];
  player.x = start.x + 80 + (Array.from(room.players.keys()).indexOf(player.id) * 44);
  player.y = start.y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.hook = null;
  player.finished = false;
}

function removePlayer(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) {
      room.players.delete(socketId);
      if (room.hostId === socketId) room.hostId = room.players.keys().next().value || null;
      if (room.players.size === 0) rooms.delete(room.id);
      return room;
    }
  }
  return null;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

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
    if (dist < 520 && delta < 0.62) candidates.push({ type: 'player', id: other.id, x: targetX, y: targetY, dist, delta });
  }

  for (const platform of room.map.platforms) {
    const targetX = Math.max(platform.x + 16, Math.min(platform.x + platform.w - 16, aimX));
    const targetY = platform.y;
    const dist = distance(originX, originY, targetX, targetY);
    const angle = Math.atan2(targetY - originY, targetX - originX);
    const delta = Math.abs(Math.atan2(Math.sin(angle - aimAngle), Math.cos(angle - aimAngle)));
    if (dist < 620 && delta < 0.42) candidates.push({ type: 'platform', id: platform.id, x: targetX, y: targetY, dist, delta });
  }

  candidates.sort((a, b) => (a.delta * 280 + a.dist) - (b.delta * 280 + b.dist));
  const target = candidates[0];
  return target ? { type: target.type, id: target.id, x: target.x, y: target.y, len: target.dist } : null;
}

function beginHook(player, room) {
  if (player.hook) return;
  const target = chooseHookTarget(player, room);
  if (target) player.hook = target;
}

function updateHook(player, room) {
  if (!player.input.hook) {
    player.hook = null;
    return;
  }
  if (!player.hook) beginHook(player, room);
  if (!player.hook) return;

  let tx = player.hook.x;
  let ty = player.hook.y;
  if (player.hook.type === 'player') {
    const target = room.players.get(player.hook.id);
    if (!target) {
      player.hook = null;
      return;
    }
    tx = target.x + target.w / 2;
    ty = target.y + target.h / 2;
    player.hook.x = tx;
    player.hook.y = ty;
    const dx = player.x + player.w / 2 - tx;
    const dy = player.y + player.h / 2 - ty;
    const pull = Math.min(1.1, 0.34 + distance(player.x, player.y, tx, ty) / 900);
    target.vx += dx * 0.006 * pull;
    target.vy += dy * 0.006 * pull;
  }

  const originX = player.x + player.w / 2;
  const originY = player.y + player.h / 2;
  const dx = tx - originX;
  const dy = ty - originY;
  const len = Math.hypot(dx, dy);
  player.hook.len = len;
  if (len > 700) {
    player.hook = null;
    return;
  }
  if (len > 72) {
    player.vx += (dx / len) * 0.42;
    player.vy += (dy / len) * 0.42;
  }
}

function collidePlatforms(player, room, oldBottom) {
  player.onGround = false;
  for (const platform of room.map.platforms) {
    const overlapsX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
    const bottom = player.y + player.h;
    if (overlapsX && player.vy >= 0 && oldBottom <= platform.y + 4 && bottom >= platform.y) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
      break;
    }
  }
}

function updatePlayer(player, room) {
  const input = player.input;
  if (!room.started) return;
  if (player.finished) return;

  if (input.move) player.vx += input.move * 0.55;
  player.vx = Math.max(-6.5, Math.min(6.5, player.vx));
  if (!input.move) player.vx *= 0.84;
  if (input.jump && player.onGround) player.vy = -10.2;
  player.vy += 0.42;
  const oldBottom = player.y + player.h;
  updateHook(player, room);
  player.x += player.vx;
  player.y += player.vy;
  player.x = Math.max(0, Math.min(WORLD.width - player.w, player.x));
  collidePlatforms(player, room, oldBottom);

  for (const item of room.map.items) {
    if (item.collected) continue;
    if (distance(player.x + player.w / 2, player.y + player.h / 2, item.x, item.y) < 38) {
      item.collected = true;
      player.score += item.type === 'relic' ? 3 : 1;
      io.to(room.id).emit('itemCollected', { itemId: item.id, playerId: player.id, score: player.score });
    }
  }

  if (player.y < room.map.finish.y + 32 && distance(player.x + player.w / 2, player.y + player.h / 2, room.map.finish.x, room.map.finish.y) < 100) {
    player.finished = true;
    io.to(room.id).emit('finish', { playerId: player.id });
  }
  if (player.y > 900) spawnPlayer(player, room);
}

function publicState(room) {
  return {
    room: { id: room.id, hostId: room.hostId, started: room.started, seed: room.seed },
    map: room.map,
    players: Array.from(room.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      x: player.x,
      y: player.y,
      w: player.w,
      h: player.h,
      vx: player.vx,
      vy: player.vy,
      onGround: player.onGround,
      score: player.score,
      finished: player.finished,
      hook: player.hook,
    })),
  };
}

function broadcast(room) {
  io.to(room.id).emit('state', publicState(room));
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => {
    const room = createRoom(socket.id, name);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.emit('roomJoined', publicState(room));
  });

  socket.on('joinRoom', ({ code: roomCode, name }) => {
    const room = rooms.get(String(roomCode || '').trim().toUpperCase());
    if (!room || room.started || room.players.size >= 6) {
      socket.emit('roomError', 'ROOM');
      return;
    }
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
    player.input = {
      move: Math.max(-1, Math.min(1, Number(input?.move) || 0)),
      jump: Boolean(input?.jump),
      hook: Boolean(input?.hook),
      aimX: Number(input?.aimX) || player.x,
      aimY: Number(input?.aimY) || player.y,
    };
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
  for (const room of rooms.values()) {
    for (const player of room.players.values()) updatePlayer(player, room);
    broadcast(room);
  }
}, TICK_MS);

server.listen(PORT, () => console.log(`Past.io server listening on ${PORT}`));
