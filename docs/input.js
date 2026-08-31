// ===== PASU.io 入力管理 =====

const Input = {
  keys: {},
  mouseX: 0,
  mouseY: 0,
  joystickActive: false,
  joystickDX: 0,
  isMobile: false,
  hookPressed: false,
  previousActionKeys: {},
  
  init(canvas) {
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // キーボード
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    
    // PCマウス照準
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouseX = (e.clientX - rect.left) * scaleX + window.cameraX;
      this.mouseY = (e.clientY - rect.top) * scaleY + window.cameraY;
    });
    
    // マウス長押し：押している間だけフックを維持する。
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.hookPressed = true;
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      this.hookPressed = false;
    });
    window.addEventListener('mouseup', () => {
      this.hookPressed = false;
    });
    canvas.addEventListener('mouseleave', () => {
      this.hookPressed = false;
    });
    
    // スマホ照準：右半分＆ボタン以外
    canvas.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const rect = canvas.getBoundingClientRect();
        const cx = (t.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (t.clientY - rect.top) * (canvas.height / rect.height);
        if (cx > canvas.width * 0.35 && cy < canvas.height - 180) {
          this.mouseX = cx + window.cameraX;
          this.mouseY = cy + window.cameraY;
        }
      }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const rect = canvas.getBoundingClientRect();
        const cx = (t.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (t.clientY - rect.top) * (canvas.height / rect.height);
        if (cx > canvas.width * 0.35 && cy < canvas.height - 180) {
          this.mouseX = cx + window.cameraX;
          this.mouseY = cy + window.cameraY;
        }
      }
    }, { passive: false });
    
    // ジョイスティック
    const joystickArea = document.getElementById('joystickArea');
    const joystickStick = document.getElementById('joystickStick');
    
    if (joystickArea) {
      joystickArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.joystickActive = true;
        this.updateJoystick(e.touches[0], joystickArea, joystickStick);
      }, { passive: false });
      
      joystickArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (this.joystickActive) this.updateJoystick(e.touches[0], joystickArea, joystickStick);
      }, { passive: false });
      
      joystickArea.addEventListener('touchend', () => {
        this.joystickActive = false;
        this.joystickDX = 0;
        if (joystickStick) joystickStick.style.transform = 'translate(-50%, -50%)';
      });
    }
    
    // アクションボタン
    this.bindTouchBtn('btnHook', 's');
    this.bindTouchBtn('btnHand', 'w');
    this.bindTouchBtn('btnRest', 'h');
  },
  
  updateJoystick(touch, area, stick) {
    const rect = area.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const dx = touch.clientX - centerX;
    const maxDist = 35;
    const dist = Math.min(Math.sqrt(dx*dx), maxDist);
    const dir = dx >= 0 ? 1 : -1;
    this.joystickDX = (dist / maxDist) * dir;
    const stickX = Math.cos(0) * dist * dir;
    if (stick) stick.style.transform = `translate(calc(-50% + ${stickX}px), -50%)`;
  },
  
  bindTouchBtn(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys[key] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); this.keys[key] = false; });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); this.keys[key] = false; });
  },
  
  actionPressed(key) {
    const isDown = Boolean(this.keys[key]);
    const wasDown = Boolean(this.previousActionKeys[key]);
    this.previousActionKeys[key] = isDown;
    return isDown && !wasDown;
  },

  getState() {
    let left = this.keys['a'] || this.keys['arrowleft'];
    let right = this.keys['d'] || this.keys['arrowright'];
    
    if (this.isMobile && this.joystickActive) {
      if (this.joystickDX < -0.2) left = true;
      if (this.joystickDX > 0.2) right = true;
    }
    
    return {
      left, right,
      // 移動・ジャンプとアクションのキーを分離する。
      // W はハンド、S はフック専用。ジャンプ／上下移動は矢印キーのみ。
      up: this.keys['arrowup'],
      down: this.keys['arrowdown'],
      jump: this.actionPressed('arrowup'),
      hook: this.hookPressed || Boolean(this.keys['s']),
      pasta: this.actionPressed('w'),
      rest: this.actionPressed('h'),
      slot1: this.actionPressed('1'),
      slot2: this.actionPressed('2'),
      slot3: this.actionPressed('3'),
      slot4: this.actionPressed('4'),
      slotPrev: this.actionPressed('q'),
      slotNext: this.actionPressed('e'),
      subWeapon: this.actionPressed('f'),
      mouseX: this.mouseX,
      mouseY: this.mouseY
    };
  }
};
