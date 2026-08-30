const C = require('../shared/constants');
const maps = require('./maps');

const GRAVITY = C.GRAVITY;
const BLOCK_SIZE = C.BLOCK_SIZE;
const GAME_WIDTH = C.GAME_WIDTH;
const GAME_HEIGHT = C.GAME_HEIGHT;
const HOOK_SPEED = C.HOOK_SPEED;
const HOOK_MAX_LEN = C.HOOK_MAX_LEN;
const HAND_SPEED = C.HAND_SPEED;
const HAND_MAX_LEN = C.HAND_MAX_LEN;
const BULLET_SPEED = C.BULLET_SPEED;
const BULLET_LIFE = C.BULLET_LIFE;
const RETURN_TIME = C.RETURN_TIME;

// 前フレームの位置を保持（接地判定用）
const prevPositions = new Map();

function resolveBlockCollision(p) {
  // 高速移動時の貫通防止：複数回小刻みに移動してチェック
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) / (BLOCK_SIZE * 0.5)));
  const stepVx = (p.vx + (p.windX || 0)) / steps;
  const stepVy = (p.vy + (p.windY || 0)) / steps;
  
  let prevX = p.x;
  let prevY = p.y;
  
  for (let step = 0; step < steps; step++) {
    p.x += stepVx;
    p.y += stepVy;
    
    const c1 = Math.floor(p.x / BLOCK_SIZE);
    const c2 = Math.floor((p.x + p.width) / BLOCK_SIZE);
    const r1 = Math.floor(p.y / BLOCK_SIZE);
    const r2 = Math.floor((p.y + p.height) / BLOCK_SIZE);
    
    if (step === 0) {
      p.onGround = false;
      p.inBush = false;
      p.onIce = false;
      p.windX = 0;
      p.windY = 0;
      p.inDarkness = false;
      p.onHeal = false;
    }
    
    for (let c = c1; c <= c2; c++) {
      for (let r = r1; r <= r2; r++) {
        const b = maps.blockAt(c, r);
        if (!b) continue;
        
        if (b.type === C.BLOCK_BUSH) {
          p.inBush = true;
          continue;
        }
        if (b.type === C.BLOCK_ICE) {
          p.onIce = true;
          continue;
        }
        if (b.type === C.BLOCK_JUMP && p.vy > 0) {
          p.vy = -18;
          continue;
        }
        if (b.type === C.BLOCK_SPIKE) {
          if (p.invincible <= 0) {
            p.hp -= 1;
            p.invincible = 10;
          }
          continue;
        }
        if (b.type === C.BLOCK_WIND_RIGHT) { p.windX = 0.8; continue; }
        if (b.type === C.BLOCK_WIND_LEFT) { p.windX = -0.8; continue; }
        if (b.type === C.BLOCK_WIND_UP) { p.windY = -0.5; continue; }
        if (b.type === C.BLOCK_DARKNESS) { p.inDarkness = true; continue; }
        if (b.type === C.BLOCK_HEAL) {
          p.onHeal = true;
          if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 0.2);
          continue;
        }
        if (b.type === C.BLOCK_COLLAPSE) {
          // 崩落ブロック：乗るとタイマー開始
          if (!b.collapseTimer) b.collapseTimer = 120; // 2秒
          continue;
        }
        if (b.type !== C.BLOCK_WALL) continue;
        
        const bx = b.c * BLOCK_SIZE;
        const by = b.r * BLOCK_SIZE;
        
        const overlapLeft = (p.x + p.width) - bx;
        const overlapRight = (bx + BLOCK_SIZE) - p.x;
        const overlapTop = (p.y + p.height) - by;
        const overlapBottom = (by + BLOCK_SIZE) - p.y;
        
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        
        // 接地判定の誤検知修正：前フレームで地面より上にいて、現在地面にめり込んでいる場合のみ
        const wasAbove = prevY + p.height <= by;
        
        if (minOverlap === overlapTop && p.vy >= 0 && wasAbove) {
          p.y = by - p.height;
          p.vy = 0;
          p.onGround = true;
        } else if (minOverlap === overlapBottom && p.vy < 0) {
          p.y = by + BLOCK_SIZE;
          p.vy = 0;
        } else if (minOverlap === overlapLeft && p.vx > 0) {
          p.x = bx - p.width;
          p.vx = 0;
        } else if (minOverlap === overlapRight && p.vx < 0) {
          p.x = bx + BLOCK_SIZE;
          p.vx = 0;
        }
      }
    }
    
    prevX = p.x;
    prevY = p.y;
  }
  
  prevPositions.set(p.id, { x: p.x, y: p.y });
}

function updateHook(p) {
  if (!p.hook.active) return;
  const sx = p.x + p.width/2;
  const sy = p.y + p.height/2;
  
  if (!p.hook.attached) {
    p.hook.len += HOOK_SPEED;
    const rad = p.hook.angle * Math.PI / 180;
    p.hook.x = sx + Math.cos(rad) * p.hook.len;
    p.hook.y = sy + Math.sin(rad) * p.hook.len;
    
    if (p.hook.len > HOOK_MAX_LEN) { p.hook.active = false; return; }
    
    // フック貫通防止：プレイヤーの当たり判定内のブロックは無視
    const hit = maps.lineBlockIntersectSafe(sx, sy, p.hook.x, p.hook.y, p);
    if (hit) {
      p.hook.attached = true;
      p.hook.x = hit.x;
      p.hook.y = hit.y;
    }
    
    if (p.hook.x < 0 || p.hook.x > GAME_WIDTH || p.hook.y < 0 || p.hook.y > GAME_HEIGHT) {
      p.hook.active = false;
    }
  } else {
    const dx = p.hook.x - sx;
    const dy = p.hook.y - sy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 15) {
      p.vx += dx * 0.025;
      p.vy += dy * 0.025;
      p.state = 'hooked';
    } else {
      p.hook.active = false;
      p.state = 'normal';
    }
  }
}

function updateHand(p, levers, doors, movables) {
  if (!p.hand.active) return;
  const sx = p.x + p.width/2;
  const sy = p.y + p.height/2;
  
  if (!p.hand.attached) {
    p.hand.len += HAND_SPEED;
    const rad = p.hand.angle * Math.PI / 180;
    p.hand.x = sx + Math.cos(rad) * p.hand.len;
    p.hand.y = sy + Math.sin(rad) * p.hand.len;
    
    if (p.hand.len > HAND_MAX_LEN) { p.hand.active = false; p.state = 'normal'; return; }
    
    // レバー
    for (const lever of levers) {
      if (p.hand.x >= lever.x && p.hand.x <= lever.x + lever.w &&
          p.hand.y >= lever.y && p.hand.y <= lever.y + lever.h) {
        p.hand.attached = true;
        p.hand.x = lever.x + lever.w/2;
        p.hand.y = lever.y + lever.h/2;
        p.hand.targetType = 'lever';
        p.hand.targetId = lever.id;
        p.state = 'hand_mode';
        return;
      }
    }
    
    // 動かせる物体
    for (const mv of movables) {
      if (mv.heldBy && mv.heldBy !== p.id) continue;
      if (p.hand.x >= mv.x && p.hand.x <= mv.x + mv.w &&
          p.hand.y >= mv.y && p.hand.y <= mv.y + mv.h) {
        p.hand.attached = true;
        p.hand.x = mv.x + mv.w/2;
        p.hand.y = mv.y + mv.h/2;
        p.hand.targetType = 'movable';
        p.hand.targetId = mv.id;
        mv.heldBy = p.id;
        p.state = 'hand_mode';
        return;
      }
    }
    
    // 壁
    const hit = maps.lineBlockIntersectSafe(sx, sy, p.hand.x, p.hand.y, p);
    if (hit) {
      p.hand.attached = true;
      p.hand.x = hit.x;
      p.hand.y = hit.y;
      p.hand.targetType = 'wall';
      p.state = 'hand_mode';
      return;
    }
    
    if (p.hand.x < 0 || p.hand.x > GAME_WIDTH || p.hand.y < 0 || p.hand.y > GAME_HEIGHT) {
      p.hand.active = false; p.state = 'normal';
    }
  } else {
    if (p.hand.targetType === 'lever') {
      const lever = levers.find(l => l.id === p.hand.targetId);
      if (lever) {
        const dx = lever.x + lever.w/2 - sx;
        const dy = lever.y + lever.h/2 - sy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 60) {
          lever.pulled = !lever.pulled;
          const door = doors.find(d => d.id === lever.targetDoor);
          if (door) door.open = lever.pulled;
          p.hand.active = false;
          p.state = 'normal';
        } else {
          p.vx += dx * 0.01;
          p.vy += dy * 0.01;
        }
      }
    } else if (p.hand.targetType === 'movable') {
      const mv = movables.find(m => m.id === p.hand.targetId);
      if (mv) {
        const targetX = sx + Math.cos(p.hand.moveAngle * Math.PI / 180) * 50;
        const targetY = sy + Math.sin(p.hand.moveAngle * Math.PI / 180) * 50;
        mv.x += (targetX - mv.x - mv.w/2) * 0.15;
        mv.y += (targetY - mv.y - mv.h/2) * 0.15;
        mv.vx = p.vx * 0.5;
        mv.vy = p.vy * 0.5;
        p.hand.x = mv.x + mv.w/2;
        p.hand.y = mv.y + mv.h/2;
      }
    } else if (p.hand.targetType === 'wall') {
      const dx = p.hand.x - sx;
      const dy = p.hand.y - sy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 10) { p.hand.active = false; p.state = 'normal'; }
    }
  }
}

function updateMovables(movables, players) {
  for (const mv of movables) {
    if (mv.heldBy) {
      const holder = players[mv.heldBy];
      if (!holder || !holder.hand.active || holder.hand.targetId !== mv.id) mv.heldBy = null;
    }
    if (!mv.heldBy) {
      mv.vy += GRAVITY;
      mv.x += mv.vx;
      mv.y += mv.vy;
      
      const c1 = Math.floor(mv.x / BLOCK_SIZE);
      const c2 = Math.floor((mv.x + mv.w) / BLOCK_SIZE);
      const r1 = Math.floor(mv.y / BLOCK_SIZE);
      const r2 = Math.floor((mv.y + mv.h) / BLOCK_SIZE);
      
      for (let c = c1; c <= c2; c++) {
        for (let r = r1; r <= r2; r++) {
          const b = maps.blockAt(c, r);
          if (b && b.type === C.BLOCK_WALL) {
            const by = b.r * BLOCK_SIZE;
            if (mv.vy > 0 && mv.y + mv.h > by && mv.y + mv.h - mv.vy <= by) {
              mv.y = by - mv.h; mv.vy = 0;
            }
          }
        }
      }
      mv.vx *= 0.9;
      if (Math.abs(mv.vx) < 0.1) mv.vx = 0;
    }
  }
}

function updateDoors(doors) {
  for (const d of doors) {
    if (d.open && d.openHeight < d.h) d.openHeight += 2;
    if (!d.open && d.openHeight > 0) d.openHeight -= 2;
  }
}

function updateBullets(bullets, players, blocks) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    
    // ミサイルの誘導
    if (b.missile && b.target) {
      const target = players[b.target];
      if (target && target.zone === 'battle') {
        const tx = target.x + target.width/2;
        const ty = target.y + target.height/2;
        const angle = Math.atan2(ty - b.y, tx - b.x);
        let currentAngle = Math.atan2(b.vy, b.vx);
        let diff = angle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.max(-C.MISSILE_TURN, Math.min(C.MISSILE_TURN, diff));
        currentAngle += turn;
        const speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
        b.vx = Math.cos(currentAngle) * speed;
        b.vy = Math.sin(currentAngle) * speed;
      }
    }
    
    b.x += b.vx; b.y += b.vy; b.life--;
    
    const hit = maps.lineBlockIntersect(b.x - b.vx, b.y - b.vy, b.x, b.y);
    if (hit) {
      if (b.bounce) {
        // バウンド弾：反射
        const bx = hit.block.c * BLOCK_SIZE;
        const by = hit.block.r * BLOCK_SIZE;
        const cx = b.x - b.vx;
        const cy = b.y - b.vy;
        // どの面に当たったか判定
        const prevC = Math.floor(cx / BLOCK_SIZE);
        const prevR = Math.floor(cy / BLOCK_SIZE);
        const currC = Math.floor(b.x / BLOCK_SIZE);
        const currR = Math.floor(b.y / BLOCK_SIZE);
        if (prevC !== currC) b.vx *= -1;
        if (prevR !== currR) b.vy *= -1;
        b.bounceCount = (b.bounceCount || 0) + 1;
        if (b.bounceCount > 3) { bullets.splice(i, 1); continue; }
      } else {
        // 爆発処理
        if (b.explodeRadius > 0) {
          for (const id in players) {
            const p = players[id];
            if (p.id === b.owner || p.zone !== 'battle') continue;
            const dx = (p.x + p.width/2) - b.x;
            const dy = (p.y + p.height/2) - b.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < b.explodeRadius) {
              const dmg = Math.floor(b.damage * (1 - dist / b.explodeRadius));
              p.hp -= dmg;
              p.vx += dx / dist * 3;
              p.vy += dy / dist * 3;
            }
          }
        }
        bullets.splice(i, 1);
        continue;
      }
    }
    
    for (const id in players) {
      const p = players[id];
      if (p.id === b.owner || p.zone !== 'battle') continue;
      const dx = (p.x + p.width/2) - b.x;
      const dy = (p.y + p.height/2) - b.y;
      if (Math.sqrt(dx*dx + dy*dy) < 30) {
        p.hp -= b.damage;
        // 被弾ノックバック強化
        p.vx += b.vx * 0.8;
        p.vy += b.vy * 0.8;
        if (!b.pierce) {
          bullets.splice(i, 1);
          break;
        }
      }
    }
    
    if (b.life <= 0 || b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT) {
      bullets.splice(i, 1);
    }
  }
}

function updateTraps(traps, players) {
  for (let i = traps.length - 1; i >= 0; i--) {
    const t = traps[i];
    t.life--;
    if (t.life <= 0) { traps.splice(i, 1); continue; }
    
    for (const id in players) {
      const p = players[id];
      if (p.id === t.owner || p.zone !== 'battle') continue;
      const dx = (p.x + p.width/2) - t.x;
      const dy = (p.y + p.height/2) - t.y;
      if (Math.sqrt(dx*dx + dy*dy) < t.radius) {
        p.hp -= t.damage;
        p.vx += (Math.random() - 0.5) * 4;
        p.vy -= 3;
        traps.splice(i, 1);
        break;
      }
    }
  }
}

function updateCollapseBlocks(blocks) {
  for (const b of blocks) {
    if (b.type === C.BLOCK_COLLAPSE && b.collapseTimer !== undefined) {
      b.collapseTimer--;
      if (b.collapseTimer <= 0) {
        b.type = C.BLOCK_EMPTY;
        b.respawnTimer = 300; // 5秒後に復活
      }
    }
    if (b.type === C.BLOCK_EMPTY && b.respawnTimer !== undefined) {
      b.respawnTimer--;
      if (b.respawnTimer <= 0) {
        b.type = C.BLOCK_COLLAPSE;
        delete b.collapseTimer;
        delete b.respawnTimer;
      }
    }
  }
}

function checkWarpPads(p, warpPads, maps) {
  if (p.zone !== 'battle') return;
  for (const wp of warpPads) {
    if (p.x + p.width > wp.x && p.x < wp.x + wp.w &&
        p.y + p.height > wp.y && p.y < wp.y + wp.h) {
      const sp = maps[0].spawnPoints[Math.floor(Math.random() * maps[0].spawnPoints.length)];
      p.x = sp.x + (Math.random() - 0.5) * 100;
      p.y = sp.y;
      p.vx = 0; p.vy = 0;
      break;
    }
  }
}

function checkDeath(p, maps) {
  if (p.y > GAME_HEIGHT + 200 || p.hp <= 0) {
    p.hp = p.maxHp; p.vx = 0; p.vy = 0;
    p.hook.active = false; p.hand.active = false; p.state = 'normal';
    if (p.zone === 'battle') {
      const sp = maps[0].spawnPoints[Math.floor(Math.random() * maps[0].spawnPoints.length)];
      p.x = sp.x; p.y = sp.y;
    }
  }
}

module.exports = {
  resolveBlockCollision,
  updateHook,
  updateHand,
  updateMovables,
  updateDoors,
  updateBullets,
  updateTraps,
  updateCollapseBlocks,
  checkWarpPads,
  checkDeath
};
