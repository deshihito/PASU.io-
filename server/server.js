const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }  // GitHub Pagesからのアクセスを許可
});

const PORT = process.env.PORT || 3000;

// ゲーム世界の状態
const players = {};
const GRAVITY = 0.6;
const GROUND_Y = 300;
const GAME_WIDTH = 800;

function updatePhysics() {
  for (const id in players) {
    const p = players[id];
    
    // 重力
    p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    
    // 床判定
    if (p.y > GROUND_Y) {
      p.y = GROUND_Y;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }
    
    // 壁判定
    if (p.x < 0) p.x = 0;
    if (p.x > GAME_WIDTH - 40) p.x = GAME_WIDTH - 40;
    
    // 摩擦
    p.vx *= 0.8;
  }
}

// 当たり判定（簡易）
function checkHits() {
  const ids = Object.keys(players);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = players[ids[i]];
      const b = players[ids[j]];
      const dx = (a.x + 20) - (b.x + 20);
      const dy = (a.y + 20) - (b.y + 20);
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 40) {
        // ノックバック
        const force = 15;
        const angle = Math.atan2(dy, dx);
        a.vx += Math.cos(angle) * force;
        a.vy -= 10;
        b.vx -= Math.cos(angle) * force;
        b.vy -= 10;
      }
    }
  }
}

// ゲームループ（60FPS）
setInterval(() => {
  updatePhysics();
  checkHits();
  io.emit('state', players);
}, 1000 / 60);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // 新規プレイヤー生成
  players[socket.id] = {
    x: 100 + Math.random() * 200,
    y: 200,
    vx: 0,
    vy: 0,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    onGround: false
  };

  // 入力受信
  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;
    
    const speed = 1.5;
    const jumpPower = -12;
    
    if (data.left) p.vx -= speed;
    if (data.right) p.vx += speed;
    if (data.jump && p.onGround) {
      p.vy = jumpPower;
      p.onGround = false;
    }
    if (data.attack) {
      // 攻撃判定（近くのプレイヤーを吹き飛ばす）
      for (const id in players) {
        if (id === socket.id) continue;
        const target = players[id];
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        if (Math.abs(dx) < 60 && Math.abs(dy) < 40) {
          target.vx += dx > 0 ? 20 : -20;
          target.vy -= 15;
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
