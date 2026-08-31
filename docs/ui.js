// ===== PASU.io UI管理 =====

const UI = {
  elements: {},
  devMode: false,
  devShowHitbox: false,
  devShowGrid: false,
  devShowIds: false,
  lastFrameTime: performance.now(),
  fps: 60,
  
  init() {
    this.elements = {
      status: document.getElementById('status'),
      hp: document.getElementById('hp'),
      coins: document.getElementById('coins'),
      zone: document.getElementById('zone'),
      hud: document.getElementById('hud'),
      mapSelect: document.getElementById('mapSelect'),
      mapList: document.getElementById('mapList'),
      killLog: document.getElementById('killLog') || this.createKillLog()
    };
  },
  
  createKillLog() {
    const div = document.createElement('div');
    div.id = 'killLog';
    div.style.cssText = 'position:fixed;top:60px;right:10px;width:200px;z-index:50;';
    document.body.appendChild(div);
    return div;
  },
  
  showStatus(text, color = '#ff9500') {
    if (this.elements.status) {
      this.elements.status.textContent = text;
      this.elements.status.style.color = color;
    }
  },
  
  showHUD() {
    if (this.elements.hud) this.elements.hud.style.display = 'flex';
  },
  
  updateHUD(player) {
    if (!player) return;
    if (this.elements.hp) this.elements.hp.textContent = Math.round(player.hp);
    if (this.elements.coins) this.elements.coins.textContent = player.coins;
    if (this.elements.zone) {
      this.elements.zone.textContent = player.zone === 'rest' ? 'REST' : 'BATTLE';
    }
  },
  
  showMapSelect(maps, onSelect) {
    const el = this.elements.mapSelect;
    const list = this.elements.mapList;
    if (!el || !list) return;
    
    el.style.display = 'block';
    if (list.children.length > 0) return;
    
    list.innerHTML = '';
    maps.forEach((map, mi) => {
      const d = document.createElement('div');
      d.style.marginBottom = '12px';
      
      const t = document.createElement('h3');
      t.textContent = map.name;
      t.style.color = '#e94560';
      t.style.fontSize = '14px';
      d.appendChild(t);
      
      const description = document.createElement('p');
      description.textContent = map.description || '';
      description.style.cssText = 'margin:0 0 6px;color:#aaa;font-size:12px;';
      d.appendChild(description);

      const s = document.createElement('div');
      s.style.display = 'flex';
      s.style.gap = '8px';
      s.style.flexWrap = 'wrap';
      
      map.spawnPoints.forEach((sp, si) => {
        const b = document.createElement('button');
        b.className = 'map-btn';
        b.textContent = `地点${si+1}`;
        b.onclick = () => onSelect(mi, si);
        s.appendChild(b);
      });
      
      d.appendChild(s);
      list.appendChild(d);
    });
  },
  
  hideMapSelect() {
    if (this.elements.mapSelect) this.elements.mapSelect.style.display = 'none';
    if (this.elements.mapList) this.elements.mapList.innerHTML = '';
  },
  
  addKillLog(killer, victim, weapon) {
    const el = this.elements.killLog;
    if (!el) return;
    
    const entry = document.createElement('div');
    entry.style.cssText = 'background:rgba(0,0,0,0.6);color:#fff;padding:4px 8px;margin-bottom:4px;border-radius:4px;font-size:11px;animation:fadeIn 0.3s;';
    entry.textContent = `${killer.slice(0,6)} → ${victim.slice(0,6)}`;
    el.prepend(entry);
    
    if (el.children.length > 5) el.lastChild.remove();
    setTimeout(() => { if (entry.parentNode) entry.remove(); }, 5000);
  },
  
  showShopResult(result) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:#fff;padding:16px 24px;border-radius:8px;z-index:200;font-size:14px;';
    div.textContent = result.message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  },
  
  showDamageIndicator(angle) {
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;top:50%;left:50%;width:40px;height:40px;transform:translate(-50%,-50%) rotate(${angle}rad);z-index:40;pointer-events:none;`;
    div.innerHTML = '<div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:20px solid #e94560;position:absolute;top:0;left:10px;"></div>';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 500);
  },
  
  toggleDevMode() {
    this.devMode = !this.devMode;
  },
  
  drawDevTools(ctx, canvas, players, myId, blocks, bullets, cameraX, cameraY, mouseX, mouseY) {
    if (!this.devMode) return;
    
    const now = performance.now();
    this.fps = Math.round(1000 / (now - this.lastFrameTime));
    this.lastFrameTime = now;
    
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(10, 50, 280, 300);
    ctx.strokeStyle = '#34c759';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 50, 280, 300);
    
    ctx.fillStyle = '#34c759';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    
    const p = players[myId];
    if (p) {
      ctx.fillText(`FPS: ${this.fps}`, 20, 70);
      ctx.fillText(`POS: ${Math.round(p.x)},${Math.round(p.y)}`, 20, 88);
      ctx.fillText(`VEL: ${p.vx?.toFixed(2)||0},${p.vy?.toFixed(2)||0}`, 20, 106);
      ctx.fillText(`STATE: ${p.state}`, 20, 124);
      ctx.fillText(`GROUND: ${p.onGround}`, 20, 142);
      ctx.fillText(`BUSH: ${p.inBush}`, 20, 160);
      ctx.fillText(`ICE: ${p.onIce}`, 20, 178);
      ctx.fillText(`DARK: ${p.inDarkness}`, 20, 196);
      ctx.fillText(`BLOCKS: ${blocks.length}`, 20, 214);
      ctx.fillText(`PLAYERS: ${Object.keys(players).length}`, 20, 232);
      ctx.fillText(`BULLETS: ${bullets.length}`, 20, 250);
      ctx.fillText(`CAM: ${Math.round(cameraX)},${Math.round(cameraY)}`, 20, 268);
      ctx.fillText(`[1-9]BlockType`, 20, 286);
      ctx.fillText(`[1]Hitbox [2]Grid [3]ID`, 20, 304);
      ctx.fillText(`CLICK:place SHIFT+del`, 20, 322);
      ctx.fillText(`Ctrl+E:Export Ctrl+I:Import`, 20, 340);
    }
    
    if (this.devShowGrid) {
      ctx.strokeStyle = 'rgba(52,199,89,0.25)';
      ctx.lineWidth = 1;
      for (let x = -cameraX % 40; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = -cameraY % 40; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }
    
    if (this.devShowHitbox && p) {
      ctx.strokeStyle = '#ff2d55';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - cameraX, p.y - cameraY, p.width, p.height);
      ctx.fillStyle = '#ff2d55';
      ctx.fillText(`MOUSE: ${Math.round(mouseX)},${Math.round(mouseY)}`, 20, 358);
    }
    
    if (this.devShowIds) {
      ctx.fillStyle = '#007aff';
      ctx.font = '9px monospace';
      for (const id in players) {
        const pp = players[id];
        ctx.fillText(`${id.slice(0,6)}`, pp.x - cameraX, pp.y - cameraY - 20);
      }
    }
  }
};
