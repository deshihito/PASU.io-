const BLOCK_SIZE = 40;
const GAME_WIDTH = 3000;
const GAME_HEIGHT = 800;
const MAP_COLS = Math.ceil(GAME_WIDTH / BLOCK_SIZE);
const MAP_ROWS = Math.ceil(GAME_HEIGHT / BLOCK_SIZE);

const BLOCKS = [];

function initMap() {
  BLOCKS.length = 0;
  
  // 床
  for (let x = 0; x < MAP_COLS; x++) {
    BLOCKS.push({ c: x, r: MAP_ROWS - 1, type: 1 });
    BLOCKS.push({ c: x, r: MAP_ROWS - 2, type: 1 });
  }
  // 天井
  for (let x = 0; x < MAP_COLS; x++) {
    BLOCKS.push({ c: x, r: 0, type: 1 });
    BLOCKS.push({ c: x, r: 1, type: 1 });
  }
  // 左右壁
  for (let y = 2; y < MAP_ROWS - 2; y++) {
    BLOCKS.push({ c: 0, r: y, type: 1 });
    BLOCKS.push({ c: 1, r: y, type: 1 });
    BLOCKS.push({ c: MAP_COLS - 1, r: y, type: 1 });
    BLOCKS.push({ c: MAP_COLS - 2, r: y, type: 1 });
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
      BLOCKS.push({ c: p.c + i, r: p.r, type: 1 });
    }
  }
  
  // ブッシュ（type: 4）
  const bushes = [
    { c: 10, r: 16, w: 4, h: 2 }, { c: 25, r: 13, w: 3, h: 3 },
    { c: 45, r: 15, w: 5, h: 2 }, { c: 55, r: 11, w: 4, h: 3 },
    { c: 18, r: 17, w: 3, h: 2 }, { c: 38, r: 14, w: 4, h: 2 }
  ];
  for (const bush of bushes) {
    for (let i = 0; i < bush.w; i++) {
      for (let j = 0; j < bush.h; j++) {
        BLOCKS.push({ c: bush.c + i, r: bush.r + j, type: 4 });
      }
    }
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
    const cx = Math.floor(px / BLOCK_SIZE);
    const cy = Math.floor(py / BLOCK_SIZE);
    const b = blockAt(cx, cy);
    if (b && b.type === 1) return { x: px, y: py, block: b };
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
      if (b && b.type === 1) return true;
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
  rectBlocksIntersect
};
