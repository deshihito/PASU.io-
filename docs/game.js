// ===== PASU.io メインゲームクライアント（改善版） =====

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

// 改善機能：入力バッファ
let inputBuffer = [];
const INPUT_BUFFER_SIZE = 10;

// 改善機能：チャージショット
let chargeLevel = 0;
let isCharging = false;

// 改善機能：ダメージインジケータ
let damageIndicators = [];

// 改善機能：キルログ
let killLogs = [];
const KILL_LOG_DISPLAY_TIME = 5000; // 5秒表示

// 改善機能：敵発見マーカー
let enemyMarkers = [];

// 改善機能：ウェポンスロット
let weaponSlots = [1, 2, 3, 4]; // スロット1-4
let currentSlot = 0;

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
  
  // 被弾検知（改善：ダメージインジケータ追加）
  if (lastMyState && me.hp < lastMyState.hp) {
    Audio.damage();
    Particles.screenShake = 5;
    
    // ダメージインジケータ生成
    const damageAmount = lastMyState.hp - me.hp;
    addDamageIndicator(me.x + me.width/2, me.y, damageAmount, me.lastHitDir || 0);
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
  
  // キルログ（改善版：複数行表示対応）
  if (data.killLog && data.killLog.length > 0) {
    for (const entry of data.killLog) {
      addKillLog(entry.killer, entry.victim, entry.weapon);
      if (entry.killer === myId) {
        Audio.kill();
        Particles.emit(me.x + me.width/2, me.y, 'burst', { count: 15, color: '#ffd60a', speed: 5 });
      }
    }
  }
  
  // 敵発見マーカー生成
  updateEnemyMarkers(me);
  
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

// ===== 改善機能：入力バッファ =====

function addInputBuffer(input) {
  inputBuffer.push({ ...input, timestamp: Date.now() });
  if (inputBuffer.length > INPUT_BUFFER_SIZE) {
    inputBuffer.shift();
  }
}

function getBufferedInput() {
  return inputBuffer.length > 0 ? inputBuffer[0] : null;
}

// ===== 改善機能：ダメージインジケータ =====

function addDamageIndicator(x, y, damage, direction) {
  const angle = direction || (Math.random() * Math.PI * 2);
  damageIndicators.push({
    x: x,
    y: y,
    damage: damage,
    angle: angle,
    time: 0,
    maxTime: 60,
    offsetX: Math.cos(angle) * 20,
    offsetY: Math.sin(angle) * 20
  });
}

function updateDamageIndicators() {
  for (let i = damageIndicators.length - 1; i >= 0; i--) {
    const di = damageIndicators[i];
    di.time++;
    if (di.time >= di.maxTime) {
      damageIndicators.splice(i, 1);
    }
  }
}

function drawDamageIndicators(ctx, cameraX, cameraY) {
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  
  for (const di of damageIndicators) {
    const progress = di.time / di.maxTime;
    const alpha = 1 - progress;
    const screenX = di.x + di.offsetX * progress - cameraX;
    const screenY = di.y + di.offsetY * progress - cameraY;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff3333';
    ctx.fillText('-' + di.damage, screenX, screenY);
    ctx.restore();
  }
}

// ===== 改善機能：キルログ =====

function addKillLog(killerId, victimId, weapon) {
  killLogs.push({
    killerId: killerId,
    victimId: victimId,
    weapon: weapon,
    timestamp: Date.now()
  });
  
  // 古いログを削除
  killLogs = killLogs.filter(log => 
    Date.now() - log.timestamp < KILL_LOG_DISPLAY_TIME
  );
}

function drawKillLogs(ctx, cameraX, cameraY, players) {
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  const startY = 30;
  const lineHeight = 22;
  
  for (let i = 0; i < Math.min(killLogs.length, 5); i++) {
    const log = killLogs[i];
    const killer = players[log.killerId];
    const victim = players[log.victimId];
    
    if (!killer || !victim) continue;
    
    const killerName = killer.nickname || 'Player';
    const victimName = victim.nickname || 'Player';
    const text = `${killerName} ${log.weapon || '🍝'} ${victimName}`;
    
    const alpha = Math.max(0, 1 - (Date.now() - log.timestamp) / KILL_LOG_DISPLAY_TIME);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#333333';
    ctx.fillText(text, 10, startY + i * lineHeight);
    ctx.restore();
  }
}

// ===== 改善機能：敵発見マーカー =====

function updateEnemyMarkers(me) {
  enemyMarkers = [];
  
  for (const id in players) {
    if (id === myId) continue;
    const enemy = players[id];
    if (enemy.zone !== 'battle') continue;
    
    const dx = enemy.x - me.x;
    const dy = enemy.y - me.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    // 画面外の敵を検出
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    if (Math.abs(dx) > screenWidth/2 || Math.abs(dy) > screenHeight/2) {
      const angle = Math.atan2(dy, dx);
      enemyMarkers.push({
        angle: angle,
        distance: dist,
        id: id,
        color: enemy.color || '#ff0000'
      });
    }
  }
}

function drawEnemyMarkers(ctx, canvasWidth, canvasHeight) {
  const markerSize = 20;
  const borderDist = 40;
  
  for (const marker of enemyMarkers) {
    const rad = marker.angle;
    let markerX = canvasWidth/2 + Math.cos(rad) * (canvasWidth/2 - borderDist);
    let markerY = canvasHeight/2 + Math.sin(rad) * (canvasHeight/2 - borderDist);
    
    ctx.save();
    ctx.fillStyle = marker.color;
    ctx.globalAlpha = 0.7;
    
    // 三角形マーカー描画
    ctx.beginPath();
    ctx.moveTo(markerX + Math.cos(rad) * markerSize, markerY + Math.sin(rad) * markerSize);
    ctx.lineTo(markerX + Math.cos(rad + 2.4) * markerSize, markerY + Math.sin(rad + 2.4) * markerSize);
    ctx.lineTo(markerX + Math.cos(rad - 2.4) * markerSize, markerY + Math.sin(rad - 2.4) * markerSize);
    ctx.fill();
    
    ctx.restore();
  }
}

// ===== チャージショット制御 =====

function startCharging() {
  isCharging = true;
  chargeLevel = 0;
}

function updateCharging() {
  if (isCharging && chargeLevel < 60) {
    chargeLevel++;
  }
}

function fireWithCharge() {
  const me = players[myId];
  if (me && isCharging) {
    socket.emit('fire', { angle: Input.aimAngle, chargeLevel: chargeLevel });
    chargeLevel = 0;
    isCharging = false;
  }
}

function drawChargeBar(ctx, canvasWidth, canvasHeight) {
  if (!isCharging || chargeLevel <= 0) return;
  
  const barWidth = 100;
  const barHeight = 8;
  const x = canvasWidth / 2 - barWidth / 2;
  const y = canvasHeight - 50;
  
  // 背景
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(x, y, barWidth, barHeight);
  
  // 充電中
  const chargeProgress = Math.min(1, chargeLevel / 60);
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x, y, barWidth * chargeProgress, barHeight);
  
  // 枠
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barWidth, barHeight);
}

// ===== ウェポンスロット表示 =====

function drawWeaponSlots(ctx, canvasWidth) {
  const slotSize = 40;
  const slotGap = 5;
  const startX = canvasWidth - (slotSize + slotGap) * 5;
  const startY = 10;
  
  for (let i = 0; i < 4; i++) {
    const x = startX + i * (slotSize + slotGap);
    const y = startY;
    
    // 背景
    ctx.fillStyle = i === currentSlot ? '#ffcc00' : '#cccccc';
    ctx.fillRect(x, y, slotSize, slotSize);
    
    // 枠
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, slotSize, slotSize);
    
    // 番号
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.fillText(i + 1, x + slotSize/2, y + slotSize - 5);
  }
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
  
  // UI描画（カメラ影響なし）
  updateDamageIndicators();
  drawDamageIndicators(ctx, Renderer.cameraX, Renderer.cameraY);
  drawKillLogs(ctx, Renderer.cameraX, Renderer.cameraY, players);
  drawEnemyMarkers(ctx, canvas.width, canvas.height);
  drawChargeBar(ctx, canvas.width, canvas.height);
  drawWeaponSlots(ctx, canvas.width);
  
  requestAnimationFrame(gameLoop);
}

// ===== 入力送信ループ =====

setInterval(() => {
  const state = Input.getState();
  
  // 入力バッファに追加
  addInputBuffer(state);
  
  // チャージ処理
  if (state.fire) {
    if (!isCharging) startCharging();
    updateCharging();
  } else if (isCharging) {
    fireWithCharge();
  }
  
  // ウェポンスロット切り替え
  if (state.slot !== undefined) {
    currentSlot = state.slot;
    socket.emit('switchWeapon', state.slot);
  }
  
  socket.emit('input', state);
}, 1000 / 60);

// ===== スタート =====

gameLoop();
