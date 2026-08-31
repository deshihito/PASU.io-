/* Past.io server: cramped horizontal PvP arena, pasta players, noodle-to-anything interaction. */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const TICK_MS = 50;
const PHYSICS = { playerAccel: .78, playerMaxSpeed: 13, gravity: .5, objectGravity: .44, noodleTension: .025, maxHp: 100, hitCooldown: 550 };
const WORLD = { width: 1800, height: 980, floorY: 860 };
const COLORS = ['#f26a3d', '#18a8a8', '#f0bf4d', '#a56dff', '#70c1b3', '#ef476f'];
const rooms = new Map();

app.use(express.static(path.join(__dirname, '../docs')));
app.get('/manus-storage/pastio-pasta-player_198039e1.png', (_req, res) => res.sendFile('/home/ubuntu/webdev-static-assets/pastio-pasta-player.png'));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../docs/index.html')));
function code() { let value; do value = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(value)); return value; }
function rng(seed) { let value = seed >>> 0; return () => { value += 0x6d2b79f5; let t = value; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function rect(id, x, y, w, h, tag = 'wall') { return { id, x, y, w, h, tag, fixed: true }; }

function createArena(seed) {
  const next = rng(seed);
  const platforms = [
    rect('floor-left', 0, WORLD.floorY, 520, 120, 'floor'), rect('floor-mid', 610, 770, 320, 210, 'floor'), rect('floor-right', 1010, WORLD.floorY, 790, 120, 'floor'),
    rect('ceiling-left', 0, 0, 620, 38, 'ceiling'), rect('ceiling-right', 1120, 0, 680, 38, 'ceiling'),
    rect('wall-left', 0, 0, 42, WORLD.height, 'wall'), rect('wall-right', WORLD.width - 42, 0, 42, WORLD.height, 'wall'),
    rect('bridge-a', 120, 610, 230, 28, 'beam'), rect('bridge-b', 420, 450, 190, 28, 'beam'), rect('bridge-c', 770, 520, 260, 28, 'beam'),
    rect('bridge-d', 1110, 610, 190, 28, 'beam'), rect('bridge-e', 1370, 420, 260, 28, 'beam'),
    rect('chimney', 650, 230, 56, 540, 'wall'), rect('chimney-cap', 650, 230, 210, 28, 'beam'),
    rect('slot-left', 190, 300, 220, 24, 'beam'), rect('slot-right', 1180, 230, 190, 24, 'beam'),
    rect('underpass', 880, 690, 30, 170, 'wall'), rect('underpass-top', 760, 690, 150, 26, 'beam'),
  ];
  const anchors = [
    { id: 'a-ceil-1', x: 180, y: 90, type: 'anchor' }, { id: 'a-ceil-2', x: 500, y: 150, type: 'anchor' }, { id: 'a-chimney', x: 740, y: 180, type: 'anchor' },
    { id: 'a-mid', x: 970, y: 350, type: 'anchor' }, { id: 'a-right-1', x: 1260, y: 110, type: 'anchor' }, { id: 'a-right-2', x: 1550, y: 300, type: 'anchor' },
    { id: 'a-floor-1', x: 180, y: 790, type: 'anchor' }, { id: 'a-floor-2', x: 1090, y: 790, type: 'anchor' },
  ];
  const objects = [
    { id: 'crate-heavy', x: 470, y: 735, w: 86, h: 86, vx: 0, vy: 0, weight: 3.2, kind: 'crate', angle: 0 },
    { id: 'crate-light', x: 930, y: 570, w: 66, h: 66, vx: 0, vy: 0, weight: 1, kind: 'crate', angle: 0 },
    { id: 'drum', x: 1050, y: 720, w: 72, h: 72, vx: 0, vy: 0, weight: 1.8, kind: 'drum', angle: 0 },
    { id: 'cargo', x: 1390, y: 700, w: 140, h: 42, vx: 0, vy: 0, weight: 4, kind: 'cargo', angle: 0 },
  ];
  const items = [
    { id: 'scrap-1', x: 318, y: 560, type: 'scrap', value: 1, collected: false },
    { id: 'scrap-2', x: 840, y: 470, type: 'scrap', value: 1, collected: false },
    { id: 'relic-1', x: 1450, y: 370, type: 'relic', value: 3, collected: false },
  ];
  return { width: WORLD.width, height: WORLD.height, floorY: WORLD.floorY, platforms, anchors, objects, items, arenaLabel: `KNOT-${Math.floor(next() * 90 + 10)}` };
}

function createPlayer(id, name, index) { return { id, name: String(name || 'PASTA').slice(0, 12).toUpperCase(), color: COLORS[index % COLORS.length], x: 220 + index * 58, y: WORLD.floorY - 58, vx: 0, vy: 0, w: 92, h: 56, onGround: false, score: 0, hp: PHYSICS.maxHp, maxHp: PHYSICS.maxHp, fallCount: 0, hitFlashUntil: 0, invulnerableUntil: 0, checkpointX: 220 + index * 58, checkpointY: WORLD.floorY - 58, input: { move: 0, hook: false, aimX: 900, aimY: 400 }, hook: null, roomId: null }; }
function addPlayer(room, id, name) { const player = createPlayer(id, name, room.players.size); player.roomId = room.id; room.players.set(id, player); return player; }
function createRoom(hostId, hostName) { const id = code(); const room = { id, hostId, seed: Math.floor(Math.random() * 0xffffffff), map: null, players: new Map(), started: false }; room.map = createArena(room.seed); rooms.set(id, room); addPlayer(room, hostId, hostName); return room; }
function respawn(player, room) { player.x = player.checkpointX; player.y = player.checkpointY; player.vx = 0; player.vy = 0; player.hook = null; }
function removePlayer(id) { for (const room of rooms.values()) { if (!room.players.has(id)) continue; room.players.delete(id); if (room.hostId === id) room.hostId = room.players.keys().next().value || null; if (!room.players.size) rooms.delete(room.id); return room; } return null; }
function objectById(room, id) { return room.map.objects.find((object) => object.id === id); }
function platformById(room, id) { return room.map.platforms.find((platform) => platform.id === id); }
function objectPoint(object) { return { x: object.x + object.w / 2, y: object.y + object.h / 2 }; }
function targetInAim(origin, target, aimAngle, spread, maxLength) { const length = dist(origin.x, origin.y, target.x, target.y); const angle = Math.atan2(target.y - origin.y, target.x - origin.x); const delta = Math.abs(Math.atan2(Math.sin(angle - aimAngle), Math.cos(angle - aimAngle))); return length < maxLength && delta < spread ? { ...target, length, delta } : null; }
function hookTarget(player, room) {
  const origin = { x: player.x + player.w / 2, y: player.y + player.h / 2 }; const aimAngle = Math.atan2(player.input.aimY - origin.y, player.input.aimX - origin.x); const candidates = [];
  for (const anchor of room.map.anchors) { const found = targetInAim(origin, anchor, aimAngle, .3, 680); if (found) candidates.push({ type: 'terrain', id: anchor.id, x: found.x, y: found.y, length: found.length, delta: found.delta }); }
  for (const surface of room.map.platforms) {
    const points = [{ x: surface.x + surface.w / 2, y: surface.y }, { x: surface.x + surface.w / 2, y: surface.y + surface.h }, { x: surface.x, y: surface.y + surface.h / 2 }, { x: surface.x + surface.w, y: surface.y + surface.h / 2 }];
    points.forEach((point, index) => { const found = targetInAim(origin, point, aimAngle, .24, 680); if (found) candidates.push({ type: 'terrain', id: `${surface.id}-edge-${index}`, x: found.x, y: found.y, length: found.length, delta: found.delta }); });
  }
  for (const object of room.map.objects) { const found = targetInAim(origin, objectPoint(object), aimAngle, .65, 720); if (found) candidates.push({ type: 'object', id: object.id, x: found.x, y: found.y, length: found.length, delta: found.delta, weight: object.weight }); }
  for (const other of room.players.values()) { if (other.id === player.id) continue; const found = targetInAim(origin, { x: other.x + other.w / 2, y: other.y + other.h / 2 }, aimAngle, .42, 560); if (found) candidates.push({ type: 'player', id: other.id, x: found.x, y: found.y, length: found.length, delta: found.delta }); }
  candidates.sort((a, b) => a.delta * 420 + a.length - (b.delta * 420 + b.length)); const target = candidates[0]; return target ? { type: target.type, id: target.id, x: target.x, y: target.y, len: target.length, weight: target.weight || 1 } : null;
}
function updateHook(player, room) {
  if (!player.input.hook) { player.hook = null; return; }
  if (!player.hook) player.hook = hookTarget(player, room);
  if (!player.hook) return;
  let tx = player.hook.x; let ty = player.hook.y; let targetPlayer = null; let targetObject = null;
  if (player.hook.type === 'player') { targetPlayer = room.players.get(player.hook.id); if (!targetPlayer) { player.hook = null; return; } tx = targetPlayer.x + targetPlayer.w / 2; ty = targetPlayer.y + targetPlayer.h / 2; }
  if (player.hook.type === 'object') { targetObject = objectById(room, player.hook.id); if (!targetObject) { player.hook = null; return; } tx = targetObject.x + targetObject.w / 2; ty = targetObject.y + targetObject.h / 2; }
  player.hook.x = tx; player.hook.y = ty;
  const ox = player.x + player.w / 2; const oy = player.y + player.h / 2; const dx = tx - ox; const dy = ty - oy; const length = Math.hypot(dx, dy); player.hook.len = length;
  if (length > 720) { player.hook = null; return; }
  if (length < 42) return;
  const nx = dx / length; const ny = dy / length; const tangentX = -ny; const tangentY = nx;
  const mouseLength = clamp(dist(ox, oy, player.input.aimX, player.input.aimY), 42, 720);
  const stretch = Math.max(0, length - mouseLength);
  const mouseDX = player.input.aimX - ox; const mouseDY = player.input.aimY - oy; const mouseLengthSafe = Math.max(1, Math.hypot(mouseDX, mouseDY));
  const mouseTorque = clamp((dx * mouseDY - dy * mouseDX) / (length * mouseLengthSafe), -1, 1);
  const tension = Math.min(2.6, stretch * PHYSICS.noodleTension * 1.7);
  const tangentForce = mouseTorque * .42;
  if (tension <= 0 && Math.abs(tangentForce) < .01) return;
  if (player.hook.type === 'terrain') { player.vx += nx * tension + tangentX * tangentForce; player.vy += ny * tension + tangentY * tangentForce; }
  if (targetObject) { targetObject.vx -= nx * tension / targetObject.weight; targetObject.vy -= ny * tension / targetObject.weight; targetObject.vx -= tangentX * tangentForce / targetObject.weight; targetObject.vy -= tangentY * tangentForce / targetObject.weight; }
  if (targetPlayer) { player.vx += nx * tension * .55 + tangentX * tangentForce; player.vy += ny * tension * .55 + tangentY * tangentForce; targetPlayer.vx -= nx * tension * .16; targetPlayer.vy -= ny * tension * .1; }
}
function collides(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function settleBody(body, room, oldBottom) {
  body.onGround = false;
  for (const surface of [...room.map.platforms, ...room.map.objects]) { if (surface === body || surface.broken) continue; const overlapsX = body.x + body.w > surface.x && body.x < surface.x + surface.w; const bottom = body.y + body.h; if (overlapsX && body.vy >= 0 && oldBottom <= surface.y + 10 && bottom >= surface.y) { body.y = surface.y - body.h; body.vy = 0; body.onGround = true; if (surface.checkpoint) { body.checkpointX = body.x; body.checkpointY = body.y; } return; } }
}
function updateObjects(room, now) { for (const object of room.map.objects) { object.vy += PHYSICS.objectGravity; object.vx *= .94; object.vy = clamp(object.vy, -18, 18); const oldBottom = object.y + object.h; object.x += object.vx; object.y += object.vy; object.x = clamp(object.x, 42, WORLD.width - object.w - 42); settleBody(object, room, oldBottom); const speed = Math.hypot(object.vx, object.vy); if (speed > 3.4) { for (const player of room.players.values()) { if (now < player.invulnerableUntil || !collides(player, object)) continue; const damage = clamp(Math.round(speed * object.weight * 1.25), 5, 34); player.hp = Math.max(0, player.hp - damage); player.hitFlashUntil = now + 180; player.invulnerableUntil = now + PHYSICS.hitCooldown; player.vx += Math.sign(player.x - object.x || 1) * Math.min(8, speed * .5); player.vy -= Math.min(8, speed * .28); io.to(room.id).emit('playerHit', { playerId: player.id, damage, hp: player.hp, objectId: object.id }); } } if (object.y > WORLD.height + 100) { object.x = 760; object.y = 300; object.vx = 0; object.vy = 0; } } }
function updatePlayer(player, room) { if (!room.started) return; player.vx *= .985; player.vx = clamp(player.vx, -PHYSICS.playerMaxSpeed, PHYSICS.playerMaxSpeed); player.vy += PHYSICS.gravity; const oldBottom = player.y + player.h; updateHook(player, room); player.x += player.vx; player.y += player.vy; player.x = clamp(player.x, 42, WORLD.width - player.w - 42); settleBody(player, room, oldBottom); if (player.y > WORLD.height + 140) { player.fallCount += 1; player.score = Math.max(0, player.score - 1); respawn(player, room); } for (const item of room.map.items) { if (!item.collected && dist(player.x + player.w / 2, player.y + player.h / 2, item.x, item.y) < 45) { item.collected = true; player.score += item.value; io.to(room.id).emit('itemCollected', { itemId: item.id, playerId: player.id, score: player.score, value: item.value }); } } }
function publicState(room) { return { room: { id: room.id, hostId: room.hostId, started: room.started, seed: room.seed }, map: room.map, players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, onGround: p.onGround, score: p.score, hp: p.hp, maxHp: p.maxHp, hitFlashUntil: p.hitFlashUntil, fallCount: p.fallCount, hook: p.hook })) }; }
function broadcast(room) { io.to(room.id).emit('state', publicState(room)); }

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => { const room = createRoom(socket.id, name); socket.join(room.id); socket.data.roomId = room.id; socket.emit('roomJoined', publicState(room)); });
  socket.on('joinRoom', ({ code: roomCode, name }) => { const room = rooms.get(String(roomCode || '').trim().toUpperCase()); if (!room || room.started || room.players.size >= 6) { socket.emit('roomError', 'ROOM'); return; } addPlayer(room, socket.id, name); socket.join(room.id); socket.data.roomId = room.id; socket.emit('roomJoined', publicState(room)); broadcast(room); });
  socket.on('startGame', () => { const room = rooms.get(socket.data.roomId); if (!room || room.hostId !== socket.id || room.started) return; room.started = true; for (const player of room.players.values()) respawn(player, room); broadcast(room); });
  socket.on('input', (data) => { const room = rooms.get(socket.data.roomId); const player = room?.players.get(socket.id); if (!player) return; player.input = { hook: Boolean(data?.hook), aimX: Number(data?.aimX) || player.x, aimY: Number(data?.aimY) || player.y }; });
  socket.on('leaveRoom', () => { const room = removePlayer(socket.id); socket.leave(room?.id || ''); socket.data.roomId = null; if (room) broadcast(room); });
  socket.on('disconnect', () => { const room = removePlayer(socket.id); if (room) broadcast(room); });
});
setInterval(() => { const now = Date.now(); for (const room of rooms.values()) { updateObjects(room, now); for (const player of room.players.values()) updatePlayer(player, room); broadcast(room); } }, TICK_MS);
server.listen(PORT, () => console.log(`Past.io arena server listening on ${PORT}`));
