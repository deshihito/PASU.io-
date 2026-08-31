/* Design philosophy: post-industrial sports graphic — pasta body, noodle tether, hard A/D-only control, escalating vertical pressure. */
const socket = io();
const $ = (id) => document.getElementById(id);

const state = { screen: 'home', meId: null, room: null, map: null, players: [], cameraX: 0, cameraY: 0, zoom: 1, bannerTimer: 0 };
const input = { left: false, right: false, hookHeld: false, aimX: 1100, aimY: 580 };
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');

function setScreen(name) {
  state.screen = name;
  $('homeScreen').classList.toggle('is-hidden', name !== 'home');
  $('roomScreen').classList.toggle('is-hidden', name !== 'room');
  $('gameScreen').classList.toggle('is-hidden', name !== 'game');
  if (name === 'game') resizeCanvas();
}
function setStatus(id, text) { $(id).textContent = text || ''; }
function playerName() { return ($('nameInput').value.trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'PASTA').slice(0, 12); }
function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function showBanner(text, duration = 1250) { $('gameBanner').textContent = text; $('gameBanner').classList.remove('is-hidden'); state.bannerTimer = performance.now() + duration; }

function renderRoom() {
  if (!state.room) return;
  $('roomCodeLabel').textContent = state.room.id;
  $('seedLabel').textContent = String(state.room.seed).padStart(10, '0');
  $('playerCount').textContent = `${state.players.length}/6`;
  $('startButton').hidden = state.room.hostId !== state.meId;
  $('startButton').textContent = state.room.started ? 'LIVE' : 'START';
  $('startButton').disabled = Boolean(state.room.started);
  $('playerList').innerHTML = state.players.map((player, index) => {
    const host = player.id === state.room.hostId;
    const me = player.id === state.meId;
    const label = escapeHTML(player.name || `PASTA ${index + 1}`);
    return `<div class="player-row${host ? ' is-host' : ''}" style="--player-color:${player.color}"><span class="player-dot"></span><span>${label}${me ? ' <small>YOU</small>' : ''}</span><small>${String(player.score || 0).padStart(2, '0')}</small></div>`;
  }).join('');
}

function applyWorld(data) {
  state.room = data.room;
  state.map = data.map;
  state.players = data.players || [];
  const me = state.players.find((player) => player.id === state.meId);
  if (me) {
    $('hudScore').textContent = String(me.score || 0).padStart(2, '0');
    $('hookMeter').style.width = me.hook ? `${Math.min(100, (me.hook.len || 0) / 7)}%` : '0%';
    const platform = state.map.platforms.reduce((best, candidate) => candidate.y > me.y && candidate.y < best.y ? candidate : best, state.map.platforms[0]);
    const level = Math.max(0, Math.round((state.map.platforms.length - 1 - (platform?.tier || 0)) / 4));
    $('hudLevel').textContent = `LEVEL ${String(level).padStart(2, '0')}`;
  }
  renderCrew();
  if (state.room?.started && state.screen !== 'game') setScreen('game');
  if (!state.room?.started && state.screen === 'game') setScreen('room');
}
function renderCrew() { $('hudCrew').innerHTML = state.players.map((player) => `<i class="crew-dot" style="--dot:${player.color}" title="${escapeHTML(player.name)}"></i>`).join(''); }

$('createButton').addEventListener('click', () => { setStatus('homeStatus', 'CONNECTING'); socket.emit('createRoom', { name: playerName() }); });
$('joinButton').addEventListener('click', () => {
  const code = $('roomInput').value.trim().toUpperCase();
  if (code.length !== 4) { setStatus('homeStatus', 'CODE'); return; }
  setStatus('homeStatus', 'CONNECTING'); socket.emit('joinRoom', { code, name: playerName() });
});
$('roomInput').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('startButton').addEventListener('click', () => socket.emit('startGame'));
$('leaveButton').addEventListener('click', leaveRoom);
$('gameLeaveButton').addEventListener('click', leaveRoom);
function leaveRoom() { socket.emit('leaveRoom'); input.hookHeld = false; state.room = null; state.map = null; state.players = []; setScreen('home'); setStatus('homeStatus', ''); }

socket.on('connect', () => setStatus('homeStatus', 'ONLINE'));
socket.on('disconnect', () => { input.hookHeld = false; setStatus(state.screen === 'home' ? 'homeStatus' : 'roomStatus', 'OFFLINE'); });
socket.on('roomJoined', (data) => { state.meId = socket.id; applyWorld(data); $('hudRoom').textContent = data.room.id; $('hudSeed').textContent = `SEED ${data.room.seed}`; setStatus('homeStatus', ''); setStatus('roomStatus', ''); setScreen(data.room.started ? 'game' : 'room'); });
socket.on('state', (data) => { applyWorld(data); if (state.screen === 'room') renderRoom(); });
socket.on('roomError', () => setStatus(state.screen === 'home' ? 'homeStatus' : 'roomStatus', 'ROOM'));
socket.on('itemCollected', ({ playerId, score }) => { if (playerId === state.meId) { $('hudScore').textContent = String(score || 0).padStart(2, '0'); showBanner('+ SCRAP', 850); } });
socket.on('finish', ({ playerId }) => { if (playerId === state.meId) showBanner('FINISH', 1700); });

function resizeCanvas() { const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.floor(window.innerWidth * dpr); canvas.height = Math.floor(window.innerHeight * dpr); canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();
function updateAim(event) { const rect = canvas.getBoundingClientRect(); input.aimX = state.cameraX + (event.clientX - rect.left) / state.zoom; input.aimY = state.cameraY + (event.clientY - rect.top) / state.zoom; }
canvas.addEventListener('pointermove', updateAim);
canvas.addEventListener('pointerdown', (event) => { if (event.button !== 0 || state.screen !== 'game') return; event.preventDefault(); canvas.setPointerCapture?.(event.pointerId); updateAim(event); input.hookHeld = true; });
window.addEventListener('pointerup', () => { input.hookHeld = false; });
window.addEventListener('pointercancel', () => { input.hookHeld = false; });
window.addEventListener('blur', () => { input.hookHeld = false; input.left = false; input.right = false; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('keydown', (event) => { if (event.code === 'KeyA') { input.left = true; event.preventDefault(); } if (event.code === 'KeyD') { input.right = true; event.preventDefault(); } if (event.code === 'Escape' && state.screen === 'game') leaveRoom(); });
window.addEventListener('keyup', (event) => { if (event.code === 'KeyA') input.left = false; if (event.code === 'KeyD') input.right = false; });
setInterval(() => socket.emit('input', { move: Number(input.right) - Number(input.left), hook: input.hookHeld, aimX: input.aimX, aimY: input.aimY }), 50);

function worldToScreen(x, y) { return { x: (x - state.cameraX) * state.zoom, y: (y - state.cameraY) * state.zoom }; }
function drawBackground(viewWidth, viewHeight) {
  ctx.fillStyle = '#17262a'; ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#20353a'; ctx.fillRect(0, viewHeight * .64, viewWidth, viewHeight * .36);
  ctx.strokeStyle = 'rgba(217,216,207,.08)'; ctx.lineWidth = 1;
  const grid = 44 * state.zoom; const xOffset = ((-state.cameraX * state.zoom) % grid + grid) % grid; const yOffset = ((-state.cameraY * state.zoom) % grid + grid) % grid;
  for (let x = xOffset; x < viewWidth; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewHeight); ctx.stroke(); }
  for (let y = yOffset; y < viewHeight; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewWidth, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(240,191,77,.1)';
  for (let index = 0; index < 10; index += 1) { const x = ((index * 240 - state.cameraX * .16) % (viewWidth + 240)) - 90; const y = viewHeight * .18 + (index % 4) * 27; ctx.fillRect(x, y, 118, 5); ctx.fillRect(x + 18, y - 24, 5, 29); }
}
function drawPlatform(platform) {
  const pos = worldToScreen(platform.x, platform.y); const width = platform.w * state.zoom; const height = platform.h * state.zoom;
  if (platform.broken || pos.x > innerWidth || pos.x + width < 0 || pos.y > innerHeight || pos.y + height < 0) return;
  ctx.fillStyle = platform.gimmick === 'needle' ? '#754d4c' : platform.gimmick === 'collapse' ? '#6e6658' : '#536464'; ctx.fillRect(pos.x, pos.y, width, height);
  ctx.fillStyle = platform.gimmick === 'needle' ? '#ef476f' : '#f0bf4d'; ctx.fillRect(pos.x, pos.y, width, Math.max(4, 6 * state.zoom));
  ctx.fillStyle = 'rgba(21,33,39,.34)'; for (let x = pos.x + 16; x < pos.x + width; x += 34) ctx.fillRect(x, pos.y + height * .55, 11, 3);
  if (platform.gimmick === 'needle') { ctx.fillStyle = '#ef476f'; for (let x = pos.x + 10; x < pos.x + width - 10; x += 22) { ctx.beginPath(); ctx.moveTo(x, pos.y); ctx.lineTo(x + 8, pos.y - 13); ctx.lineTo(x + 16, pos.y); ctx.fill(); } }
  if (platform.gimmick === 'collapse') { ctx.strokeStyle = '#f26a3d'; ctx.setLineDash([5, 5]); ctx.strokeRect(pos.x + 1, pos.y + 1, width - 2, height - 2); ctx.setLineDash([]); }
  ctx.strokeStyle = 'rgba(21,33,39,.7)'; ctx.strokeRect(pos.x + .5, pos.y + .5, width - 1, height - 1);
}
function drawItem(item) { if (item.collected) return; const pos = worldToScreen(item.x, item.y); if (pos.x < -40 || pos.x > innerWidth + 40 || pos.y < -40 || pos.y > innerHeight + 40) return; const size = item.type === 'relic' ? 13 : 10; ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = item.type === 'relic' ? '#f0bf4d' : '#f26a3d'; ctx.fillRect(-size, -size, size * 2, size * 2); ctx.fillStyle = '#f4f2e9'; ctx.fillRect(-size + 4, -size + 4, 4, 4); ctx.restore(); }
function center(player) { return { x: player.x + player.w / 2, y: player.y + player.h / 2 }; }
function drawNoodle(player) {
  if (!player.hook) return;
  const origin = center(player); const targetPlayer = state.players.find((candidate) => candidate.id === player.hook.id); const target = targetPlayer ? center(targetPlayer) : { x: player.hook.x, y: player.hook.y }; const a = worldToScreen(origin.x, origin.y); const b = worldToScreen(target.x, target.y); const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy); const nx = -dy / (len || 1); const ny = dx / (len || 1);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = player.hook.type === 'player' ? '#f26a3d' : '#f0bf4d'; ctx.lineWidth = player.id === state.meId ? 7 : 5; ctx.beginPath(); ctx.moveTo(a.x, a.y); const steps = Math.max(5, Math.floor(len / 20)); for (let index = 1; index <= steps; index += 1) { const t = index / steps; const wave = Math.sin(t * Math.PI * 2.5) * 5; ctx.lineTo(a.x + dx * t + nx * wave, a.y + dy * t + ny * wave); } ctx.stroke(); ctx.strokeStyle = 'rgba(244,242,233,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y - 2); ctx.lineTo(b.x, b.y - 2); ctx.stroke(); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function drawPasta(player) {
  const pos = worldToScreen(player.x, player.y); const width = player.w * state.zoom; const height = player.h * state.zoom; if (pos.x > innerWidth + 60 || pos.x + width < -60 || pos.y > innerHeight + 60 || pos.y + height < -60) return;
  ctx.save(); ctx.translate(pos.x, pos.y); if (player.finished) ctx.globalAlpha = .5;
  ctx.fillStyle = 'rgba(21,33,39,.45)'; ctx.beginPath(); ctx.ellipse(width / 2, height + 5, width * .6, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#9b3d2b'; ctx.fillStyle = '#e5a33c'; ctx.beginPath(); ctx.moveTo(5, height * .42); ctx.bezierCurveTo(width * .18, -5, width * .82, 4, width - 5, height * .4); ctx.bezierCurveTo(width * .82, height + 3, width * .18, height + 4, 5, height * .42); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#f4c65e'; ctx.lineWidth = Math.max(4, 6 * state.zoom); ctx.beginPath(); ctx.moveTo(width * .1, height * .52); ctx.bezierCurveTo(width * .3, height * .2, width * .68, height * .88, width * .92, height * .46); ctx.stroke();
  ctx.fillStyle = '#d94731'; ctx.beginPath(); ctx.arc(width * .28, height * .48, 4 * state.zoom, 0, Math.PI * 2); ctx.arc(width * .7, height * .48, 4 * state.zoom, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#152127'; ctx.beginPath(); ctx.arc(width * .52, height * .36, 2.4 * state.zoom, 0, Math.PI * 2); ctx.arc(width * .65, height * .36, 2.4 * state.zoom, 0, Math.PI * 2); ctx.fill();
  if (player.id === state.meId) { ctx.strokeStyle = '#f0bf4d'; ctx.lineWidth = 2; ctx.strokeRect(-3, -3, width + 6, height + 6); }
  ctx.fillStyle = '#f4f2e9'; ctx.font = `${Math.max(9, 10 * state.zoom)}px IBM Plex Mono, monospace`; ctx.textAlign = 'center'; ctx.fillText(player.name, width / 2, -12 * state.zoom); ctx.restore();
}
function drawFinish() { if (!state.map?.finish) return; const pos = worldToScreen(state.map.finish.x, state.map.finish.y); ctx.strokeStyle = '#f4f2e9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pos.x, pos.y + 34 * state.zoom); ctx.lineTo(pos.x, pos.y - 28 * state.zoom); ctx.stroke(); ctx.fillStyle = '#f26a3d'; ctx.beginPath(); ctx.moveTo(pos.x, pos.y - 28 * state.zoom); ctx.lineTo(pos.x + 30 * state.zoom, pos.y - 18 * state.zoom); ctx.lineTo(pos.x, pos.y - 8 * state.zoom); ctx.closePath(); ctx.fill(); }

function frame(now) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); const viewWidth = innerWidth; const viewHeight = innerHeight; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, viewWidth, viewHeight);
  if (state.screen === 'game' && state.map) {
    state.zoom = Math.max(.72, Math.min(1.16, Math.min(viewWidth / 1060, viewHeight / 650))); const me = state.players.find((player) => player.id === state.meId) || state.players[0];
    if (me) { const targetX = me.x + me.w / 2 - viewWidth / state.zoom * .5; const targetY = me.y + me.h / 2 - viewHeight / state.zoom * .58; state.cameraX += (targetX - state.cameraX) * .15; state.cameraY += (targetY - state.cameraY) * .15; }
    drawBackground(viewWidth, viewHeight); state.map.platforms.forEach(drawPlatform); state.map.items.forEach(drawItem); drawFinish(); state.players.forEach(drawNoodle); state.players.forEach(drawPasta); if (state.bannerTimer < now) $('gameBanner').classList.add('is-hidden');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
