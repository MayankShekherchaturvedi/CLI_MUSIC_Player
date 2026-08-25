import fs from 'fs';
import path from 'path';
import readline from 'readline';
import audio from 'audio';

// ---------------------------------------------------------
// 1. STATE MANAGEMENT
// ---------------------------------------------------------
const state = {
  songs: [],
  selectedIndex: 0,
  currentSongIndex: null,
  status: 'stopped', // 'stopped', 'playing', 'paused'
  currentTime: 0,
  duration: 0, 
  progressInterval: null
};

// ---------------------------------------------------------
// 2. AUDIO ENGINE WRAPPER
// ---------------------------------------------------------
class AudioEngine {
  constructor() {
    this.track = null;
  }

  async play(songPath) {
    this.stop();
    
    try {
      this.track = await audio(songPath);
      
      if (typeof this.track.play === 'function') {
        this.track.play();
      } else {
        throw new Error("play() method is not available on this object in Node.js.");
      }
      
      state.status = 'playing';
      state.duration = this.track.duration || 180; 
      state.currentTime = 0;

      this.startTracking();
    } catch (err) {
      this.stop();
      process.stdout.write('\x1B[2J\x1B[0f');
      console.error(`\n[!] Playback Error: ${err.message}`);
      setTimeout(() => render(), 3500); 
    }
  }

  pause() {
    if (state.status === 'playing' && this.track) {
      if (typeof this.track.pause === 'function') {
        this.track.pause();
      }
      state.status = 'paused';
      this.stopTracking();
    }
  }

  resume() {
    if (state.status === 'paused' && this.track) {
      if (typeof this.track.play === 'function') {
        this.track.play();
      }
      state.status = 'playing';
      this.startTracking();
    }
  }

  stop() {
    if (this.track) {
      if (typeof this.track.stop === 'function') {
        this.track.stop();
      } else if (typeof this.track.pause === 'function') {
        this.track.pause();
      }
      this.track = null;
    }
    state.status = 'stopped';
    state.currentTime = 0;
    this.stopTracking();
  }

  startTracking() {
    this.stopTracking();
    state.progressInterval = setInterval(() => {
      if (state.status === 'playing') {
        state.currentTime = this.track.currentTime !== undefined ? this.track.currentTime : state.currentTime + 1;
        
        if (state.currentTime >= state.duration) {
          this.stop(); 
        }
        render(); 
      }
    }, 1000);
  }

  stopTracking() {
    if (state.progressInterval) {
      clearInterval(state.progressInterval);
      state.progressInterval = null;
    }
  }
}

const player = new AudioEngine();

// ---------------------------------------------------------
// 3. UI RENDERER
// ---------------------------------------------------------
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderProgressBar() {
  if (state.status === 'stopped' || state.currentSongIndex === null) return '';

  const percent = state.duration > 0 ? (state.currentTime / state.duration) : 0;
  const barLength = 30;
  const filledLength = Math.round(barLength * percent);
  
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  const percentageStr = Math.round(percent * 100).toString().padStart(3, ' ');

  return `\n⏱️  ${formatTime(state.currentTime)} [${bar}] ${formatTime(state.duration)} (${percentageStr}%)\n▶️  Status: ${state.status.toUpperCase()} (Press 'Space' to Pause/Resume)`;
}

function render() {
  process.stdout.write('\x1B[2J\x1B[0f');
  
  console.log(`🎶 WELCOME TO THE CLI MUSIC PLAYER 🎶`);
  console.log(`Controls: [↑/↓] Navigate | [Enter] Play | [Space] Pause/Resume | [Q] Quit\n`);

  state.songs.forEach((song, index) => {
    const isSelected = index === state.selectedIndex;
    const isPlaying = index === state.currentSongIndex && state.status !== 'stopped';
    
    const pointer = isSelected ? '👉' : '  ';
    const active = isPlaying ? '🎵' : '  ';
    const songName = song.replace('.mp3', '');
    
    if (isSelected) {
      console.log(`${pointer} \x1b[36m${active} ${songName}\x1b[0m`); 
    } else {
      console.log(`${pointer} ${active} ${songName}`);
    }
  });

  console.log(renderProgressBar());
}

// ---------------------------------------------------------
// 4. INPUT HANDLER & INITIALIZATION
// ---------------------------------------------------------
function init() {
  const songsDir = './songs';
  
  if (!fs.existsSync(songsDir)) {
    console.error(`Error: Directory '${songsDir}' not found.`);
    process.exit(1);
  }

  state.songs = fs.readdirSync(songsDir).filter((el) => el.toLowerCase().endsWith('.mp3'));
  
  if (state.songs.length === 0) {
    console.log("No .mp3 files found in the 'songs' directory.");
    process.exit(0);
  }

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      player.stop();
      process.stdout.write('\x1B[2J\x1B[0f');
      console.log("Goodbye! 👋");
      process.exit(0);
    }

    if (key.name === 'up') {
      state.selectedIndex = Math.max(0, state.selectedIndex - 1);
      render();
    } 
    else if (key.name === 'down') {
      state.selectedIndex = Math.min(state.songs.length - 1, state.selectedIndex + 1);
      render();
    }
    else if (key.name === 'return' || key.name === 'enter') {
      state.currentSongIndex = state.selectedIndex;
      const songPath = path.join(songsDir, state.songs[state.currentSongIndex]);
      player.play(songPath);
      render();
    }
    else if (key.name === 'space') {
      if (state.status === 'playing') {
        player.pause();
      } else if (state.status === 'paused') {
        player.resume();
      }
      render();
    }
  });

  render();
}

init();