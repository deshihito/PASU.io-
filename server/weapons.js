const C = require('../shared/constants');

// ===== 武器データ =====
const WEAPONS = {
  [C.WEAPON_SPAGHETTI_GUN]: {
    name: 'スパゲティガン',
    description: '連射性能重視の基本武器',
    damage: 12,
    speed: 15,
    cooldown: 8,
    spread: 0.05,
    pierce: false,
    bounce: false,
    chargeable: false,
    icon: '🍝'
  },
  [C.WEAPON_MACARONI_LAUNCHER]: {
    name: 'マカロニランチャー',
    description: '貫通するマカロニを発射',
    damage: 18,
    speed: 12,
    cooldown: 20,
    spread: 0.02,
    pierce: true,
    bounce: false,
    chargeable: false,
    icon: '🥯'
  },
  [C.WEAPON_PENNE_SHOTGUN]: {
    name: 'ペンネショットガン',
    description: '近距離で強力な散弾',
    damage: 8,
    speed: 14,
    cooldown: 25,
    spread: 0.15,
    pierce: false,
    bounce: false,
    chargeable: false,
    pellets: 5,
    icon: '🔫'
  },
  [C.WEAPON_RAVIOLI_GRENADE]: {
    name: 'ラビオリグレネード',
    description: '着弾で爆発するラビオリ',
    damage: 30,
    speed: 10,
    cooldown: 45,
    spread: 0.03,
    pierce: false,
    bounce: true,
    chargeable: false,
    explodeRadius: 60,
    icon: '💣'
  },
  [C.WEAPON_FETTUCCINE_WHIP]: {
    name: 'フェットチーネ鞭',
    description: '近距離広範囲を攻撃',
    damage: 25,
    speed: 20,
    cooldown: 18,
    spread: 0.3,
    pierce: true,
    bounce: false,
    chargeable: false,
    range: 80,
    icon: '〰️'
  }
};

// ===== サブウェポン =====
const SUB_WEAPONS = {
  [C.SUB_OLIVE_HEAL]: {
    name: 'オリーブ回復',
    description: 'HPを30回復',
    heal: 30,
    cooldown: 300,
    duration: 0,
    icon: '🫒'
  },
  [C.SUB_CHEESE_SMOKE]: {
    name: 'チーズスモーク',
    description: '視界を妨害する煙',
    damage: 0,
    cooldown: 360,
    duration: 180,
    radius: 100,
    icon: '🧀'
  },
  [C.SUB_PEPERONCINO_BOOST]: {
    name: 'ペペロンチーノ加速',
    description: '移動速度が3秒間上昇',
    damage: 0,
    cooldown: 240,
    duration: 180,
    speedMult: 1.5,
    icon: '🌶️'
  }
};

// ===== 武器生成 =====
function createWeapon(weaponId) {
  const base = WEAPONS[weaponId];
  if (!base) return null;
  return {
    id: weaponId,
    ...base,
    ammo: Infinity,
    lastFired: 0
  };
}

function createSubWeapon(subId) {
  const base = SUB_WEAPONS[subId];
  if (!base) return null;
  return {
    id: subId,
    ...base,
    lastUsed: 0
  };
}

// ===== 射撃処理 =====
function fireWeapon(player, weapon, angle, bullets, timestamp) {
  if (timestamp - weapon.lastFired < weapon.cooldown) return false;
  weapon.lastFired = timestamp;
  
  const spread = (Math.random() - 0.5) * weapon.spread * 2;
  const finalAngle = angle + spread;
  
  if (weapon.pellets) {
    // ショットガン：複数弾
    for (let i = 0; i < weapon.pellets; i++) {
      const pelletSpread = (Math.random() - 0.5) * 0.3;
      bullets.push({
        x: player.x + player.width/2,
        y: player.y + player.height/2,
        vx: Math.cos(finalAngle + pelletSpread) * weapon.speed,
        vy: Math.sin(finalAngle + pelletSpread) * weapon.speed,
        owner: player.id,
        life: C.BULLET_LIFE,
        damage: weapon.damage,
        color: player.color,
        pierce: weapon.pierce,
        bounce: weapon.bounce,
        explodeRadius: weapon.explodeRadius || 0
      });
    }
  } else {
    bullets.push({
      x: player.x + player.width/2,
      y: player.y + player.height/2,
      vx: Math.cos(finalAngle) * weapon.speed,
      vy: Math.sin(finalAngle) * weapon.speed,
      owner: player.id,
      life: C.BULLET_LIFE,
      damage: weapon.damage,
      color: player.color,
      pierce: weapon.pierce,
      bounce: weapon.bounce,
      explodeRadius: weapon.explodeRadius || 0
    });
  }
  
  return true;
}

function useSubWeapon(player, subWeapon, timestamp) {
  if (timestamp - subWeapon.lastUsed < subWeapon.cooldown) return false;
  subWeapon.lastUsed = timestamp;
  
  if (subWeapon.heal) {
    player.hp = Math.min(player.maxHp, player.hp + subWeapon.heal);
  }
  if (subWeapon.speedMult) {
    player.speedBoost = subWeapon.duration;
    player.speedMult = subWeapon.speedMult;
  }
  
  return true;
}

module.exports = {
  WEAPONS,
  SUB_WEAPONS,
  createWeapon,
  createSubWeapon,
  fireWeapon,
  useSubWeapon
};
