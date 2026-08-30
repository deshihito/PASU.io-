const weapons = require('./weapons');

// ===== ショップ商品 =====
const SHOP_ITEMS = [
  {
    id: 'weapon_spaghetti',
    name: 'スパゲティガン',
    description: '連射性能重視の基本武器',
    price: 0,
    type: 'weapon',
    weaponId: 'spaghetti_gun',
    icon: '🍝'
  },
  {
    id: 'weapon_macaroni',
    name: 'マカロニランチャー',
    description: '貫通するマカロニを発射',
    price: 100,
    type: 'weapon',
    weaponId: 'macaroni_launcher',
    icon: '🥯'
  },
  {
    id: 'weapon_penny',
    name: 'ペンネショットガン',
    description: '近距離で強力な散弾',
    price: 150,
    type: 'weapon',
    weaponId: 'penne_shotgun',
    icon: '🔫'
  },
  {
    id: 'weapon_ravioli',
    name: 'ラビオリグレネード',
    description: '着弾で爆発するラビオリ',
    price: 200,
    type: 'weapon',
    weaponId: 'ravioli_grenade',
    icon: '💣'
  },
  {
    id: 'weapon_fettuccine',
    name: 'フェットチーネ鞭',
    description: '近距離広範囲を攻撃',
    price: 180,
    type: 'weapon',
    weaponId: 'fettuccine_whip',
    icon: '〰️'
  },
  {
    id: 'sub_olive',
    name: 'オリーブ回復',
    description: 'HPを30回復',
    price: 50,
    type: 'sub',
    subId: 'olive_heal',
    icon: '🫒'
  },
  {
    id: 'sub_cheese',
    name: 'チーズスモーク',
    description: '視界を妨害する煙',
    price: 80,
    type: 'sub',
    subId: 'cheese_smoke',
    icon: '🧀'
  },
  {
    id: 'sub_peperoncino',
    name: 'ペペロンチーノ加速',
    description: '移動速度が3秒間上昇',
    price: 60,
    type: 'sub',
    subId: 'peperoncino_boost',
    icon: '🌶️'
  },
  {
    id: 'skin_red',
    name: 'トマトソース',
    description: '赤いパスタに変更',
    price: 300,
    type: 'skin',
    skinColor: '#e94560',
    icon: '🔴'
  },
  {
    id: 'skin_green',
    name: 'ジェノベーゼ',
    description: '緑のパスタに変更',
    price: 300,
    type: 'skin',
    skinColor: '#34c759',
    icon: '🟢'
  },
  {
    id: 'skin_gold',
    name: 'カルボナーラ',
    description: '金色のパスタに変更',
    price: 500,
    type: 'skin',
    skinColor: '#ffd60a',
    icon: '🟡'
  }
];

// ===== 購入処理 =====
function buyItem(player, itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return { success: false, message: '商品が見つかりません' };
  if (player.coins < item.price) return { success: false, message: 'コインが足りません' };
  
  player.coins -= item.price;
  
  if (item.type === 'weapon') {
    // 空きスロットに武器を装備
    const emptySlot = player.slots.findIndex(s => s === null);
    if (emptySlot === -1) return { success: false, message: 'スロットがいっぱいです' };
    player.slots[emptySlot] = weapons.createWeapon(item.weaponId);
    return { success: true, message: `${item.name}を購入しました！` };
  }
  
  if (item.type === 'sub') {
    player.subWeapon = weapons.createSubWeapon(item.subId);
    return { success: true, message: `${item.name}を購入しました！` };
  }
  
  if (item.type === 'skin') {
    player.skinColor = item.skinColor;
    return { success: true, message: `${item.name}を購入しました！` };
  }
  
  return { success: false, message: '購入に失敗しました' };
}

// ===== コイン獲得 =====
function addCoins(player, amount) {
  player.coins += amount;
}

function onKill(player) {
  addCoins(player, 50);
}

function onWin(player) {
  addCoins(player, 200);
}

function onAssist(player) {
  addCoins(player, 25);
}

module.exports = {
  SHOP_ITEMS,
  buyItem,
  addCoins,
  onKill,
  onWin,
  onAssist
};
