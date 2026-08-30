// ===== PASU.io メインゲームクライアント =====

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// グローバルカメラ（他モジュールから参照用）
window.cameraX = 0;
window.cameraY = 0;

// モジュール初期化
Input.init(canvas);
Renderer.init(canvas);
UI.init();
Audio.init();

const SERVER_URL = window.location.hostname === 'deshihito.github.io' 
  ? 'https://pasu-io.onrender.com' 
  : window.location.origin;

const socket = io(SERVER_URL);

// ゲーム状態
let players = {};
let blocks = [];
let bullets = [];
let levers = [];
let doors = [];
let movables = [];
let warpPads = [];
let restZone = {};
let shopNpc = {};
let myId = null;
let blockSize = 40;
let returningTimer = 0;
let lastBulletCount = 0;
let lastMyState = null;

// マップエディタ（devMode時）
canvas.addEventListener('mousedown', (e) => {
  if (!UI.devMode) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const worldX = (e.clientX - rect.left) * scaleX + Renderer.cameraX;
  const worldY = (e.clientY - rect.top) * scaleY + Renderer.cameraY;
  const cx = Math.floor(worldX / blockSize);
  const cy = Math.floor(worldY / blockSize);
  const existing = blocks.find(b => b.c === cx && b.r === cy);
  if (e.shiftKey) {
    if (existing) {
      const idx = blocks.indexOf(existing);
      blocks.splice(idx, 1);
    }
  } else {
    if (!existing) blocks.push({ c: cx, r: cy, type: 1 });
  }
});

// ===== Socketイベント =====

socket.on('connect', () => {
  myId = socket.id;
  UI.showStatus('接続完了', '#34c759');
  UI.showHUD();
  Audio.resume();
  Audio.playBGM();
});

socket.on('disconnect', () => {
  UI.showStatus('切断', '#e94560');
  Audio.stopBGM();
});

socket.on('state', (data) => {
  players = data.players;
  blocks = data.blocks;
  bullets = data.bullets;
  levers = data.levers;
  doors = data.doors;
  movables = data.movables;
  warpPads = data.warpPads;
  restZone = data.restZone;
  shopNpc = data.shopNpc;
  blockSize = data.blockSize || 40;
  
  const me = players[myId];
  if (!me) return;
  
  UI.updateHUD(me);
  returningTimer = me.returnTimer || 0;
  
  // 帰還完了時
  if (me.zone === 'rest' && lastMyState?.zone === 'battle') {
    Audio.warp();
  }
  
  // 被弾検知
  if (lastMyState && me.hp < lastMyState.hp) {
    Audio.damage();
    Particles.screenShake = 5;
  }
  
  // 弾発射検知（簡易）
  if (bullets.length > lastBulletCount) {
    Audio.bulletShoot();
  }
  lastBulletCount = bullets.length;
  
  // 着地検知
  if (!lastMyState?.onGround && me.onGround && me.vy > 5) {
    Audio.landing(me.vy);
    Particles.emitLanding(me.x + me.width/2, me.y + me.height, Math.floor(me.vy/5));
  }
  
  // キルログ
  if (data.killLog && data.killLog.length > 0) {
    for (const entry of data.killLog) {
      UI.addKillLog(entry.killer, entry.victim, entry.weapon);
      if (entry.killer === myId) {
        Audio.kill();
        Particles.emit(me.x + me.width/2, me.y, 'burst', { count: 15, color: '#ffd60a', speed: 5 });
      }
    }
  }
  
  if (me.zone === 'rest') {
    UI.showMapSelect(data.maps, (mi, si) => socket.emit('selectSpawn', mi, si));
  } else {
    UI.hideMapSelect();
  }
  
  lastMyState = { ...me };
});

socket.on('shopResult', (result) => {
  UI.showShopResult(result);
  if (result.success) Audio.coin();
});

socket.on('matchStart', () => {
  Audio.matchStart();
});

socket.on('matchEnd', () => {
  Audio.matchEnd();
});

// ===== カメラ更新 =====

function updateCamera() {
  const me = players[myId];
  if (!me) return;
  
  if (me.zone === 'rest') {
    Renderer.cameraX = restZone.x + restZone.w/2 - canvas.width/2;
    Renderer.cameraY = restZone.y + restZone.h/2 - canvas.height/2;
  } else {
    Renderer.cameraX = me.x - canvas.width/2 + me.width/2;
    Renderer.cameraY = me.y - canvas.height/2 + me.height/2;
    Renderer.cameraX = Math.max(0, Math.min(Renderer.cameraX, 3000 - canvas.width));
    Renderer.cameraY = Math.max(0, Math.min(Renderer.cameraY, 800 - canvas.height));
  }
  
  window.cameraX = Renderer.cameraX;
  window.cameraY = Renderer.cameraY;
}

// ===== メインループ =====

function gameLoop() {
  // クリア
  Renderer.clear();
  Renderer.drawBackground();
  
  // カメラ
  updateCamera();
  
  // シェイク適用
  const shake = Particles.getShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  
  // 描画
  Renderer.drawBlocks(blocks);
  Renderer.drawDoors(doors);
  Renderer.drawLevers(levers);
  Renderer.drawMovables(movables);
  Renderer.drawWarpPads(warpPads);
  Renderer.drawRestZone(restZone, shopNpc);
  
  // プレイヤー
  for (const id in players) {
    const p = players[id];
    Renderer.drawPastaTank(p, id === myId, myId);
    Renderer.drawHook(p);
    Renderer.drawHand(p);
  }
  
  // 弾・パーティクル
  Renderer.drawBullets(bullets);
  Particles.update();
  Particles.draw(ctx, Renderer.cameraX, Renderer.cameraY);
  
  // UI描画
  Renderer.drawMinimap(players, myId);
  Renderer.drawReturning(returningTimer);
  
  // 照準
  if (players[myId] && !players[myId].returning) {
    Renderer.drawAim(players[myId], Input.mouseX, Input.mouseY);
  }
  
  // 開発者ツール
  UI.drawDevTools(ctx, canvas, players, myId, blocks, bullets, 
    Renderer.cameraX, Renderer.cameraY, Input.mouseX, Input.mouseY);
  
  ctx.restore();
  
  requestAnimationFrame(gameLoop);
}

// ===== 入力送信ループ =====

setInterval(() => {
  const state = Input.getState();
  socket.emit('input', state);
}, 1000 / 60);

// ===== スタート =====

gameLoop();
