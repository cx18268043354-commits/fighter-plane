// Retro Arcade Audio Synthesizer using direct Web Audio API
class AudioSynthManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Lazy loaded context
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    return this.soundEnabled;
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }

  // Pure synth laser shot
  playLaser(isTriple: boolean = false) {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isTriple ? 'sawtooth' : 'triangle';
      
      // Pitch slide: high to low quickly
      const startFreq = isTriple ? 900 : 750;
      const endFreq = isTriple ? 150 : 200;
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.12);

      gain.gain.setValueAtTime(isTriple ? 0.12 : 0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.13);
    } catch (e) {
      console.warn('Audio play laser error:', e);
    }
  }

  // Explosion sound effect depending on enemy weight
  playExplosion(type: 'BASIC' | 'FAST' | 'HEAVY' | 'PLAYER') {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const time = this.ctx.currentTime;
      
      // Heavy explosions use white-noise style filters, standard use decaying pitch
      if (type === 'HEAVY' || type === 'PLAYER') {
        const bufferSize = this.ctx.sampleRate * 0.45; // 0.45s 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Populate random noise
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Base lowpass filter for deep explosion rumble
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(type === 'PLAYER' ? 300 : 200, time);
        filter.frequency.exponentialRampToValueAtTime(30, time + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.45);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(time);
        noise.stop(time + 0.45);

      } else {
        // Basic synth explosion (decaying frequency oscillator)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(type === 'FAST' ? 280 : 200, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.2);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.22);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, time);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.22);
      }
    } catch (e) {
      console.warn('Audio play explosion error:', e);
    }
  }

  // Active power-up sound
  playPowerUp(type: 'SHIELD' | 'TRIPLE_SHOT') {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type === 'SHIELD' ? 'sine' : 'triangle';
      
      // Rising bubble frequencies
      const startFreq = 300;
      const middleFreq = 600;
      const endFreq = type === 'SHIELD' ? 1200 : 1000;
      
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.linearRampToValueAtTime(middleFreq, time + 0.15);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.35);

      gain.gain.setValueAtTime(0.08, time);
      gain.gain.setValueAtTime(0.12, time + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.4);
    } catch (e) {
      console.warn('Audio play powerup error:', e);
    }
  }

  // Achievement notification chime - elegant ascending synth chime
  playAchievementChime() {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const time = this.ctx.currentTime;
      const t1 = time;
      const t2 = time + 0.08;
      const t3 = time + 0.16;
      const t4 = time + 0.24;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 major chord

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time + idx * 0.07);

        gain.gain.setValueAtTime(0.08, time + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.07 + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(time + idx * 0.07);
        osc.stop(time + idx * 0.07 + 0.25);
      });
    } catch (e) {
      console.warn('Audio achievement error:', e);
    }
  }

  // Level Up sound fx
  playLevelUp() {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const time = this.ctx.currentTime;
      const notes = [440.00, 554.37, 659.25, 880.00, 1108.73, 1318.51]; // A major melodic climb up

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time + idx * 0.065);

        gain.gain.setValueAtTime(0.06, time + idx * 0.065);
        gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.065 + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(time + idx * 0.065);
        osc.stop(time + idx * 0.065 + 0.35);
      });
    } catch (e) {
      console.warn('Audio level up error:', e);
    }
  }

  // Player get damaged
  playHurt() {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.linearRampToValueAtTime(60, time + 0.25);

      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.26);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.26);
    } catch (e) {
      console.warn('Audio playing hurt error:', e);
    }
  }
}

export const sound = new AudioSynthManager();
