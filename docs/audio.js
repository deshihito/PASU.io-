// ===== PASU.io オーディオ管理（プロシージャル生成） =====

const Audio = {
  ctx: null,
  enabled: true,
  
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      this.enabled = false;
    }
  },
  
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  
  playTone(freq, duration, type = 'sine', volume = 0.1) {
    if (!this.enabled || !this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  
  playNoise(duration, volume = 0.1) {
    if (!this.enabled || !this.ctx) return;
    
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    
    const noise = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    
    noise.buffer = buffer;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start();
  },
  
  // ===== 効果音 =====
  
  hookShoot() {
    this.playTone(800, 0.1, 'sawtooth', 0.05);
    this.playTone(600, 0.15, 'sine', 0.08);
  },
  
  hookHit() {
    this.playTone(200, 0.2, 'square', 0.1);
    this.playNoise(0.1, 0.05);
  },
  
  hookDetach() {
    this.playTone(400, 0.08, 'sine', 0.06);
  },
  
  handShoot() {
    this.playTone(500, 0.1, 'triangle', 0.06);
    this.playTone(700, 0.15, 'sine', 0.04);
  },
  
  handGrab() {
    this.playTone(300, 0.15, 'square', 0.08);
  },
  
  bulletShoot() {
    this.playTone(1200, 0.05, 'sawtooth', 0.04);
    this.playNoise(0.03, 0.02);
  },
  
  bulletHit() {
    this.playTone(150, 0.1, 'square', 0.1);
    this.playNoise(0.08, 0.06);
  },
  
  explosion() {
    this.playNoise(0.3, 0.2);
    this.playTone(100, 0.4, 'sawtooth', 0.15);
  },
  
  leverPull() {
    this.playTone(250, 0.1, 'square', 0.08);
    this.playTone(180, 0.15, 'sine', 0.1);
  },
  
  doorOpen() {
    this.playTone(150, 0.3, 'sine', 0.06);
    this.playTone(100, 0.4, 'triangle', 0.04);
  },
  
  warp() {
    this.playTone(400, 0.3, 'sine', 0.08);
    this.playTone(800, 0.4, 'sine', 0.05);
    this.playTone(1200, 0.5, 'triangle', 0.03);
  },
  
  damage() {
    this.playTone(200, 0.15, 'sawtooth', 0.12);
    this.playTone(150, 0.2, 'square', 0.1);
  },
  
  landing(intensity) {
    const vol = Math.min(0.15, intensity * 0.01);
    this.playNoise(0.15, vol);
    this.playTone(80, 0.2, 'sine', vol);
  },
  
  dash() {
    this.playTone(300, 0.1, 'sawtooth', 0.05);
    this.playNoise(0.1, 0.03);
  },
  
  coin() {
    this.playTone(1200, 0.05, 'sine', 0.08);
    this.playTone(1600, 0.1, 'sine', 0.06);
  },
  
  kill() {
    this.playTone(523, 0.1, 'sine', 0.1);
    this.playTone(659, 0.1, 'sine', 0.1);
    this.playTone(784, 0.2, 'sine', 0.12);
  },
  
  matchStart() {
    this.playTone(440, 0.2, 'sine', 0.1);
    this.playTone(554, 0.2, 'sine', 0.1);
    this.playTone(659, 0.4, 'sine', 0.12);
  },
  
  matchEnd() {
    this.playTone(659, 0.2, 'sine', 0.1);
    this.playTone(554, 0.2, 'sine', 0.1);
    this.playTone(440, 0.4, 'sine', 0.12);
  },
  
  // ===== BGM（簡易ループ） =====
  
  bgmOscillators: [],
  bgmPlaying: false,
  
  playBGM() {
    if (!this.enabled || !this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    
    const notes = [262, 294, 330, 349, 392, 349, 330, 294];
    let noteIndex = 0;
    
    const playNote = () => {
      if (!this.bgmPlaying) return;
      const freq = notes[noteIndex % notes.length];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
      
      noteIndex++;
      setTimeout(playNote, 500);
    };
    
    playNote();
  },
  
  stopBGM() {
    this.bgmPlaying = false;
  }
};
