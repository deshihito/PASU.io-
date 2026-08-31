const C = require('../shared/constants');

const BLOCK_SIZE = C.BLOCK_SIZE;
const GAME_WIDTH = C.GAME_WIDTH;
const GAME_HEIGHT = C.GAME_HEIGHT;
const MAP_COLS = Math.ceil(GAME_WIDTH / BLOCK_SIZE);
const MAP_ROWS = Math.ceil(GAME_HEIGHT / BLOCK_SIZE);
const BLOCKS = [];

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
    addBlock(blocks, 0, r);
    addBlock(blocks, 1, r);
    addBlock(blocks, MAP_COLS - 2, r);
    addBlock(blocks, MAP_COLS - 1, r);
  }
}

function createFlatMap() {
  const blocks = [];
  addBoundary(blocks);
  // 移動とフックの距離感を試せる、低い障害物中心の平坦なコース。
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
    spawnPoints: [{ x: 200, y: 500 }, { x: 900, y: 500 }, { x: 1800, y: 500 }],
    blocks
  };
}

function createPotMap() {
  const blocks = [];
  addBoundary(blocks);
  // 壺男風：床から上へ、左右の小さな足場を交互に登るコース。
  const ledges = [
    [8, 16, 8], [22, 14, 5], [14, 12, 5], [30, 10, 6],
    [44, 8, 5], [35, 6, 5], [52, 4, 6], [66, 7, 5], [76, 3, 6]
  ];
  for (const [c, r, width] of ledges) addHorizontal(blocks, c, r, width);
  addHorizontal(blocks, 18, 17, 3, C.BLOCK_ICE);
  addHorizontal(blocks, 58, 10, 3, C.BLOCK_BUSH);
  addBlock(blocks, 25, 13, C.BLOCK_JUMP);
  addBlock(blocks, 47, 7, C.BLOCK_JUMP);
  addBlock(blocks, 61, 6, C.BLOCK_SPIKE);
  addBlock(blocks, 62, 6, C.BLOCK_SPIKE);
  return {
    name: '壺男風・登攀テスト',
    description: '足場をフックでつないで上へ登る高低差コース',
    spawnPoints: [{ x: 320, y: 500 }, { x: 900, y: 500 }, { x: 1760, y: 500 }],
    blocks
  };
}

const MAPS = [createFlatMap(), createPotMap()];
let currentMapIndex = 0;

function setMap(index) {
  const nextIndex = Number.isInteger(index) && MAPS[index] ? index : 0;
  currentMapIndex = nextIndex;
  BLOCKS.length = 0;
  for (const block of MAPS[nextIndex].blocks) BLOCKS.push({ ...block });
  return MAPS[nextIndex];
}

function getMapList() {
  return MAPS.map(({ name, description, spawnPoints }) => ({ name, description, spawnPoints }));
}

setMap(0);

function blockAt(cx, cy) {
  for (const b of BLOCKS) {
    if (b.c === cx && b.r === cy) return b;
  }
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
    const c = Math.floor(px/BLOCK_SIZE);
    const r = Math.floor(py/BLOCK_SIZE);
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
  MAPS,
  getMapList,
  setMap,
  get currentMap() { return MAPS[currentMapIndex]; },
  blockAt,
  lineBlockIntersect,
  lineBlockIntersectSafe,
  rectBlocksIntersect
};

if (require.main === module) {
  console.log(MAPS.map(map => `${map.name}: ${map.blocks.length} blocks`).join('\n'));
}
