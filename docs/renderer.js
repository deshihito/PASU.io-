// ===== PASU.io 描画エンジン =====

const C = CONSTANTS;

const Renderer = {
  ctx: null,
  canvas: null,
  cameraX: 0,
  cameraY: 0,
  blockSize: 40,
  hookTrails: {}, // フック軌跡
  comboTexts: [], // コンボ表示
  
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  },
  
  clear() {
    this.ctx.fillStyle = '#f5f5f7';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  },
  
  drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    const offX = -this.cameraX % 40;
    const offY = -this.cameraY % 40;
    for (let x = offX; x < this.canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
    }
    for (let y = offY; y < this.canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
    }
  },
  
  drawBlocks(blocks) {
    const ctx = this.ctx;
    for (const b of blocks) {
      const x = b.c * this.blockSize - this.cameraX;
      const y = b.r * this.blockSize - this.cameraY;
      
      if (x + this.blockSize < 0 || x > this.canvas.width || 
          y + this.blockSize < 0 || y > this.canvas.height) continue;
      
      switch (b.type) {
        case 1: // 壁
          ctx.fillStyle = '#e5e5ea';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.strokeStyle = '#c7c7cc';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#d1d1d6';
          ctx.fillRect(x + 4, y + 4, this.blockSize - 8, 3);
          ctx.fillRect(x + 4, y + this.blockSize/2, this.blockSize - 8, 3);
          break;
        case 2: // 氷
          ctx.fillStyle = '#a5f3fc';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#cffafe';
          ctx.fillRect(x + 2, y + 2, this.blockSize - 4, this.blockSize - 4);
          break;
        case 3: // ジャンプ台
          ctx.fillStyle = '#fde047';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#ca8a04';
          ctx.beginPath();
          ctx.moveTo(x + this.blockSize/2, y + 5);
          ctx.lineTo(x + 5, y + this.blockSize - 5);
          ctx.lineTo(x + this.blockSize - 5, y + this.blockSize - 5);
          ctx.fill();
          break;
        case 4: // ブッシュ
          ctx.fillStyle = '#34c759';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#30d158';
          ctx.beginPath();
          ctx.arc(x + this.blockSize/2, y + this.blockSize/2, this.blockSize/2 - 2, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = '#248a3d';
          ctx.beginPath();
          ctx.arc(x + this.blockSize/3, y + this.blockSize/3, 4, 0, Math.PI*2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + this.blockSize*0.7, y + this.blockSize*0.6, 3, 0, Math.PI*2);
          ctx.fill();
          break;
        case 5: // トゲ
          ctx.fillStyle = '#e5e5ea';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.moveTo(x + this.blockSize/2, y + 3);
          ctx.lineTo(x + this.blockSize - 3, y + this.blockSize - 3);
          ctx.lineTo(x + 3, y + this.blockSize - 3);
          ctx.fill();
          break;
        case 6: // 風（右）
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#0ea5e9';
          ctx.font = '16px sans-serif';
          ctx.fillText('→', x + 10, y + 28);
          break;
        case 7: // 風（左）
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#0ea5e9';
          ctx.font = '16px sans-serif';
          ctx.fillText('←', x + 10, y + 28);
          break;
        case 8: // 風（上）
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#0ea5e9';
          ctx.font = '16px sans-serif';
          ctx.fillText('↑', x + 10, y + 28);
          break;
        case 9: // 暗闇
          ctx.fillStyle = '#1c1917';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#44403c';
          ctx.fillRect(x + 4, y + 4, this.blockSize - 8, this.blockSize - 8);
          break;
        case 10: // 崩落
          ctx.fillStyle = '#a8a29e';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.strokeStyle = '#78716c';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, this.blockSize, this.blockSize);
          // 崩落タイマー表示
          if (b.collapseTimer !== undefined) {
            const ratio = b.collapseTimer / 120;
            ctx.fillStyle = `rgba(220, 38, 38, ${1 - ratio})`;
            ctx.fillRect(x + 2, y + 2, (this.blockSize - 4) * ratio, 4);
          }
          break;
        case 11: // 回復
          ctx.fillStyle = '#dcfce7';
          ctx.fillRect(x, y, this.blockSize, this.blockSize);
          ctx.fillStyle = '#22c55e';
          ctx.font = '16px sans-serif';
          ctx.fillText('+', x + 12, y + 28);
          break;
      }
    }
  },
  
  drawPastaTank(p, isMe, myId) {
    const ctx = this.ctx;
    const x = p.x - this.cameraX;
    const y = p.y - this.cameraY;
    const w = p.width;
    const h = p.height;
    
    if (p.inBush && !isMe) return;
    
    const alpha = p.inBush ? 0.4 : 1;
    ctx.globalAlpha = alpha;
    
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h + 2, w/2 + 4, 6, 0, 0, Math.PI*2);
    ctx.fill();
    
    // キャタピラ
    ctx.fillStyle = '#2c2c2e';
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h - 6, w/2 + 2, 10, 0, 0, Math.PI*2);
    ctx.fill();
    
    ctx.strokeStyle = '#48484a';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + w/2 + i * 10, y + h - 14);
      ctx.lineTo(x + w/2 + i * 10, y + h - 2);
      ctx.stroke();
    }
    
    // 皿
    ctx.fillStyle = '#e5e5ea';
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h/2 + 2, w/2 + 4, h/2 + 2, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#c7c7cc';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // パスタ層
    const pastaColors = ['#ffd60a', '#ffcc00', '#ffb800'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = pastaColors[i];
      ctx.beginPath();
      ctx.ellipse(x + w/2, y + h/2 - i * 3, w/2 - 2, 8, 0, 0, Math.PI*2);
      ctx.fill();
    }
    
    // ミートソース
    ctx.fillStyle = p.skinColor || '#e94560';
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h/2 - 8, w/2 - 4, 9, 0, 0, Math.PI*2);
    ctx.fill();
    
    // ミートボール
    const meatballPos = [[-8, -10], [6, -12], [0, -6]];
    ctx.fillStyle = '#8b4513';
    for (const mp of meatballPos) {
      ctx.beginPath();
      ctx.arc(x + w/2 + mp[0], y + h/2 + mp[1], 4, 0, Math.PI*2);
      ctx.fill();
    }
    
    // 砲身
    let angle = 0;
    if (p.state === 'hand_mode' && p.hand.active) {
      angle = p.hand.moveAngle * Math.PI / 180;
    } else {
      const mx = p.mouseX || (p.x + p.facing * 100);
      const my = p.mouseY || p.y;
      angle = Math.atan2(my - (p.y + h/2), mx - (p.x + w/2));
    }
    
    const barrelLen = 28;
    const bx = x + w/2 + Math.cos(angle) * barrelLen;
    const by = y + h/2 + Math.sin(angle) * barrelLen;
    
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w/2, y + h/2 - 6);
    ctx.lineTo(bx, by);
    ctx.stroke();
    
    ctx.fillStyle = '#ffb800';
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI*2);
    ctx.fill();
    
    // 目
    const eyeDir = p.facing;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w/2 + eyeDir * 12, y + h/2 - 4, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#1d1d1f';
    ctx.beginPath();
    ctx.arc(x + w/2 + eyeDir * 13, y + h/2 - 4, 2.5, 0, Math.PI*2);
    ctx.fill();
    
    // 名前
    ctx.fillStyle = isMe ? '#e94560' : '#8e8e93';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isMe ? 'YOU' : p.id.slice(0, 6), x + w/2, y - 12);
    
    // HPバー
    const barW = w + 8;
    ctx.fillStyle = '#e5e5ea';
    ctx.fillRect(x + w/2 - barW/2, y - 8, barW, 4);
    ctx.fillStyle = p.hp > 50 ? '#34c759' : p.hp > 25 ? '#ff9500' : '#e94560';
    ctx.fillRect(x + w/2 - barW/2, y - 8, barW * (p.hp / p.maxHp), 4);
    
    // 武器スロット
    if (isMe) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = 0; i < 4; i++) {
        const sx = x + w/2 - 40 + i * 22;
        const sy = y + h + 4;
        ctx.fillRect(sx, sy, 18, 18);
        ctx.strokeStyle = p.activeSlot === i ? '#e94560' : (p.slots[i] ? '#34c759' : '#c7c7cc');
        ctx.lineWidth = p.activeSlot === i ? 2 : 1;
        ctx.strokeRect(sx, sy, 18, 18);
      }
    }
    
    // シールドエフェクト
    if (p.invincible > 0 && p.invincible > 30) {
      ctx.strokeStyle = `rgba(255, 214, 10, ${p.invincible / 120})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w/2, y + h/2, w, 0, Math.PI*2);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  },
  
  drawHook(p) {
    if (!p.hook.active) return;
    const ctx = this.ctx;
    const sx = p.x + p.width/2 - this.cameraX;
    const sy = p.y + p.height/2 - this.cameraY;
    const ex = p.hook.x - this.cameraX;
    const ey = p.hook.y - this.cameraY;
    
    // 軌跡
    const trail = this.hookTrails[p.id] || [];
    trail.push({ x: ex, y: ey, life: 10 });
    if (trail.length > 15) trail.shift();
    this.hookTrails[p.id] = trail;
    
    ctx.strokeStyle = 'rgba(255, 149, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const alpha = t.life / 10;
      ctx.globalAlpha = alpha * 0.5;
      if (i === 0) ctx.moveTo(t.x, t.y);
      else ctx.lineTo(t.x, t.y);
      t.life--;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.hook.attached ? '#34c759' : '#ff9500';
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = p.hook.attached ? '#34c759' : '#ff9500';
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, Math.PI*2);
    ctx.fill();
  },
  
  drawHand(p) {
    if (!p.hand.active) return;
    const ctx = this.ctx;
    const sx = p.x + p.width/2 - this.cameraX;
    const sy = p.y + p.height/2 - this.cameraY;
    const ex = p.hand.x - this.cameraX;
    const ey = p.hand.y - this.cameraY;
    
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineWidth = 4;
    
    if (p.hand.targetType === 'lever') ctx.strokeStyle = '#5856d6';
    else if (p.hand.targetType === 'movable') ctx.strokeStyle = '#af52de';
    else ctx.strokeStyle = '#ff2d55';
    
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = p.hand.targetType === 'lever' ? '#5856d6' : 
                    p.hand.targetType === 'movable' ? '#af52de' : '#ff2d55';
    ctx.beginPath();
    ctx.arc(ex, ey, 7, 0, Math.PI*2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const icon = p.hand.targetType === 'lever' ? '🔧' : 
                 p.hand.targetType === 'movable' ? '📦' : '✋';
    ctx.fillText(icon, ex, ey + 3);
  },
  
  drawBullets(bullets) {
    const ctx = this.ctx;
    for (const b of bullets) {
      const x = b.x - this.cameraX;
      const y = b.y - this.cameraY;
      ctx.fillStyle = b.color || '#e94560';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 2, 0, Math.PI*2);
      ctx.fill();
      
      // ミサイルの煙
      if (b.missile) {
        ctx.fillStyle = 'rgba(100,100,100,0.3)';
        ctx.beginPath();
        ctx.arc(x - b.vx * 2, y - b.vy * 2, 3, 0, Math.PI*2);
        ctx.fill();
      }
    }
  },
  
  drawLevers(levers) {
    const ctx = this.ctx;
    for (const l of levers) {
      const x = l.x - this.cameraX;
      const y = l.y - this.cameraY;
      
      ctx.fillStyle = '#8e8e93';
      ctx.fillRect(x, y + l.h - 8, l.w, 8);
      
      ctx.save();
      ctx.translate(x + l.w/2, y + l.h - 8);
      const angle = l.pulled ? Math.PI / 3 : -Math.PI / 6;
      ctx.rotate(angle);
      
      ctx.fillStyle = l.pulled ? '#34c759' : '#ff9500';
      ctx.fillRect(-3, -30, 6, 30);
      
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.arc(0, -30, 6, 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();
      
      ctx.fillStyle = '#8e8e93';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(l.pulled ? 'ON' : 'OFF', x + l.w/2, y - 4);
    }
  },
  
  drawDoors(doors) {
    const ctx = this.ctx;
    for (const d of doors) {
      const x = d.x - this.cameraX;
      const y = d.y - this.cameraY;
      
      if (d.openHeight >= d.h) continue;
      const drawH = d.h - d.openHeight;
      
      ctx.fillStyle = '#48484a';
      ctx.fillRect(x - 2, y - 2, d.w + 4, d.h + 4);
      
      ctx.fillStyle = '#2c2c2e';
      ctx.fillRect(x, y, d.w, drawH);
      
      ctx.strokeStyle = '#636366';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 4, d.w - 8, drawH - 8);
      
      if (d.openHeight > 0) {
        ctx.fillStyle = '#f5f5f7';
        ctx.fillRect(x, y + drawH, d.w, d.openHeight);
      }
    }
  },
  
  drawMovables(movables) {
    const ctx = this.ctx;
    for (const m of movables) {
      const x = m.x - this.cameraX;
      const y = m.y - this.cameraY;
      
      ctx.fillStyle = m.heldBy ? '#af52de' : '#5856d6';
      ctx.fillRect(x, y, m.w, m.h);
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, m.w - 6, m.h - 6);
      
      if (m.heldBy) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✋', x + m.w/2, y + m.h/2 + 3);
      }
    }
  },
  
  drawWarpPads(warpPads) {
    const ctx = this.ctx;
    for (const wp of warpPads) {
      const x = wp.x - this.cameraX;
      const y = wp.y - this.cameraY;
      
      ctx.fillStyle = 'rgba(0, 122, 255, 0.3)';
      ctx.fillRect(x, y, wp.w, wp.h);
      ctx.strokeStyle = '#007aff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, wp.w, wp.h);
      
      ctx.fillStyle = '#007aff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WARP', x + wp.w/2, y + wp.h/2 + 3);
    }
  },
  
  drawTraps(traps) {
    const ctx = this.ctx;
    if (!traps) return;
    for (const t of traps) {
      const x = t.x - this.cameraX;
      const y = t.y - this.cameraY;
      ctx.fillStyle = 'rgba(139, 69, 19, 0.6)';
      ctx.beginPath();
      ctx.arc(x, y, t.radius, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#8b4513';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },
  
  drawSmokeScreens(smokeScreens) {
    const ctx = this.ctx;
    if (!smokeScreens) return;
    for (const s of smokeScreens) {
      const x = s.x - this.cameraX;
      const y = s.y - this.cameraY;
      ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
      ctx.beginPath();
      ctx.arc(x, y, s.radius, 0, Math.PI*2);
      ctx.fill();
    }
  },
  
  drawRestZone(restZone, shopNpc) {
    if (!restZone.x) return;
    const ctx = this.ctx;
    const x = restZone.x - this.cameraX;
    const y = restZone.y - this.cameraY;
    
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(x, y, restZone.w, restZone.h);
    
    ctx.strokeStyle = '#e5e5ea';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, restZone.w, restZone.h);
    
    ctx.fillStyle = '#e5e5ea';
    ctx.fillRect(x, y + restZone.h - 40, restZone.w, 40);
    
    if (shopNpc.x) {
      const nx = shopNpc.x - this.cameraX;
      const ny = shopNpc.y - this.cameraY;
      
      ctx.fillStyle = '#ff9500';
      ctx.fillRect(nx, ny, shopNpc.w, shopNpc.h);
      
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SHOP', nx + shopNpc.w/2, ny - 4);
      
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(nx - 20, ny - 40, 80, 28, 6);
      ctx.fill();
      ctx.strokeStyle = '#c7c7cc';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#1d1d1f';
      ctx.font = '10px sans-serif';
      ctx.fillText('いらっしゃい！', nx + 20, ny - 22);
    }
    
    ctx.fillStyle = '#1d1d1f';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WEAPON SLOTS', x + restZone.w/2, y + 30);
    
    for (let i = 0; i < 4; i++) {
      const sx = x + restZone.w/2 - 70 + i * 38;
      const sy = y + 45;
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, 32, 32);
      ctx.strokeStyle = '#c7c7cc';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, 32, 32);
      
      ctx.fillStyle = '#8e8e93';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${i+1}`, sx + 16, sy + 22);
    }
  },
  
  drawMinimap(players, myId) {
    const ctx = this.ctx;
    const mw = 120, mh = 32;
    const mx = this.canvas.width - mw - 10;
    const my = 10;
    
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#c7c7cc';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, mh);
    
    const scaleX = mw / 3600;
    const scaleY = mh / 800;
    
    for (const id in players) {
      const p = players[id];
      if (p.inBush && id !== myId) continue;
      ctx.fillStyle = id === myId ? '#e94560' : '#34c759';
      ctx.fillRect(mx + p.x * scaleX, my + p.y * scaleY, 3, 3);
    }
  },
  
  drawReturning(returningTimer) {
    if (returningTimer <= 0) return;
    const ctx = this.ctx;
    const progress = 1 - (returningTimer / 180);
    const barW = 200;
    const barH = 20;
    const bx = this.canvas.width/2 - barW/2;
    const by = this.canvas.height/2 - 50;
    
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('休憩所に帰還中...', this.canvas.width/2, by - 10);
    
    ctx.fillStyle = '#e5e5ea';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#e94560';
    ctx.fillRect(bx, by, barW * progress, barH);
    ctx.strokeStyle = '#c7c7cc';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, barW, barH);
  },
  
  drawAim(p, mouseX, mouseY) {
    if (!p || p.returning) return;
    const ctx = this.ctx;
    const sx = p.x + p.width/2 - this.cameraX;
    const sy = p.y + p.height/2 - this.cameraY;
    const mx = mouseX - this.cameraX;
    const my = mouseY - this.cameraY;
    
    // フック到達距離表示
    ctx.strokeStyle = 'rgba(233,69,96,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 最大射程の円
    ctx.strokeStyle = 'rgba(233,69,96,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.arc(sx, sy, C.HOOK_MAX_LEN, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 6, my); ctx.lineTo(mx + 6, my);
    ctx.moveTo(mx, my - 6); ctx.lineTo(mx, my + 6);
    ctx.stroke();
  },
  
  drawEnemyMarkers(players, myId) {
    const ctx = this.ctx;
    const me = players[myId];
    if (!me) return;
    
    for (const id in players) {
      if (id === myId) continue;
      const p = players[id];
      if (p.zone !== 'battle' || p.inBush) continue;
      
      const x = p.x - this.cameraX;
      const y = p.y - this.cameraY;
      
      // 画面外なら画面端に三角形
      if (x < 0 || x > this.canvas.width || y < 0 || y > this.canvas.height) {
        const cx = Math.max(20, Math.min(this.canvas.width - 20, x));
        const cy = Math.max(20, Math.min(this.canvas.height - 20, y));
        const angle = Math.atan2(y - this.canvas.height/2, x - this.canvas.width/2);
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -6);
        ctx.lineTo(-5, 6);
        ctx.fill();
        ctx.restore();
      }
    }
  },
  
  drawHandMarker(p, levers, movables, blocks) {
    // ハンド掴み可能マーカー
    const ctx = this.ctx;
    const mx = p.mouseX - this.cameraX;
    const my = p.mouseY - this.cameraY;
    
    for (const l of levers) {
      const lx = l.x - this.cameraX;
      const ly = l.y - this.cameraY;
      const dist = Math.sqrt((mx - lx - l.w/2)**2 + (my - ly - l.h/2)**2);
      if (dist < 30) {
        ctx.fillStyle = 'rgba(88, 86, 214, 0.5)';
        ctx.beginPath();
        ctx.arc(lx + l.w/2, ly + l.h/2, 15, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔧', lx + l.w/2, ly + l.h/2 + 4);
      }
    }
  },
  
  drawChargeGauge(p) {
    if (!p.charging || p.chargeLevel <= 0) return;
    const ctx = this.ctx;
    const x = this.canvas.width / 2 - 50;
    const y = this.canvas.height - 60;
    const ratio = p.chargeLevel / C.CHARGE_MAX;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 2, y - 2, 104, 14);
    ctx.fillStyle = `hsl(${ratio * 120}, 70%, 50%)`;
    ctx.fillRect(x, y, 100 * ratio, 10);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 100, 10);
  },
  
  drawCombo(comboData) {
    if (!comboData) return;
    const ctx = this.ctx;
    const texts = ['', 'Single Kill!', 'Double Kill!', 'Triple Kill!', 'Quadra Kill!', 'PENTA KILL!'];
    const text = texts[Math.min(comboData.count, 5)] || 'UNSTOPPABLE!';
    
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(text, this.canvas.width / 2, 80);
    ctx.fillText(text, this.canvas.width / 2, 80);
  },
  
  drawDarknessOverlay(p) {
    if (!p.inDarkness) return;
    const ctx = this.ctx;
    // 周囲だけ見える円形マスク
    const x = p.x + p.width/2 - this.cameraX;
    const y = p.y + p.height/2 - this.cameraY;
    
    const gradient = ctx.createRadialGradient(x, y, 30, x, y, 200);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
};
