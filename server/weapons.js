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
    whip: true,
    icon: '〰️'
  },
  [C.WEAPON_MISSILE]: {
    name: 'ミサイル',
    description: 'マウス追従する誘導弾',
    damage: 35,
    speed: 8,
    cooldown: 60,
    spread: 0,
    pierce: false,
    bounce: false,
    chargeable: false,
    missile: true,
    icon: '🚀'
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
  },
  [C.SUB_SHIELD]: {
    name: 'パルメザンシールド',
    description: '2秒間無敵バリア',
    cooldown: 400,
    duration: 120,
    icon: '🛡️'
  },
  [C.SUB_TRAP]: {
    name: '粘着パスタ',
    description: '敵を足止めするトラップ',
    cooldown: 300,
    damage: 20,
    radius: 30,
    duration: 600,
    icon: '🕸️'
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
function fireWeapon(player, weapon, angle, bullets, timestamp, chargeLevel = 0) {
  if (timestamp - weapon.lastFired < weapon.cooldown) return false;
  weapon.lastFired = timestamp;
  
  const chargeMult = 1 + (chargeLevel / C.CHARGE_MAX) * 0.5; // 最大1.5倍
  const spread = (Math.random() - 0.5) * weapon.spread * 2;
  const finalAngle = angle + spread;
  
  // 鞭の近距離判定
  if (weapon.whip) {
    for (const id in bullets.players) {
      const p = bullets.players[id];
      if (p.id === player.id || p.zone !== 'battle') continue;
      const dx = (p.x + p.width/2) - (player.x + player.width/2);
      const dy = (p.y + p.height/2) - (player.y + player.height/2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < weapon.range) {
        const dir = Math.abs(Math.atan2(dy, dx) - angle);
        const normDir = Math.min(dir, Math.PI * 2 - dir);
        if (normDir < 0.5) {
          p.hp -= weapon.damage * chargeMult;
          p.vx += Math.cos(angle) * 3;
          p.vy += Math.sin(angle) * 3;
        }
      }
    }
    return true;
  }
  
  // ミサイル
  if (weapon.missile) {
    // 最も近い敵をターゲット
    let closest = null;
    let closestDist = Infinity;
    for (const id in bullets.players) {
      const p = bullets.players[id];
      if (p.id === player.id || p.zone !== 'battle') continue;
      const dx = (p.x + p.width/2) - (player.x + player.width/2);
      const dy = (p.y + p.height/2) - (player.y + player.height/2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < closestDist && dist < 800) {
        closestDist = dist;
        closest = p.id;
      }
    }
    
    bullets.bullets.push({
      x: player.x + player.width/2,
      y: player.y + player.height/2,
      vx: Math.cos(finalAngle) * weapon.speed,
      vy: Math.sin(finalAngle) * weapon.speed,
      owner: player.id,
      life: C.BULLET_LIFE,
      damage: weapon.damage * chargeMult,
      color: player.color,
      pierce: weapon.pierce,
      bounce: weapon.bounce,
      explodeRadius: weapon.explodeRadius || 0,
      missile: true,
      target: closest
    });
    return true;
  }
  
  if (weapon.pellets) {
    for (let i = 0; i < weapon.pellets; i++) {
      const pelletSpread = (Math.random() - 0.5) * 0.3;
      bullets.bullets.push({
        x: player.x + player.width/2,
        y: player.y + player.height/2,
        vx: Math.cos(finalAngle + pelletSpread) * weapon.speed,
        vy: Math.sin(finalAngle + pelletSpread) * weapon.speed,
        owner: player.id,
        life: C.BULLET_LIFE,
        damage: weapon.damage * chargeMult,
        color: player.color,
        pierce: weapon.pierce,
        bounce: weapon.bounce,
        explodeRadius: weapon.explodeRadius || 0
      });
    }
  } else {
    bullets.bullets.push({
      x: player.x + player.width/2,
      y: player.y + player.height/2,
      vx: Math.cos(finalAngle) * weapon.speed,
      vy: Math.sin(finalAngle) * weapon.speed,
      owner: player.id,
      life: C.BULLET_LIFE,
      damage: weapon.damage * chargeMult,
      color: player.color,
      pierce: weapon.pierce,
      bounce: weapon.bounce,
      explodeRadius: weapon.explodeRadius || 0
    });
  }
  
  return true;
}

function useSubWeapon(player, subWeapon, timestamp, traps, smokeScreens) {
  if (timestamp - subWeapon.lastUsed < subWeapon.cooldown) return false;
  subWeapon.lastUsed = timestamp;
  
  if (subWeapon.heal) {
    player.hp = Math.min(player.maxHp, player.hp + subWeapon.heal);
  }
  if (subWeapon.speedMult) {
    player.speedBoost = subWeapon.duration;
    player.speedMult = subWeapon.speedMult;
  }
  if (subWeapon.duration && subWeapon.id === C.SUB_SHIELD) {
    player.invincible = subWeapon.duration;
  }
  if (subWeapon.damage && subWeapon.id === C.SUB_TRAP) {
    traps.push({
      x: player.x + player.width/2,
      y: player.y + player.height,
      radius: subWeapon.radius,
      damage: subWeapon.damage,
      life: subWeapon.duration,
      owner: player.id
    });
  }
  if (subWeapon.duration && subWeapon.id === C.SUB_CHEESE_SMOKE) {
    smokeScreens.push({
      x: player.x + player.width/2,
      y: player.y + player.height/2,
      radius: subWeapon.radius,
      life: subWeapon.duration,
      owner: player.id
    });
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
