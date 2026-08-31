/* Past.io server: authored vertical challenge chunks with physics-first pasta grappling. */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const TICK_MS = 50;
const WORLD = { width: 2600, floorY: 720 };
const COLORS = ['#f26a3d', '#18a8a8', '#f0bf4d', '#a56dff', '#70c1b3', '#ef476f'];
const CHUNK_TYPES = ['zigzag', 'swing', 'collapse', 'gauntlet', 'carousel', 'shortcut', 'needle', 'swing'];

app.use(express.static(path.join(__dirname, '../docs')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../docs/index.html')));
const rooms = new Map();

function code() { let value; do value = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(value)); return value; }
function randomSeed() { return Math.floor(Math.random() * 0xffffffff); }
function rng(seed) { let value = seed >>> 0; return () => { value += 0x6d2b79f5; let t = value; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }

function createChunk(type, index, startX, startY, next) {
  const platforms = [];
  const hazards = [];
  const items = [];
  const gap = 94 + Math.min(28, index * 4);
  let cursorX = startX;
  const names = { zigzag: 'ZIGZAG', swing: 'SWING', collapse: 'COLLAPSE', gauntlet: 'GAUNTLET', carousel: 'CAROUSEL', shortcut: 'SHORTCUT', needle: 'NEEDLE' };
  const routes = {
    zigzag: [-310, 320, -280, 300, -250, 270],
    swing: [-180, 180, -150, 150, -120, 120],
    collapse: [-220, 90, 260, -90, -260, 170],
    gauntlet: [-120, 90, -80, 70, -55, 45],
    carousel: [0, 250, 0, -250, 0, 210],
    shortcut: [-230, -70, 120, 410, 40, -180],
    needle: [250, -245, 210, -205, 170, -165],
  };
  const route = routes[type] || routes.zigzag;

  for (let step = 0; step < 6; step += 1) {
    const tier = index + Math.floor(step / 3);
    const narrow = type === 'gauntlet' || type === 'needle' ? 64 + next() * 32 : 122 + next() * 74 - Math.min(34, index * 3);
    const offset = route[step] + (next() * 36 - 18);
    cursorX = clamp(cursorX + offset, 120, WORLD.width - narrow - 120);
    const y = startY - step * gap;
    const gimmick = type === 'swing' || type === 'carousel' ? 'moving' : type === 'collapse' && step > 0 ? 'collapse' : type === 'needle' ? 'needle' : 'plain';
    const platform = { id: `c${index}p${step}`, chunk: index, chunkType: type, x: cursorX, baseX: cursorX, y, w: narrow, h: 23, tier, gimmick, phase: next() * Math.PI * 2, amp: gimmick === 'moving' ? 55 + index * 10 : 0, speed: .001 + next() * .0014, broken: false, breakAt: 0, checkpoint: step === 5 };
    platforms.push(platform);
    if (gimmick === 'needle' || (type === 'gauntlet' && step % 2 === 1)) hazards.push({ id: `h${index}-${step}`, platformId: platform.id, offset: narrow * (0.3 + next() * 0.35), w: Math.max(18, narrow * .26), type: 'spike' });
    if (step === 2 || step === 5 || (type === 'shortcut' && step === 3)) items.push({ id: `i${index}-${step}`, platformId: platform.id, offset: narrow * (0.25 + next() * .5), x: cursorX + narrow / 2, y: y - 35, type: type === 'shortcut' && step === 3 ? 'relic' : 'scrap', value: type === 'shortcut' && step === 3 ? 5 : 1, collected: false });
    cursorX += narrow / 2;
  }

  if (type === 'shortcut') {
    const branch = platforms[2];
    const branchPlatform = { id: `c${index}branch`, chunk: index, chunkType: type, x: clamp(branch.x + 320, 120, WORLD.width - 200), baseX: clamp(branch.x + 320, 120, WORLD.width - 200), y: branch.y - 145, w: 84, h: 21, tier: index + 1, gimmick: 'needle', phase: 0, amp: 0, speed: 0, broken: false, breakAt: 0, checkpoint: false, branch: true };
    platforms.push(branchPlatform);
    hazards.push({ id: `hb${index}`, platformId: branchPlatform.id, offset: 24, w: 24, type: 'spike' });
    items.push({ id: `ib${index}`, platformId: branchPlatform.id, offset: 56, x: branchPlatform.x + 56, y: branchPlatform.y - 35, type: 'relic', value: 5, collected: false });
  }

  return { index, type, name: names[type] || type.toUpperCase(), platforms, hazards, items, endX: cursorX, endY: startY - 5 * gap };
}

function createMap(seed) {
  const next = rng(seed);
  const platforms = [{ id: 'start', chunk: 0, chunkType: 'start', x: 860, baseX: 860, y: WORLD.floorY, w: 820, h: 32, tier: 0, gimmick: 'plain', phase: 0, amp: 0, speed: 0, broken: false, breakAt: 0, checkpoint: true }];
  const hazards = [];
  const items = [];
  const chunks = [];
  let x = 1120;
  let y = WORLD.floorY - 118;
  for (let index = 0; index < 8; index += 1) {
    const type = CHUNK_TYPES[(index + Math.floor(next() * 2)) % CHUNK_TYPES.length];
    const chunk = createChunk(type, index + 1, x, y, next);
    chunks.push({ index: index + 1, type: chunk.type, name: chunk.name, difficulty: Math.min(99, 18 + index * 11) });
    platforms.push(...chunk.platforms); hazards.push(...chunk.hazards); items.push(...chunk.items);
    x = chunk.endX;
    y = chunk.endY - 150;
  }
  const last = platforms[platforms.length - 1];
  const finish = { x: clamp(last.x + last.w / 2, 160, WORLD.width - 160), y: last.y - 92 };
  return { platforms, hazards, items, chunks, finish, maxTier: 9 };
}

function createPlayer(id, name, index) {
  return { id, name: String(name || 'PASTA').slice(0, 12).toUpperCase(), color: COLORS[index % COLORS.length], x: 1110 + index * 46, y: WORLD.floorY - 62, vx: 0, vy: 0, w: 62, h: 30, onGround: false, score: 0, fallCount: 0, checkpointX: 1110, checkpointY: WORLD.floorY - 62, input: { move: 0, hook: false, aimX: 1100, aimY: 580 }, hook: null, roomId: null, finished: false };
}
function addPlayer(room, id, name) { const player = createPlayer(id, name, room.players.size); player.roomId = room.id; room.players.set(id, player); return player; }
function createRoom(hostId, hostName) { const id = code(); const room = { id, hostId, seed: randomSeed(), map: null, players: new Map(), started: false }; room.map = createMap(room.seed); rooms.set(id, room); addPlayer(room, hostId, hostName); return room; }
function respawn(player, room, checkpoint = true) { if (!checkpoint) { const start = room.map.platforms[0]; player.checkpointX = start.x + 90; player.checkpointY = start.y - player.h; } player.x = player.checkpointX; player.y = player.checkpointY; player.vx = 0; player.vy = 0; player.hook = null; player.finished = false; }
function removePlayer(id) { for (const room of rooms.values()) { if (!room.players.has(id)) continue; room.players.delete(id); if (room.hostId === id) room.hostId = room.players.keys().next().value || null; if (!room.players.size) rooms.delete(room.id); return room; } return null; }

function platformById(room, id) { return room.map.platforms.find((platform) => platform.id === id); }
function platformPoint(platform, offset = platform.w / 2) { return { x: platform.x + offset, y: platform.y }; }
function hookTarget(player, room) {
  const origin = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
  const aim = { x: player.input.aimX, y: player.input.aimY };
  const aimAngle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const candidates = [];
  for (const other of room.players.values()) {
    if (other.id === player.id || other.finished) continue;
    const point = { x: other.x + other.w / 2, y: other.y + other.h / 2 };
    const length = dist(origin.x, origin.y, point.x, point.y);
    const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
    const delta = Math.abs(Math.atan2(Math.sin(angle - aimAngle), Math.cos(angle - aimAngle)));
    if (length < 590 && delta < .58) candidates.push({ type: 'player', id: other.id, ...point, length, delta });
  }
  for (const platform of room.map.platforms) {
    if (platform.broken) continue;
    const point = platformPoint(platform, clamp(aim.x - platform.x, 12, platform.w - 12));
    const length = dist(origin.x, origin.y, point.x, point.y);
    const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
    const delta = Math.abs(Math.atan2(Math.sin(angle - aimAngle), Math.cos(angle - aimAngle)));
    const maxLength = 660 - platform.tier * 18;
    if (length < maxLength && delta < .46) candidates.push({ type: 'platform', id: platform.id, ...point, length, delta, tier: platform.tier });
  }
  candidates.sort((a, b) => a.delta * 330 + a.length - (b.delta * 330 + b.length));
  const target = candidates[0];
  return target ? { type: target.type, id: target.id, x: target.x, y: target.y, len: target.length, tier: target.tier || 0 } : null;
}
function updateHook(player, room) {
  if (!player.input.hook) { player.hook = null; return; }
  if (!player.hook) player.hook = hookTarget(player, room);
  if (!player.hook) return;
  let tx = player.hook.x;
  let ty = player.hook.y;
  let targetPlayer = null;
  if (player.hook.type === 'player') {
    targetPlayer = room.players.get(player.hook.id);
    if (!targetPlayer) { player.hook = null; return; }
    tx = targetPlayer.x + targetPlayer.w / 2;
    ty = targetPlayer.y + targetPlayer.h / 2;
    player.hook.x = tx; player.hook.y = ty;
  }
  const originX = player.x + player.w / 2;
  const originY = player.y + player.h / 2;
  const dx = tx - originX;
  const dy = ty - originY;
  const length = Math.hypot(dx, dy);
  player.hook.len = length;
  if (length > 740) { player.hook = null; return; }
  if (length > 44) {
    const tension = Math.min(1.35, .38 + (length - 44) * .012 + player.hook.tier * .025);
    const tangentX = -dy / length;
    const tangentY = dx / length;
    player.vx += dx / length * tension + tangentX * player.input.move * .22;
    player.vy += dy / length * tension + tangentY * player.input.move * .22;
    if (targetPlayer) { targetPlayer.vx -= dx / length * .09; targetPlayer.vy -= dy / length * .06; }
  }
}
function updatePlatforms(room, now) {
  for (const platform of room.map.platforms) {
    if (platform.amp) platform.x = platform.baseX + Math.sin(now * platform.speed + platform.phase) * platform.amp;
    if (platform.breakAt && now >= platform.breakAt) platform.broken = true;
  }
  for (const item of room.map.items) { const platform = platformById(room, item.platformId); if (platform) { item.x = platform.x + item.offset; item.y = platform.y - 35; } }
}
function triggerHazard(player, room) { player.fallCount += 1; player.score = Math.max(0, player.score - 1); respawn(player, room, true); }
function collide(player, room, oldBottom, now) {
  player.onGround = false;
  for (const platform of room.map.platforms) {
    if (platform.broken) continue;
    const overlapsX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
    const bottom = player.y + player.h;
    if (overlapsX && player.vy >= 0 && oldBottom <= platform.y + 8 && bottom >= platform.y) {
      player.y = platform.y - player.h; player.vy = 0; player.onGround = true;
      const hazard = room.map.hazards.find((candidate) => candidate.platformId === platform.id && player.x + player.w > platform.x + candidate.offset && player.x < platform.x + candidate.offset + candidate.w);
      if (hazard) { triggerHazard(player, room); return; }
      if (platform.gimmick === 'collapse' && !platform.breakAt) platform.breakAt = now + 680;
      if (platform.checkpoint) { player.checkpointX = player.x; player.checkpointY = platform.y - player.h; }
      return;
    }
  }
}
function updatePlayer(player, room, now) {
  if (!room.started || player.finished) return;
  if (player.input.move) player.vx += player.input.move * (.56 + Math.min(.22, Math.max(0, -player.y) / 4200));
  player.vx = clamp(player.vx, -7.6, 7.6);
  if (!player.input.move) player.vx *= .84;
  player.vy += .48;
  const oldBottom = player.y + player.h;
  updateHook(player, room);
  player.x += player.vx; player.y += player.vy;
  player.x = clamp(player.x, 0, WORLD.width - player.w);
  collide(player, room, oldBottom, now);
  if (player.y > WORLD.floorY + 540) triggerHazard(player, room);
  for (const item of room.map.items) { if (!item.collected && dist(player.x + player.w / 2, player.y + player.h / 2, item.x, item.y) < 44) { item.collected = true; player.score += item.value; io.to(room.id).emit('itemCollected', { itemId: item.id, playerId: player.id, score: player.score, value: item.value }); } }
  if (player.y < room.map.finish.y + 42 && dist(player.x + player.w / 2, player.y + player.h / 2, room.map.finish.x, room.map.finish.y) < 112) { player.finished = true; io.to(room.id).emit('finish', { playerId: player.id }); }
}
function publicState(room) { return { room: { id: room.id, hostId: room.hostId, started: room.started, seed: room.seed }, map: room.map, players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, onGround: p.onGround, score: p.score, fallCount: p.fallCount, finished: p.finished, hook: p.hook })) }; }
function broadcast(room) { io.to(room.id).emit('state', publicState(room)); }

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => { const room = createRoom(socket.id, name); socket.join(room.id); socket.data.roomId = room.id; socket.emit('roomJoined', publicState(room)); });
  socket.on('joinRoom', ({ code: roomCode, name }) => { const room = rooms.get(String(roomCode || '').trim().toUpperCase()); if (!room || room.started || room.players.size >= 6) { socket.emit('roomError', 'ROOM'); return; } const player = addPlayer(room, socket.id, name); respawn(player, room, false); socket.join(room.id); socket.data.roomId = room.id; socket.emit('roomJoined', publicState(room)); broadcast(room); });
  socket.on('startGame', () => { const room = rooms.get(socket.data.roomId); if (!room || room.hostId !== socket.id || room.started) return; room.started = true; for (const player of room.players.values()) respawn(player, room, false); broadcast(room); });
  socket.on('input', (data) => { const room = rooms.get(socket.data.roomId); const player = room?.players.get(socket.id); if (!player) return; player.input = { move: clamp(Number(data?.move) || 0, -1, 1), hook: Boolean(data?.hook), aimX: Number(data?.aimX) || player.x, aimY: Number(data?.aimY) || player.y }; });
  socket.on('leaveRoom', () => { const room = removePlayer(socket.id); socket.leave(room?.id || ''); socket.data.roomId = null; if (room) broadcast(room); });
  socket.on('disconnect', () => { const room = removePlayer(socket.id); if (room) broadcast(room); });
});
setInterval(() => { const now = Date.now(); for (const room of rooms.values()) { updatePlatforms(room, now); for (const player of room.players.values()) updatePlayer(player, room, now); broadcast(room); } }, TICK_MS);
server.listen(PORT, () => console.log(`Past.io server listening on ${PORT}`));
