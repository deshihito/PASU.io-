/* Design philosophy: post-industrial sports graphic — sparse corner HUD, safety colors, tactile long-press interactions. */
const socket = io();
const $ = (id) => document.getElementById(id);

const state = {
  screen: 'home',
  meId: null,
  room: null,
  map: null,
  players: [],
  cameraX: 0,
  cameraY: 0,
  zoom: 1,
  bannerTimer: 0,
};

const input = {
  left: false,
  right: false,
  jumpQueued: false,
  hookHeld: false,
  aimX: 1100,
  aimY: 580,
};

const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');

function setScreen(name) {
  state.screen = name;
  $('homeScreen').classList.toggle('is-hidden', name !== 'home');
  $('roomScreen').classList.toggle('is-hidden', name !== 'room');
  $('gameScreen').classList.toggle('is-hidden', name !== 'game');
  if (name === 'game') resizeCanvas();
}

function setStatus(id, text) {
  $(id).textContent = text || '';
}

function playerName() {
  const raw = $('nameInput').value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return (raw || 'PLAYER').slice(0, 12);
}

function showBanner(text, duration = 1250) {
  const banner = $('gameBanner');
  banner.textContent = text;
  banner.classList.remove('is-hidden');
  state.bannerTimer = performance.now() + duration;
}

function renderRoom() {
  if (!state.room) return;
  $('roomCodeLabel').textContent = state.room.id;
  $('seedLabel').textContent = String(state.room.seed).padStart(10, '0');
  $('playerCount').textContent = `${state.players.length}/6`;
  $('startButton').hidden = state.room.hostId !== state.meId;
  $('startButton').textContent = state.room.started ? 'LIVE' : 'START';
  $('startButton').disabled = Boolean(state.room.started);
  const list = $('playerList');
  list.innerHTML = state.players.map((player, index) => {
    const host = player.id === state.room.hostId;
    const me = player.id === state.meId;
    const label = escapeHTML(player.name || `PLAYER ${index + 1}`);
    return `<div class="player-row${host ? ' is-host' : ''}" style="--player-color:${player.color}"><span class="player-dot"></span><span>${label}${me ? ' <small>YOU</small>' : ''}</span><small>${String(player.score || 0).padStart(2, '0')}</small></div>`;
  }).join('');
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function applyWorld(data) {
  state.room = data.room;
  state.map = data.map;
  state.players = data.players || [];
  const me = state.players.find((player) => player.id === state.meId);
  if (me) {
    $('hudScore').textContent = String(me.score || 0).padStart(2, '0');
    $('hookMeter').style.width = me.hook ? `${Math.min(100, (me.hook.len || 0) / 7)}%` : '0%';
  }
  renderCrew();
  if (state.room?.started && state.screen !== 'game') setScreen('game');
  if (!state.room?.started && state.screen === 'game') setScreen('room');
}

function renderCrew() {
  $('hudCrew').innerHTML = state.players.map((player) => `<i class="crew-dot" style="--dot:${player.color}" title="${escapeHTML(player.name)}"></i>`).join('');
}

$('createButton').addEventListener('click', () => {
  setStatus('homeStatus', 'CONNECTING');
  socket.emit('createRoom', { name: playerName() });
});

$('joinButton').addEventListener('click', () => {
  const code = $('roomInput').value.trim().toUpperCase();
  if (code.length !== 4) {
    setStatus('homeStatus', 'CODE');
    return;
  }
  setStatus('homeStatus', 'CONNECTING');
  socket.emit('joinRoom', { code, name: playerName() });
});

$('roomInput').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('startButton').addEventListener('click', () => socket.emit('startGame'));
$('leaveButton').addEventListener('click', leaveRoom);
$('gameLeaveButton').addEventListener('click', leaveRoom);

function leaveRoom() {
  socket.emit('leaveRoom');
  input.hookHeld = false;
  state.room = null;
  state.map = null;
  state.players = [];
  setScreen('home');
  setStatus('homeStatus', '');
}

socket.on('connect', () => setStatus('homeStatus', 'ONLINE'));
socket.on('disconnect', () => {
  input.hookHeld = false;
  if (state.screen === 'home') setStatus('homeStatus', 'OFFLINE');
  else setStatus('roomStatus', 'OFFLINE');
});
socket.on('roomJoined', (data) => {
  state.meId = socket.id;
  applyWorld(data);
  $('hudRoom').textContent = data.room.id;
  $('hudSeed').textContent = `SEED ${data.room.seed}`;
  setStatus('homeStatus', '');
  setStatus('roomStatus', '');
  setScreen(data.room.started ? 'game' : 'room');
});
socket.on('state', (data) => {
  applyWorld(data);
  if (state.screen === 'room') renderRoom();
});
socket.on('roomError', () => setStatus(state.screen === 'home' ? 'homeStatus' : 'roomStatus', 'ROOM'));
socket.on('itemCollected', ({ playerId, score }) => {
  if (playerId === state.meId) {
    $('hudScore').textContent = String(score || 0).padStart(2, '0');
    showBanner('+ SCRAP', 850);
  }
});
socket.on('finish', ({ playerId }) => {
  if (playerId === state.meId) showBanner('FINISH', 1700);
});

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function updateAim(event) {
  const rect = canvas.getBoundingClientRect();
  input.aimX = state.cameraX + (event.clientX - rect.left) / state.zoom;
  input.aimY = state.cameraY + (event.clientY - rect.top) / state.zoom;
}
canvas.addEventListener('pointermove', updateAim);
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || state.screen !== 'game') return;
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  updateAim(event);
  input.hookHeld = true;
});
window.addEventListener('pointerup', () => { input.hookHeld = false; });
window.addEventListener('pointercancel', () => { input.hookHeld = false; });
window.addEventListener('blur', () => { input.hookHeld = false; input.left = false; input.right = false; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyA' || event.code === 'ArrowLeft') { input.left = true; event.preventDefault(); }
  if (event.code === 'KeyD' || event.code === 'ArrowRight') { input.right = true; event.preventDefault(); }
  if (event.code === 'Space') { input.jumpQueued = true; event.preventDefault(); }
  if (event.code === 'Escape' && state.screen === 'game') leaveRoom();
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyA' || event.code === 'ArrowLeft') input.left = false;
  if (event.code === 'KeyD' || event.code === 'ArrowRight') input.right = false;
});

setInterval(() => {
  const move = Number(input.right) - Number(input.left);
  socket.emit('input', { move, jump: input.jumpQueued, hook: input.hookHeld, aimX: input.aimX, aimY: input.aimY });
  input.jumpQueued = false;
}, 50);

function drawRoundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawWorldBackground(viewWidth, viewHeight) {
  ctx.fillStyle = '#17262a';
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = '#20353a';
  ctx.fillRect(0, viewHeight * .62, viewWidth, viewHeight * .38);
  ctx.strokeStyle = 'rgba(217, 216, 207, .08)';
  ctx.lineWidth = 1;
  const grid = 44 * state.zoom;
  const offset = ((-state.cameraX * state.zoom) % grid + grid) % grid;
  for (let x = offset; x < viewWidth; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewHeight); ctx.stroke(); }
  for (let y = ((-state.cameraY * state.zoom) % grid + grid) % grid; y < viewHeight; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewWidth, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(240, 191, 77, .09)';
  for (let index = 0; index < 8; index += 1) {
    const x = ((index * 220 - state.cameraX * .16) % (viewWidth + 220)) - 80;
    const y = viewHeight * .18 + (index % 3) * 28;
    ctx.fillRect(x, y, 110, 6);
    ctx.fillRect(x + 18, y - 26, 6, 32);
  }
}

function worldToScreen(x, y) { return { x: (x - state.cameraX) * state.zoom, y: (y - state.cameraY) * state.zoom }; }

function drawPlatform(platform) {
  const pos = worldToScreen(platform.x, platform.y);
  const width = platform.w * state.zoom;
  const height = platform.h * state.zoom;
  if (pos.x > window.innerWidth || pos.x + width < 0 || pos.y > window.innerHeight || pos.y + height < 0) return;
  ctx.fillStyle = '#536464';
  ctx.fillRect(pos.x, pos.y, width, height);
  ctx.fillStyle = '#f0bf4d';
  ctx.fillRect(pos.x, pos.y, width, Math.max(4, 6 * state.zoom));
  ctx.fillStyle = 'rgba(21, 33, 39, .34)';
  for (let x = pos.x + 16; x < pos.x + width; x += 34) ctx.fillRect(x, pos.y + height * .55, 11, 3);
  ctx.strokeStyle = 'rgba(21, 33, 39, .7)';
  ctx.strokeRect(pos.x + .5, pos.y + .5, width - 1, height - 1);
}

function drawItem(item) {
  if (item.collected) return;
  const pos = worldToScreen(item.x, item.y);
  if (pos.x < -40 || pos.x > window.innerWidth + 40 || pos.y < -40 || pos.y > window.innerHeight + 40) return;
  const size = item.type === 'relic' ? 13 : 10;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = item.type === 'relic' ? '#f0bf4d' : '#f26a3d';
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.fillStyle = 'rgba(244, 242, 233, .65)';
  ctx.fillRect(-size + 4, -size + 4, 4, 4);
  ctx.restore();
}

function playerCenter(player) { return { x: player.x + player.w / 2, y: player.y + player.h / 2 }; }

function drawHook(player) {
  if (!player.hook) return;
  const origin = playerCenter(player);
  const targetPlayer = state.players.find((candidate) => candidate.id === player.hook.id);
  const target = targetPlayer ? playerCenter(targetPlayer) : { x: player.hook.x, y: player.hook.y };
  const a = worldToScreen(origin.x, origin.y);
  const b = worldToScreen(target.x, target.y);
  ctx.save();
  ctx.strokeStyle = player.hook.type === 'player' ? '#f26a3d' : '#f0bf4d';
  ctx.lineWidth = player.id === state.meId ? 3 : 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayer(player) {
  const pos = worldToScreen(player.x, player.y);
  const width = player.w * state.zoom;
  const height = player.h * state.zoom;
  if (pos.x > window.innerWidth + 40 || pos.x + width < -40 || pos.y > window.innerHeight + 40 || pos.y + height < -40) return;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  if (player.finished) ctx.globalAlpha = .55;
  ctx.fillStyle = 'rgba(21, 33, 39, .44)';
  ctx.fillRect(-3, height - 1, width + 6, 6);
  ctx.fillStyle = player.color || '#f26a3d';
  drawRoundedRect(0, 10 * state.zoom, width, height - 10 * state.zoom, 7 * state.zoom); ctx.fill();
  ctx.fillStyle = '#f4f2e9';
  ctx.beginPath(); ctx.arc(width / 2, 10 * state.zoom, 9 * state.zoom, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#152127';
  ctx.fillRect(width * .25, 8 * state.zoom, width * .5, 4 * state.zoom);
  if (player.id === state.meId) { ctx.strokeStyle = '#f0bf4d'; ctx.lineWidth = 3; ctx.strokeRect(-3, 7 * state.zoom, width + 6, height - 4 * state.zoom); }
  ctx.fillStyle = '#f4f2e9'; ctx.font = `${Math.max(9, 10 * state.zoom)}px IBM Plex Mono, monospace`; ctx.textAlign = 'center'; ctx.fillText(player.name, width / 2, -10 * state.zoom);
  ctx.restore();
}

function drawFinish() {
  if (!state.map?.finish) return;
  const pos = worldToScreen(state.map.finish.x, state.map.finish.y);
  ctx.strokeStyle = '#f4f2e9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pos.x, pos.y + 32 * state.zoom); ctx.lineTo(pos.x, pos.y - 26 * state.zoom); ctx.stroke();
  ctx.fillStyle = '#f26a3d'; ctx.beginPath(); ctx.moveTo(pos.x, pos.y - 26 * state.zoom); ctx.lineTo(pos.x + 28 * state.zoom, pos.y - 17 * state.zoom); ctx.lineTo(pos.x, pos.y - 8 * state.zoom); ctx.closePath(); ctx.fill();
}

function frame(now) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  if (state.screen === 'game' && state.map) {
    state.zoom = Math.max(.72, Math.min(1.16, Math.min(viewWidth / 1060, viewHeight / 650)));
    const me = state.players.find((player) => player.id === state.meId) || state.players[0];
    if (me) {
      const targetX = me.x + me.w / 2 - viewWidth / state.zoom * .5;
      const targetY = me.y + me.h / 2 - viewHeight / state.zoom * .58;
      state.cameraX += (targetX - state.cameraX) * .12;
      state.cameraY += (targetY - state.cameraY) * .12;
    }
    drawWorldBackground(viewWidth, viewHeight);
    state.map.platforms.forEach(drawPlatform);
    state.map.items.forEach(drawItem);
    drawFinish();
    state.players.forEach(drawHook);
    state.players.forEach(drawPlayer);
    if (state.bannerTimer < now) $('gameBanner').classList.add('is-hidden');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
