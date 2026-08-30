// ===== PASU.io メインゲームクライアント =====

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas のサイズをウィンドウサイズに設定
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);


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
let traps = [];
let smokeScreens = [];
let myId = null;
let blockSize = 40;
let returningTimer = 0;
let lastBulletCount = 0;
let lastMyState = null;
let comboData = null;

// マップエディタ（devMode時）
let editorBlockType = 1;
let editorHistory = [];
let editorHistoryIndex = -1;

function saveEditorHistory() {
  editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
  editorHistory.push(JSON.stringify(blocks));
  if (editorHistory.length > 50) editorHistory.shift();
  else editorHistoryIndex++;
}

canvas.addEventListener('mousedown', (e) => {
  if (!UI.devMode) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const worldX = (e.clientX - rect.left) * scaleX + Renderer.cameraX;
  const worldY = (e.clientY - rect.top) * scaleY + Renderer.cameraY;
  const cx = Math.floor(worldX / blockSize);
  const cy = Math.floor(worldY / blockSize);
  
  // 範囲塗りつぶし（ドラッグ開始）
  editorDragStart = { c: cx, r: cy };
  
  const existing = blocks.find(b => b.c === cx && b.r === cy);
  if (e.shiftKey) {
    if (existing) {
      const idx = blocks.indexOf(existing);
      blocks.splice(idx, 1);
      saveEditorHistory();
    }
  } else {
    if (!existing) {
      blocks.push({ c: cx, r: cy, type: editorBlockType });
      saveEditorHistory();
    }
  }
});

let editorDragStart = null;

canvas.addEventListener('mousemove', (e) => {
  if (!UI.devMode || !editorDragStart) return;
  if (!(e.buttons & 1)) { editorDragStart = null; return; }
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const worldX = (e.clientX - rect.left) * scaleX + Renderer.cameraX;
  const worldY = (e.clientY - rect.top) * scaleY + Renderer.cameraY;
  const cx = Math.floor(worldX / blockSize);
  const cy = Math.floor(worldY / blockSize);
  
  const c1 = Math.min(editorDragStart.c, cx);
  const c2 = Math.max(editorDragStart.c, cx);
  const r1 = Math.min(editorDragStart.r, cy);
  const r2 = Math.max(editorDragStart.r, cy);
  
  for (let c = c1; c <= c2; c++) {
    for (let r = r1; r <= r2; r++) {
      const existing = blocks.find(b => b.c === c && b.r === r);
      if (e.shiftKey) {
        if (existing) {
          const idx = blocks.indexOf(existing);
          blocks.splice(idx, 1);
        }
      } else {
        if (!existing) blocks.push({ c: c, r: r, type: editorBlockType });
      }
    }
  }
});

canvas.addEventListener('mouseup', () => {
  if (editorDragStart) {
    editorDragStart = null;
    saveEditorHistory();
  }
});

// マップエディタキー
window.addEventListener('keydown', (e) => {
  if (!UI.devMode) return;
  // ブロック種類選択
  if (e.key === '1') editorBlockType = 1;
  if (e.key === '2') editorBlockType = 4; // ブッシュ
  if (e.key === '3') editorBlockType = 0; // 消去（実際はshift+click）
  if (e.key === '4') editorBlockType = 3; // ジャンプ台
  if (e.key === '5') editorBlockType = 2; // 氷
  if (e.key === '6') editorBlockType = 5; // トゲ
  if (e.key === '7') editorBlockType = 9; // 暗闇
  if (e.key === '8') editorBlockType = 10; // 崩落
  if (e.key === '9') editorBlockType = 11; // 回復
  
  // Undo/Redo
  if (e.key === 'z' && e.ctrlKey) {
    e.preventDefault();
    if (editorHistoryIndex > 0) {
      editorHistoryIndex--;
      blocks = JSON.parse(editorHistory[editorHistoryIndex]);
    }
  }
  if (e.key === 'y' && e.ctrlKey) {
    e.preventDefault();
    if (editorHistoryIndex < editorHistory.length - 1) {
      editorHistoryIndex++;
      blocks = JSON.parse(editorHistory[editorHistoryIndex]);
    }
  }
  
  // マップエクスポート
  if (e.key === 'e' && e.ctrlKey) {
    e.preventDefault();
    const data = JSON.stringify(blocks);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map.json';
    a.click();
    URL.revokeObjectURL(url);
    UI.showStatus('マップをエクスポートしました', '#34c759');
  }
  
  // マップインポート
  if (e.key === 'i' && e.ctrlKey) {
    e.preventDefault();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          blocks = JSON.parse(event.target.result);
          saveEditorHistory();
          UI.showStatus('マップをインポートしました', '#34c759');
        } catch (err) {
          UI.showStatus('インポート失敗', '#e94560');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
});

// ===== Socketイベント =====

socket.on('connect', () => {
  myId = socket.id;
  UI.showStatus('接続完了', '#34c759');
  socket.emit('joinRoom', { roomId: 'default', mode: 'deathmatch' });
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
  traps = data.traps || [];
  smokeScreens = data.smokeScreens || [];
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
    // ダメージインジケータ
    const dx = lastMyState.x - me.x;
    const dy = lastMyState.y - me.y;
    const angle = Math.atan2(dy, dx);
    UI.showDamageIndicator(angle);
    
    // 振動フィードバック
    if (navigator.vibrate) navigator.vibrate(50);
  }
  
  // 弾発射検知
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
  
  // コンボ
  if (data.combo) {
    comboData = data.combo;
    setTimeout(() => { if (comboData === data.combo) comboData = null; }, 2000);
  }
  
  UI.hideMapSelect();
  
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
  Renderer.drawTraps(traps);
  Renderer.drawSmokeScreens(smokeScreens);
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
  Renderer.drawEnemyMarkers(players, myId);
  Renderer.drawHandMarker(players[myId], levers, movables, blocks);
  Renderer.drawChargeGauge(players[myId]);
  Renderer.drawCombo(comboData);
  
  // 暗闇オーバーレイ
  if (players[myId]) {
    Renderer.drawDarknessOverlay(players[myId]);
  }
  
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
