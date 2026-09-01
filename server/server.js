/* Design philosophy: vector pasta western — flat shapes, crisp outlines, white/yellow/red contrast, noodle-only action. */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const TICK_MS = 50;
const WORLD = { width: 18000, height: 9800, floorY: 8600 };
const PHYSICS = { playerMaxSpeed: 13, gravity: .5, objectGravity: .44, noodleTension: .025, hookMaxDistance: 760, hookMaxForce: 2.6, maxHp: 100, hitCooldown: 550 };
const COLORS = ['#F6C445', '#D94A32', '#2F4858', '#E08E0B', '#6B7280', '#9E2A2B'];
const MODES = { tag: { label: 'TAG', goal: 'TOUCH' }, hide: { label: 'HIDE', goal: 'STAY STILL' }, free: { label: 'FREE', goal: 'ROAM' }, hill: { label: 'HILL', goal: 'CLIMB' }, pvp: { label: 'PVP', goal: 'BONK' } };
const rooms = new Map();
app.use(express.static(path.join(__dirname, '../docs')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../docs/index.html')));
function rng(seed) { let v = seed >>> 0; return () => { v += 0x6d2b79f5; let t = v; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function rect(id, x, y, w, h, tag = 'wall') { return { id, x, y, w, h, tag, fixed: true }; }
function makeArena(seed, mode) {
  const next = rng(seed);
  const platforms = [rect('floor', 0, WORLD.floorY, WORLD.width, 120, 'floor'), rect('ceiling', 0, 0, WORLD.width, 40, 'ceiling'), rect('wall-left', 0, 0, 42, WORLD.height, 'wall'), rect('wall-right', WORLD.width - 42, 0, 42, WORLD.height, 'wall')];
  platforms.push(rect('start-ledge-a', 140, 7900, 360, 28, 'beam'), rect('start-ledge-b', 620, 7150, 320, 28, 'beam'), rect('start-ledge-c', 1040, 6400, 300, 28, 'beam'));
  for (let i = 0; i < 94; i += 1) { const x = 160 + Math.floor(next() * (WORLD.width - 520)); const y = 500 + Math.floor(next() * 7600); const w = 180 + Math.floor(next() * 440); const h = 26 + Math.floor(next() * 20); platforms.push(rect(`ledge-${i}`, x, y, w, h, i % 8 === 0 ? 'ramp' : 'beam')); }
  const objects = [
    { id: 'hammer-01', x: 1200, y: 8200, w: 118, h: 42, vx: 0, vy: 0, weight: 4.8, kind: 'hammer', effect: 'heavy-hit', angle: 0 },
    { id: 'gun-01', x: 2900, y: 8200, w: 90, h: 32, vx: 0, vy: 0, weight: .8, kind: 'gun', effect: 'recoil-shot', angle: 0 },
    { id: 'stone-01', x: 4700, y: 8200, w: 44, h: 44, vx: 0, vy: 0, weight: 1.2, kind: 'stone', effect: 'bonk', angle: 0 },
    { id: 'hammer-02', x: 8200, y: 8200, w: 118, h: 42, vx: 0, vy: 0, weight: 4.8, kind: 'hammer', effect: 'heavy-hit', angle: 0 },
    { id: 'gun-02', x: 11200, y: 8200, w: 90, h: 32, vx: 0, vy: 0, weight: .8, kind: 'gun', effect: 'recoil-shot', angle: 0 },
    { id: 'stone-02', x: 14500, y: 8200, w: 44, h: 44, vx: 0, vy: 0, weight: 1.2, kind: 'stone', effect: 'bonk', angle: 0 },
  ];
  const landmarks = Array.from({ length: 18 }, (_, i) => ({ id: `landmark-${i}`, x: 650 + i * 980, y: 300 + Math.floor(next() * 7200), kind: ['fork', 'cheese', 'sauce', 'crate'][i % 4] }));
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `crumb-${i}`, x: 280 + Math.floor(next() * (WORLD.width - 560)), y: 900 + Math.floor(next() * 7000), type: i % 5 === 0 ? 'relic' : 'crumb', value: i % 5 === 0 ? 3 : 1, collected: false }));
  return { width: WORLD.width, height: WORLD.height, floorY: WORLD.floorY, platforms, objects, landmarks, items, arenaLabel: `PLATE-${String(Math.floor(next() * 90) + 10).padStart(2, '0')}`, mode };
}
function createPlayer(id, name, index) { return { id, name: String(name || 'PASTA').replace(/[^a-z0-9_-]/gi, '').slice(0, 12).toUpperCase() || 'PASTA', color: COLORS[index % COLORS.length], x: 220 + index * 95, y: WORLD.floorY - 66, vx: 0, vy: 0, w: 92, h: 66, onGround: false, score: 0, hp: PHYSICS.maxHp, fallCount: 0, taggedAt: 0, tagCount: 0, highTime: 0, hidden: false, input: { hook: false, aimX: 900, aimY: 400 }, hook: null, roomId: null }; }
function code() { let value; do value = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(value)); return value; }
function createRoom(hostId, hostName, mode = 'free') { const id = code(); const seed = Math.floor(Math.random() * 0xffffffff); const room = { id, hostId, seed, mode: MODES[mode] ? mode : 'free', map: null, players: new Map(), started: false }; room.map = makeArena(seed, room.mode); rooms.set(id, room); addPlayer(room, hostId, hostName); return room; }
function addPlayer(room, id, name) { const p = createPlayer(id, name, room.players.size); p.roomId = room.id; room.players.set(id, p); return p; }
function respawn(p, room) { p.x = 220; p.y = room.map.floorY - p.h; p.vx = 0; p.vy = 0; p.hp = PHYSICS.maxHp; p.hook = null; }
function removePlayer(id) { for (const room of rooms.values()) if (room.players.has(id)) { room.players.delete(id); if (room.hostId === id) room.hostId = room.players.keys().next().value || null; if (!room.players.size) rooms.delete(room.id); return room; } return null; }
function objectById(room, id) { return room.map.objects.find((o) => o.id === id); }
function lineRectHit(start, end, rectangle) { const dx = end.x - start.x; const dy = end.y - start.y; let near = 0; let far = 1; for (const [origin, delta, min, max] of [[start.x, dx, rectangle.x, rectangle.x + rectangle.w], [start.y, dy, rectangle.y, rectangle.y + rectangle.h]]) { if (Math.abs(delta) < .0001) { if (origin < min || origin > max) return null; continue; } let t1 = (min - origin) / delta; let t2 = (max - origin) / delta; if (t1 > t2) [t1, t2] = [t2, t1]; near = Math.max(near, t1); far = Math.min(far, t2); if (near > far) return null; } const t = near >= 0 ? near : 0; if (t > 1) return null; return { x: start.x + dx * t, y: start.y + dy * t, t, length: Math.hypot(dx, dy) * t }; }
function hookTarget(player, room) {
  const origin = { x: player.x + player.w / 2, y: player.y + player.h / 2 }; const aimDX = player.input.aimX - origin.x; const aimDY = player.input.aimY - origin.y; const aimLength = Math.hypot(aimDX, aimDY); if (aimLength < 2) return null; const reach = Math.min(aimLength, PHYSICS.hookMaxDistance); const end = { x: origin.x + aimDX / aimLength * reach, y: origin.y + aimDY / aimLength * reach }; const candidates = [];
  for (const surface of room.map.platforms) { const hit = lineRectHit(origin, end, surface); if (hit) candidates.push({ type: 'terrain', id: surface.id, x: hit.x, y: hit.y, len: hit.length }); }
  for (const object of room.map.objects) { const hit = lineRectHit(origin, end, object); if (hit) candidates.push({ type: 'object', id: object.id, x: hit.x, y: hit.y, len: hit.length }); }
  for (const other of room.players.values()) { if (other.id === player.id) continue; const hit = lineRectHit(origin, end, other); if (hit) candidates.push({ type: 'player', id: other.id, x: hit.x, y: hit.y, len: hit.length }); }
  candidates.sort((a, b) => a.len - b.len); const target = candidates[0]; return target ? { type: target.type, id: target.id, x: target.x, y: target.y, len: target.len } : null;
}
function updateHook(player, room) {
  if (!player.input.hook) { player.hook = null; return; }
  if (!player.hook) player.hook = hookTarget(player, room);
  if (!player.hook) return;
  let tx = player.hook.x; let ty = player.hook.y; let targetPlayer = null; let targetObject = null;
  if (player.hook.type === 'player') { targetPlayer = room.players.get(player.hook.id); if (!targetPlayer) { player.hook = null; return; } tx = targetPlayer.x + targetPlayer.w / 2; ty = targetPlayer.y + targetPlayer.h / 2; }
  if (player.hook.type === 'object') { targetObject = objectById(room, player.hook.id); if (!targetObject) { player.hook = null; return; } tx = targetObject.x + targetObject.w / 2; ty = targetObject.y + targetObject.h / 2; }
  player.hook.x = tx; player.hook.y = ty; const ox = player.x + player.w / 2; const oy = player.y + player.h / 2; const dx = tx - ox; const dy = ty - oy; const length = Math.hypot(dx, dy); player.hook.len = length; if (length > PHYSICS.hookMaxDistance) { player.hook = null; return; } if (length < 42) return;
  const nx = dx / length; const ny = dy / length; const tangentX = -ny; const tangentY = nx; const mouseLength = clamp(dist(ox, oy, player.input.aimX, player.input.aimY), 42, PHYSICS.hookMaxDistance); const stretch = Math.max(0, length - mouseLength); const aimDX = player.input.aimX - ox; const aimDY = player.input.aimY - oy; const aimLength = Math.max(1, Math.hypot(aimDX, aimDY)); const mouseTorque = clamp((dx * aimDY - dy * aimDX) / (length * aimLength), -1, 1); const tension = Math.min(PHYSICS.hookMaxForce, stretch * PHYSICS.noodleTension * 1.7); const tangentForce = mouseTorque * .42; let forceX = nx * tension + tangentX * tangentForce; let forceY = ny * tension + tangentY * tangentForce; const forceLength = Math.hypot(forceX, forceY); if (forceLength > PHYSICS.hookMaxForce) { forceX *= PHYSICS.hookMaxForce / forceLength; forceY *= PHYSICS.hookMaxForce / forceLength; } if (Math.abs(forceX) < .01 && Math.abs(forceY) < .01) return;
  if (player.hook.type === 'terrain') { player.vx += forceX; player.vy += forceY; }
  if (targetObject) { targetObject.vx -= forceX / targetObject.weight; targetObject.vy -= forceY / targetObject.weight; }
  if (targetPlayer) { player.vx += forceX * .55; player.vy += forceY * .55; targetPlayer.vx -= forceX * .16; targetPlayer.vy -= forceY * .1; }
}
function collides(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function settleBody(body, room, oldBottom) { body.onGround = false; for (const surface of [...room.map.platforms, ...room.map.objects]) { if (surface === body) continue; const overlapsX = body.x + body.w > surface.x && body.x < surface.x + surface.w; const bottom = body.y + body.h; if (overlapsX && body.vy >= 0 && oldBottom <= surface.y + 10 && bottom >= surface.y) { body.y = surface.y - body.h; body.vy = 0; body.onGround = true; return; } } }
function updateObjects(room, now) { for (const object of room.map.objects) { object.vy += PHYSICS.objectGravity; object.vx *= .94; object.vy = clamp(object.vy, -18, 18); const oldBottom = object.y + object.h; object.x += object.vx; object.y += object.vy; object.x = clamp(object.x, 42, WORLD.width - object.w - 42); settleBody(object, room, oldBottom); const speed = Math.hypot(object.vx, object.vy); if (speed > 3.4) for (const player of room.players.values()) { if (now < (player.invulnerableUntil || 0) || !collides(player, object)) continue; const damage = clamp(Math.round(speed * object.weight * 1.25), 5, 34); player.hp = Math.max(0, player.hp - damage); player.hitFlashUntil = now + 180; player.invulnerableUntil = now + PHYSICS.hitCooldown; player.vx += Math.sign(player.x - object.x || 1) * Math.min(8, speed * .5); player.vy -= Math.min(8, speed * .28); io.to(room.id).emit('playerHit', { playerId: player.id, damage, hp: player.hp, objectId: object.id, effect: object.effect }); } if (object.y > WORLD.height + 100) { object.x = 760; object.y = 300; object.vx = 0; object.vy = 0; } } }
function updatePlayer(player, room, now) { if (!room.started) return; player.vx *= .985; player.vx = clamp(player.vx, -PHYSICS.playerMaxSpeed, PHYSICS.playerMaxSpeed); player.vy += PHYSICS.gravity; const oldBottom = player.y + player.h; updateHook(player, room); player.x += player.vx; player.y += player.vy; player.x = clamp(player.x, 42, WORLD.width - player.w - 42); settleBody(player, room, oldBottom); if (player.y > WORLD.height + 140) { player.fallCount += 1; player.score = Math.max(0, player.score - 1); respawn(player, room); } if (room.mode === 'hill' && player.y < 1200) { player.highTime += 1; player.score = Math.max(player.score, Math.floor(player.highTime / 20)); } player.hidden = room.mode === 'hide' && !player.input.hook && Math.abs(player.vx) < 1.8; if (room.mode === 'tag') for (const other of room.players.values()) if (other.id !== player.id && now >= (player.taggedAt || 0) && dist(player.x + player.w / 2, player.y + player.h / 2, other.x + other.w / 2, other.y + other.h / 2) < 92) { player.taggedAt = now + 1800; player.tagCount += 1; player.score += 1; io.to(room.id).emit('tagged', { playerId: player.id, by: other.id }); } for (const item of room.map.items) if (!item.collected && dist(player.x + player.w / 2, player.y + player.h / 2, item.x, item.y) < 45) { item.collected = true; player.score += item.value; io.to(room.id).emit('itemCollected', { itemId: item.id, playerId: player.id, score: player.score, value: item.value }); } }
function publicState(room) { return { room: { id: room.id, hostId: room.hostId, started: room.started, seed: room.seed, mode: room.mode, modeLabel: MODES[room.mode].label, goal: MODES[room.mode].goal }, map: room.map, players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, onGround: p.onGround, score: p.score, hp: p.hp, fallCount: p.fallCount, hitFlashUntil: p.hitFlashUntil, hidden: p.hidden, hook: p.hook })) }; }
function broadcast(room) { io.to(room.id).emit('state', publicState(room)); }
io.on('connection', (socket) => {
  socket.on('createRoom', ({ name, mode }) => { const room = createRoom(socket.id, name, mode); socket.join(room.id); socket.data.roomId = room.id; socket.emit('roomJoined', publicState(room)); });
  socket.on('joinRoom', ({ code: roomCode, name }) => { const room = rooms.get(String(roomCode || '').trim().toUpperCase()); if (!room || room.started || room.players.size >= 6) return socket.emit('roomError', 'ROOM'); addPlayer(room, socket.id, name); socket.join(room.id); socket.data.roomId = room.id; socket.emit('roomJoined', publicState(room)); broadcast(room); });
  socket.on('startGame', () => { const room = rooms.get(socket.data.roomId); if (!room || room.hostId !== socket.id || room.started) return; room.started = true; room.players.forEach((p) => respawn(p, room)); broadcast(room); });
  socket.on('input', (data) => { const room = rooms.get(socket.data.roomId); const player = room?.players.get(socket.id); if (!player) return; player.input = { hook: Boolean(data?.hook), aimX: Number(data?.aimX) || player.x, aimY: Number(data?.aimY) || player.y }; });
  socket.on('leaveRoom', () => { const room = removePlayer(socket.id); socket.leave(room?.id || ''); socket.data.roomId = null; if (room) broadcast(room); });
  socket.on('disconnect', () => { const room = removePlayer(socket.id); if (room) broadcast(room); });
});
setInterval(() => { const now = Date.now(); for (const room of rooms.values()) { updateObjects(room, now); for (const player of room.players.values()) updatePlayer(player, room, now); broadcast(room); } }, TICK_MS);
server.listen(PORT, () => console.log(`PASU.io vector arena listening on ${PORT}`));
