
// Simple Web Audio API Synthesizer for UI Sounds
// No external assets required

let audioCtx: AudioContext | null = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

type SoundType = 'hover' | 'select' | 'start' | 'pause' | 'crash' | 'lifeLost' | 'smash' | 'coin';

export const playSound = (type: SoundType) => {
  const ctx = initAudio();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  switch (type) {
    case 'hover':
      // Crisp tick (Nintendo Switch style move)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.02);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.start(t);
      osc.stop(t + 0.05);
      break;

    case 'select':
      // Cheerful bubble pop / confirm
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.2);
      break;

    case 'start':
      // Major Chord Arpeggio
      const playNote = (freq: number, delay: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, t + delay);
        g.gain.linearRampToValueAtTime(0.1, t + delay + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.5);
        o.start(t + delay);
        o.stop(t + delay + 0.6);
      };
      playNote(440, 0); // A4
      playNote(554.37, 0.05); // C#5
      playNote(659.25, 0.1); // E5
      break;

    case 'pause':
      // Soft toggle
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.15);
      break;
    
    case 'lifeLost':
      // Retro damage sound
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(100, t + 0.2);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.25);
      break;

    case 'crash':
      // Noise burst for game over or heavy hit
      const bufferSize = ctx.sampleRate * 0.5; // 0.5 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      
      noiseGain.gain.setValueAtTime(0.2, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      noise.start(t);
      break;
    
    case 'smash':
      // Woody/Crate smash
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.1);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.2);
      break;

    case 'coin':
      // High pitched ding (Sine + Triangle)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(1800, t + 0.05);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.35);
      
      // Secondary tone for sparkle
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2400, t);
      gain2.gain.setValueAtTime(0.05, t);
      gain2.gain.linearRampToValueAtTime(0, t + 0.1);
      osc2.start(t);
      osc2.stop(t + 0.1);
      break;
  }
};
