const C = require('../shared/constants');

const BLOCK_SIZE = C.BLOCK_SIZE;
const GAME_WIDTH = C.GAME_WIDTH;
const GAME_HEIGHT = C.GAME_HEIGHT;
const MAP_COLS = Math.ceil(GAME_WIDTH / BLOCK_SIZE);
const MAP_ROWS = Math.ceil(GAME_HEIGHT / BLOCK_SIZE);
const BLOCKS = [];

function initMap() {
  BLOCKS.length = 0;
  
  // 床
  for (let x = 0; x < MAP_COLS; x++) {
    BLOCKS.push({ c: x, r: MAP_ROWS - 1, type: C.BLOCK_WALL });
    BLOCKS.push({ c: x, r: MAP_ROWS - 2, type: C.BLOCK_WALL });
  }
  // 天井
  for (let x = 0; x < MAP_COLS; x++) {
    BLOCKS.push({ c: x, r: 0, type: C.BLOCK_WALL });
    BLOCKS.push({ c: x, r: 1, type: C.BLOCK_WALL });
  }
  // 左右壁
  for (let y = 2; y < MAP_ROWS - 2; y++) {
    BLOCKS.push({ c: 0, r: y, type: C.BLOCK_WALL });
    BLOCKS.push({ c: 1, r: y, type: C.BLOCK_WALL });
    BLOCKS.push({ c: MAP_COLS - 1, r: y, type: C.BLOCK_WALL });
    BLOCKS.push({ c: MAP_COLS - 2, r: y, type: C.BLOCK_WALL });
  }
  
  // プラットフォーム
  const platforms = [
    { c: 6, r: 14, w: 8 }, { c: 20, r: 12, w: 6 },
    { c: 35, r: 15, w: 7 }, { c: 50, r: 10, w: 5 },
    { c: 15, r: 8, w: 4 }, { c: 40, r: 13, w: 5 },
    { c: 58, r: 9, w: 6 }, { c: 8, r: 18, w: 5 },
    { c: 28, r: 16, w: 4 }, { c: 45, r: 7, w: 6 },
    { c: 65, r: 14, w: 5 }, { c: 22, r: 5, w: 4 }
  ];
  for (const p of platforms) {
    for (let i = 0; i < p.w; i++) {
      BLOCKS.push({ c: p.c + i, r: p.r, type: C.BLOCK_WALL });
    }
  }
  
  // ブッシュ
  const bushes = [
    { c: 10, r: 16, w: 4, h: 2 }, { c: 25, r: 13, w: 3, h: 3 },
    { c: 45, r: 15, w: 5, h: 2 }, { c: 55, r: 11, w: 4, h: 3 },
    { c: 18, r: 17, w: 3, h: 2 }, { c: 38, r: 14, w: 4, h: 2 }
  ];
  for (const bush of bushes) {
    for (let i = 0; i < bush.w; i++) {
      for (let j = 0; j < bush.h; j++) {
        BLOCKS.push({ c: bush.c + i, r: bush.r + j, type: C.BLOCK_BUSH });
      }
    }
  }
  
  // ジャンプ台
  BLOCKS.push({ c: 30, r: 16, type: C.BLOCK_JUMP });
  BLOCKS.push({ c: 31, r: 16, type: C.BLOCK_JUMP });
  BLOCKS.push({ c: 48, r: 12, type: C.BLOCK_JUMP });
  
  // 氷
  for (let i = 0; i < 5; i++) {
    BLOCKS.push({ c: 60 + i, r: 16, type: C.BLOCK_ICE });
  }
  
  // トゲ
  BLOCKS.push({ c: 12, r: 15, type: C.BLOCK_SPIKE });
  BLOCKS.push({ c: 13, r: 15, type: C.BLOCK_SPIKE });
  
  // 風（右向き）
  for (let i = 0; i < 3; i++) {
    BLOCKS.push({ c: 42 + i, r: 8, type: C.BLOCK_WIND_RIGHT });
  }
  
  // 暗闇エリア
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      BLOCKS.push({ c: 16 + i, r: 10 + j, type: C.BLOCK_DARKNESS });
    }
  }
  
  // 崩落ブロック
  BLOCKS.push({ c: 24, r: 11, type: C.BLOCK_COLLAPSE });
  BLOCKS.push({ c: 25, r: 11, type: C.BLOCK_COLLAPSE });
  BLOCKS.push({ c: 24, r: 12, type: C.BLOCK_COLLAPSE });
  
  // 回復ゾーン
  for (let i = 0; i < 3; i++) {
    BLOCKS.push({ c: 52 + i, r: 14, type: C.BLOCK_HEAL });
  }
}

initMap();

function blockAt(cx, cy) {
  for (const b of BLOCKS) {
    if (b.c === cx && b.r === cy) return b;
  }
  return null;
}

function lineBlockIntersect(x1, y1, x2, y2) {
  const steps = Math.ceil(Math.max(Math.abs(x2-x1), Math.abs(y2-y1)) / (BLOCK_SIZE/2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const b = blockAt(Math.floor(px/BLOCK_SIZE), Math.floor(py/BLOCK_SIZE));
    if (b && b.type === C.BLOCK_WALL) return { x: px, y: py, block: b };
  }
  return null;
}

// フック貫通防止：プレイヤーの当たり判定内のブロックを無視
function lineBlockIntersectSafe(x1, y1, x2, y2, player) {
  const steps = Math.ceil(Math.max(Math.abs(x2-x1), Math.abs(y2-y1)) / (BLOCK_SIZE/2));
  const playerC1 = Math.floor(player.x / BLOCK_SIZE);
  const playerC2 = Math.floor((player.x + player.width) / BLOCK_SIZE);
  const playerR1 = Math.floor(player.y / BLOCK_SIZE);
  const playerR2 = Math.floor((player.y + player.height) / BLOCK_SIZE);
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const c = Math.floor(px/BLOCK_SIZE);
    const r = Math.floor(py/BLOCK_SIZE);
    // プレイヤーの当たり判定内ならスキップ
    if (c >= playerC1 && c <= playerC2 && r >= playerR1 && r <= playerR2) continue;
    const b = blockAt(c, r);
    if (b && b.type === C.BLOCK_WALL) return { x: px, y: py, block: b };
  }
  return null;
}

function rectBlocksIntersect(rx, ry, rw, rh) {
  const c1 = Math.floor(rx / BLOCK_SIZE);
  const c2 = Math.floor((rx + rw) / BLOCK_SIZE);
  const r1 = Math.floor(ry / BLOCK_SIZE);
  const r2 = Math.floor((ry + rh) / BLOCK_SIZE);
  for (let c = c1; c <= c2; c++) {
    for (let r = r1; r <= r2; r++) {
      const b = blockAt(c, r);
      if (b && b.type === C.BLOCK_WALL) return true;
    }
  }
  return false;
}

module.exports = {
  BLOCKS,
  BLOCK_SIZE,
  GAME_WIDTH,
  GAME_HEIGHT,
  MAP_COLS,
  MAP_ROWS,
  blockAt,
  lineBlockIntersect,
  lineBlockIntersectSafe,
  rectBlocksIntersect
};
