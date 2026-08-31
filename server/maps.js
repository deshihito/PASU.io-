const C = require('../shared/constants');

const BLOCK_SIZE = C.BLOCK_SIZE;
const GAME_WIDTH = C.GAME_WIDTH;
const GAME_HEIGHT = C.GAME_HEIGHT;
const MAP_COLS = Math.ceil(GAME_WIDTH / BLOCK_SIZE);
const MAP_ROWS = Math.ceil(GAME_HEIGHT / BLOCK_SIZE);
const BLOCKS = [];
const POT_CHUNK_HEIGHT = 640;
const POT_CHUNK_ROWS = POT_CHUNK_HEIGHT / BLOCK_SIZE;
const POT_LOAD_RADIUS = 2;
const loadedPotChunks = new Map();

function addBlock(blocks, c, r, type = C.BLOCK_WALL) {
  blocks.push({ c, r, type });
}

function addHorizontal(blocks, c, r, width, type = C.BLOCK_WALL) {
  for (let i = 0; i < width; i++) addBlock(blocks, c + i, r, type);
}

function addBoundary(blocks) {
  addHorizontal(blocks, 0, 0, MAP_COLS);
  addHorizontal(blocks, 0, 1, MAP_COLS);
  addHorizontal(blocks, 0, MAP_ROWS - 2, MAP_COLS);
  addHorizontal(blocks, 0, MAP_ROWS - 1, MAP_COLS);
  for (let r = 2; r < MAP_ROWS - 2; r++) {
    addBlock(blocks, 0, r); addBlock(blocks, 1, r);
    addBlock(blocks, MAP_COLS - 2, r); addBlock(blocks, MAP_COLS - 1, r);
  }
}

function createFlatMap() {
  const blocks = [];
  addBoundary(blocks);
  addHorizontal(blocks, 12, 16, 5);
  addHorizontal(blocks, 26, 14, 5);
  addHorizontal(blocks, 42, 16, 6);
  addHorizontal(blocks, 58, 12, 5);
  addHorizontal(blocks, 72, 16, 7);
  for (let c = 18; c <= 20; c++) addBlock(blocks, c, 15, C.BLOCK_BUSH);
  for (let c = 34; c <= 36; c++) addBlock(blocks, c, 15, C.BLOCK_ICE);
  addBlock(blocks, 23, 15, C.BLOCK_JUMP);
  addBlock(blocks, 50, 15, C.BLOCK_JUMP);
  addBlock(blocks, 30, 15, C.BLOCK_SPIKE);
  addBlock(blocks, 31, 15, C.BLOCK_SPIKE);
  return {
    name: 'フラット移動テスト',
    description: '平坦な地形で移動とフックの操作感を確認',
    infinite: false,
    spawnPoints: [{ x: 200, y: 500 }, { x: 900, y: 500 }, { x: 1800, y: 500 }],
    blocks
  };
}

function createPotMap() {
  return {
    name: '壺男風・無限登攀テスト',
    description: '決められた足場列をフックでつないで、無限に上へ進むコース',
    infinite: true,
    spawnPoints: [{ x: 320, y: 500 }, { x: 900, y: 500 }, { x: 1760, y: 500 }],
    blocks: []
  };
}

const MAPS = [createFlatMap(), createPotMap()];
let currentMapIndex = 0;

function potChunkIndexForY(y) {
  return Math.max(0, Math.floor((560 - y) / POT_CHUNK_HEIGHT));
}

function generatePotChunk(index) {
  const blocks = [];
  const topRow = 17 - index * POT_CHUNK_ROWS;
  // 左右の安全壁だけをチャンク単位で生成する。上方向には天井を置かない。
  for (let r = topRow; r >= topRow - POT_CHUNK_ROWS; r--) {
    addBlock(blocks, 0, r); addBlock(blocks, 1, r);
    addBlock(blocks, MAP_COLS - 2, r); addBlock(blocks, MAP_COLS - 1, r);
  }
  if (index === 0) addHorizontal(blocks, 0, 18, MAP_COLS);

  // 1チャンク内の足場順は固定。隣接足場は最大12マス差で、必ず次へ届く。
  const baseRoute = [6, 17, 28, 39, 50, 61];
  const route = index % 2 === 0 ? baseRoute : [...baseRoute].reverse();
  for (let i = 0; i < route.length; i++) {
    const c = route[i];
    const r = topRow - 1 - i * 2;
    addHorizontal(blocks, c, r, 6);
    if (i === 2 || i === 5) addBlock(blocks, c + 2, r - 1, C.BLOCK_JUMP);
  }
  // 前後チャンクの端は同じx座標になるよう交互に並べてあり、境界でも接続が切れない。
  return blocks;
}

function rebuildLoadedBlocks() {
  BLOCKS.length = 0;
  const indexes = [...loadedPotChunks.keys()].sort((a, b) => a - b);
  for (const index of indexes) BLOCKS.push(...loadedPotChunks.get(index));
}

function ensurePotChunks(players = {}) {
  if (!MAPS[currentMapIndex].infinite) return;
  const active = Object.values(players).filter(p => p.zone === 'battle');
  const positions = active.length ? active : [{ y: 500 }];
  const wanted = new Set();
  for (const player of positions) {
    const center = potChunkIndexForY(player.y);
    for (let offset = -POT_LOAD_RADIUS; offset <= POT_LOAD_RADIUS; offset++) {
      const index = center + offset;
      if (index >= 0) wanted.add(index);
    }
  }
  for (const index of wanted) {
    if (!loadedPotChunks.has(index)) loadedPotChunks.set(index, generatePotChunk(index));
  }
  for (const index of loadedPotChunks.keys()) {
    if (!wanted.has(index)) loadedPotChunks.delete(index);
  }
  rebuildLoadedBlocks();
}

function setMap(index) {
  const nextIndex = Number.isInteger(index) && MAPS[index] ? index : 0;
  currentMapIndex = nextIndex;
  loadedPotChunks.clear();
  BLOCKS.length = 0;
  if (MAPS[nextIndex].infinite) ensurePotChunks();
  else BLOCKS.push(...MAPS[nextIndex].blocks.map(block => ({ ...block })));
  return MAPS[nextIndex];
}

function getMapList() {
  return MAPS.map(({ name, description, infinite, spawnPoints }) => ({ name, description, infinite, spawnPoints }));
}

setMap(0);

function blockAt(cx, cy) {
  for (const b of BLOCKS) if (b.c === cx && b.r === cy) return b;
  return null;
}

function lineBlockIntersect(x1, y1, x2, y2) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2-x1), Math.abs(y2-y1)) / (BLOCK_SIZE/2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const b = blockAt(Math.floor(px/BLOCK_SIZE), Math.floor(py/BLOCK_SIZE));
    if (b && b.type === C.BLOCK_WALL) return { x: px, y: py, block: b };
  }
  return null;
}

function lineBlockIntersectSafe(x1, y1, x2, y2, player) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2-x1), Math.abs(y2-y1)) / (BLOCK_SIZE/2)));
  const playerC1 = Math.floor(player.x / BLOCK_SIZE);
  const playerC2 = Math.floor((player.x + player.width) / BLOCK_SIZE);
  const playerR1 = Math.floor(player.y / BLOCK_SIZE);
  const playerR2 = Math.floor((player.y + player.height) / BLOCK_SIZE);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const c = Math.floor(px/BLOCK_SIZE); const r = Math.floor(py/BLOCK_SIZE);
    if (c >= playerC1 && c <= playerC2 && r >= playerR1 && r <= playerR2) continue;
    const b = blockAt(c, r);
    if (b && b.type === C.BLOCK_WALL) return { x: px, y: py, block: b };
  }
  return null;
}

function rectBlocksIntersect(rx, ry, rw, rh) {
  const c1 = Math.floor(rx / BLOCK_SIZE); const c2 = Math.floor((rx + rw) / BLOCK_SIZE);
  const r1 = Math.floor(ry / BLOCK_SIZE); const r2 = Math.floor((ry + rh) / BLOCK_SIZE);
  for (let c = c1; c <= c2; c++) for (let r = r1; r <= r2; r++) {
    const b = blockAt(c, r);
    if (b && b.type === C.BLOCK_WALL) return true;
  }
  return false;
}

module.exports = {
  BLOCKS, BLOCK_SIZE, GAME_WIDTH, GAME_HEIGHT, MAP_COLS, MAP_ROWS,
  MAPS, getMapList, setMap, ensurePotChunks, potChunkIndexForY,
  get currentMap() { return MAPS[currentMapIndex]; },
  blockAt, lineBlockIntersect, lineBlockIntersectSafe, rectBlocksIntersect
};
