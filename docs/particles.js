// ===== PASU.io パーティクルシステム =====

const Particles = {
  particles: [],
  screenShake: 0,
  screenShakeDecay: 0.9,
  
  emit(x, y, type, options = {}) {
    const count = options.count || 10;
    const color = options.color || '#e94560';
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = options.speed || (2 + Math.random() * 4);
      
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: options.life || 30 + Math.random() * 20,
        maxLife: options.life || 30,
        size: options.size || (3 + Math.random() * 4),
        color,
        type,
        gravity: options.gravity || 0.2,
        decay: options.decay || 0.95
      });
    }
    
    if (options.shake) {
      this.screenShake = options.shake;
    }
  },
  
  emitHookHit(x, y) {
    this.emit(x, y, 'spark', { count: 8, color: '#ff9500', speed: 3, life: 20 });
  },
  
  emitBulletHit(x, y, color) {
    this.emit(x, y, 'burst', { count: 6, color: color || '#e94560', speed: 4, life: 15 });
  },
  
  emitExplosion(x, y, radius) {
    this.emit(x, y, 'explosion', { 
      count: 20, 
      color: '#ff6b35', 
      speed: 6, 
      life: 40,
      gravity: 0.1,
      shake: radius > 50 ? 8 : 4
    });
    this.emit(x, y, 'smoke', { 
      count: 10, 
      color: 'rgba(100,100,100,0.5)', 
      speed: 2, 
      life: 60,
      gravity: -0.05
    });
  },
  
  emitWarp(x, y) {
    this.emit(x, y, 'warp', { 
      count: 15, 
      color: '#007aff', 
      speed: 5, 
      life: 30,
      gravity: 0
    });
  },
  
  emitDash(x, y, facing) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: -facing * (2 + Math.random() * 3),
        vy: (Math.random() - 0.5) * 2,
        life: 15,
        maxLife: 15,
        size: 4,
        color: 'rgba(255,255,255,0.6)',
        type: 'dash',
        gravity: 0,
        decay: 0.9
      });
    }
  },
  
  emitLanding(x, y, intensity) {
    this.emit(x, y + 20, 'dust', { 
      count: intensity * 3, 
      color: '#c7c7cc', 
      speed: 2, 
      life: 20,
      gravity: -0.1
    });
  },
  
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.decay;
      p.vy *= p.decay;
      p.life--;
      
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    
    this.screenShake *= this.screenShakeDecay;
    if (this.screenShake < 0.5) this.screenShake = 0;
  },
  
  draw(ctx, cameraX, cameraY) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      const x = p.x - cameraX;
      const y = p.y - cameraY;
      
      ctx.globalAlpha = alpha;
      
      if (p.type === 'smoke' || p.type === 'dust') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (2 - alpha), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.fillRect(x - p.size/2, y - p.size/2, p.size, p.size);
      } else if (p.type === 'warp') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 + (1-alpha) * 3), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.globalAlpha = 1;
  },
  
  getShakeOffset() {
    if (this.screenShake <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.screenShake * 2,
      y: (Math.random() - 0.5) * this.screenShake * 2
    };
  }
};
