
import React, { useEffect, useRef, useCallback } from 'react';
import { GameState, GAME_WIDTH, GAME_HEIGHT, Lane, LANE_HEIGHT, LANE_START_Y, PLAYER_X, Entity, Player, Particle } from '../types';
import { THEMES, INITIAL_SPEED, MAX_SPEED, LANE_SWITCH_SPEED, ACCELERATION, SAFE_ZONE, STAGE_LENGTH } from '../constants';
import { useInput } from '../hooks/useInput';
import { playSound } from '../utils/audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  setCoins: (coins: number) => void;
  onLifeLost: () => void;
  lives: number;
}

// Utility to lerp between hex colors
const lerpColor = (a: string, b: string, amount: number): string => { 
  const ar = parseInt(a.slice(1, 3), 16),
        ag = parseInt(a.slice(3, 5), 16),
        ab = parseInt(a.slice(5, 7), 16);

  const br = parseInt(b.slice(1, 3), 16),
        bg = parseInt(b.slice(3, 5), 16),
        bb = parseInt(b.slice(5, 7), 16);

  const rr = Math.round(ar + (br - ar) * amount).toString(16).padStart(2, '0');
  const rg = Math.round(ag + (bg - ag) * amount).toString(16).padStart(2, '0');
  const rb = Math.round(ab + (bb - ab) * amount).toString(16).padStart(2, '0');

  return `#${rr}${rg}${rb}`;
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, setScore, setCoins, onLifeLost, lives }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const getInput = useInput();
  
  // Game State Refs
  const playerRef = useRef<Player>({
    lane: Lane.MIDDLE,
    y: LANE_START_Y + LANE_HEIGHT,
    speed: INITIAL_SPEED,
    distance: 0,
    score: 0,
    coins: 0,
    tilt: 0,
    bounce: 0,
    invincible: 0
  });
  
  const obstaclesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const frameCountRef = useRef(0);
  const nextSpawnDistanceRef = useRef(SAFE_ZONE);
  
  // Theme State - Initialize with first theme
  const currentThemeRef = useRef({ ...THEMES[0] });

  // Initialize/Reset Game
  const resetGame = useCallback(() => {
    playerRef.current = {
      lane: Lane.MIDDLE,
      y: LANE_START_Y + (Lane.MIDDLE * LANE_HEIGHT),
      speed: INITIAL_SPEED,
      distance: 0,
      score: 0,
      coins: 0,
      tilt: 0,
      bounce: 0,
      invincible: 0
    };
    obstaclesRef.current = [];
    particlesRef.current = [];
    frameCountRef.current = 0;
    currentThemeRef.current = { ...THEMES[0] };
    playerRef.current.distance = 0; 
    nextSpawnDistanceRef.current = SAFE_ZONE;
    setScore(0);
    setCoins(0);
  }, [setScore, setCoins]);

  
  useEffect(() => {
    if (gameState === GameState.PLAYING && lives === 3) {
      if (playerRef.current.distance === 0 || lives === 3) {
         resetGame();
      }
    }
  }, [gameState, lives, resetGame]);

  const spawnPattern = () => {
    if (playerRef.current.distance < nextSpawnDistanceRef.current) return;

    const theme = currentThemeRef.current;
    
    // Choose a pattern type
    // 0: Single Random Obstacle (Frequent)
    // 1: Coin Line (Frequent)
    // 2: The Gate (Obstacles top/bot, Coins mid)
    // 3: Scattered Coins + Obstacles
    const patternType = Math.random();
    
    // Base X for new spawns (just off screen)
    // Since we check player distance, we spawn relative to current game width view
    const spawnX = GAME_WIDTH + 100;
    
    let patternLength = 0;
    
    const addObstacle = (xOffset: number, lane: Lane) => {
      // Determine obstacle type based on theme or random
      let type: 'cone' | 'barrier' | 'rock' | 'crate' | 'barrel' = 'barrier';
      const r = Math.random();
      
      if (theme.name === 'Construction Site') {
         if (r > 0.7) type = 'barrel';
         else if (r > 0.4) type = 'crate';
         else if (r > 0.2) type = 'barrier';
         else type = 'cone';
      } else if (theme.name === 'Sunny Village') {
         if (r > 0.7) type = 'crate';
         else if (r > 0.4) type = 'rock';
         else type = 'cone';
      } else { // City
         if (r > 0.8) type = 'barrel';
         else if (r > 0.5) type = 'barrier';
         else type = 'cone';
      }

      obstaclesRef.current.push({
        x: spawnX + xOffset,
        y: LANE_START_Y + (lane * LANE_HEIGHT) + (LANE_HEIGHT / 2),
        width: 80,
        height: 80,
        color: theme.obstacle,
        type: 'obstacle',
        lane,
        subType: type,
        destroyed: false
      });
    };

    const addCoin = (xOffset: number, lane: Lane) => {
      obstaclesRef.current.push({
        x: spawnX + xOffset,
        y: LANE_START_Y + (lane * LANE_HEIGHT) + (LANE_HEIGHT / 2),
        width: 50,
        height: 50,
        color: '#f1c40f',
        type: 'coin',
        lane
      });
    };

    if (patternType < 0.3) {
      // PATTERN: Random Single Obstacle
      const lane = Math.floor(Math.random() * 3);
      addObstacle(0, lane);
      patternLength = 400; // Small gap after single obstacle
    } 
    else if (patternType < 0.6) {
      // PATTERN: Coin Line
      const lane = Math.floor(Math.random() * 3);
      const count = 5 + Math.floor(Math.random() * 5); // 5-10 coins
      for (let i = 0; i < count; i++) {
        addCoin(i * 70, lane);
      }
      patternLength = count * 70 + 300;
    }
    else if (patternType < 0.8) {
      // PATTERN: The Gate (or Split)
      // Obstacle in 2 lanes, coin path in 1
      const safeLane = Math.floor(Math.random() * 3);
      const lanes = [0, 1, 2];
      
      lanes.forEach(l => {
        if (l === safeLane) {
          // Add coins in safe lane
          addCoin(0, l);
          addCoin(70, l);
          addCoin(140, l);
        } else {
          // Add obstacle in blocked lane
          addObstacle(50, l);
        }
      });
      patternLength = 500;
    } 
    else {
      // PATTERN: Scatter / Slalom
      // Switch lanes
      const startLane = Math.floor(Math.random() * 3);
      addCoin(0, startLane);
      addCoin(80, startLane);
      
      const nextLane = startLane === 1 ? (Math.random() > 0.5 ? 0 : 2) : 1;
      addCoin(200, nextLane);
      addCoin(280, nextLane);
      
      // Add obstacle in the lane we left
      addObstacle(300, startLane);
      
      patternLength = 600;
    }

    // Set next spawn
    // Reduce gap slightly as speed increases to keep intensity? 
    // For now, keep it readable.
    nextSpawnDistanceRef.current = playerRef.current.distance + patternLength + 500; 
  };

  const createSmoke = (x: number, y: number) => {
    particlesRef.current.push({
      x,
      y,
      vx: -4 - Math.random() * 3, // Move left faster
      vy: -1 - Math.random() * 1.5, // Float up
      life: 40,
      maxLife: 40,
      size: 8 + Math.random() * 8,
      color: 'rgba(240, 240, 240, 0.5)'
    });
  };

  const createDebris = (x: number, y: number, color: string) => {
    const count = 8;
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10 - 5, // Explode outward + backward
        vy: (Math.random() - 1) * 10,
        life: 60,
        maxLife: 60,
        size: 5 + Math.random() * 8,
        color: color
      });
    }
  };

  const createSparkles = (x: number, y: number) => {
    const count = 10;
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 30,
        maxLife: 30,
        size: 3 + Math.random() * 4,
        color: '#f1c40f' // Gold
      });
    }
  };

  const update = () => {
    const input = getInput();
    
    // Pause Detection
    if (input.pause) {
      setGameState(GameState.PAUSED);
      playSound('pause');
      return;
    }

    const player = playerRef.current;
    
    // Lane Switching
    if (input.up && player.lane > Lane.TOP) {
      player.lane--;
    } else if (input.down && player.lane < Lane.BOTTOM) {
      player.lane++;
    }

    // Smooth Y Movement & Tilt
    const targetY = LANE_START_Y + (player.lane * LANE_HEIGHT);
    const prevY = player.y;
    player.y += (targetY - player.y) * LANE_SWITCH_SPEED; 
    
    const dy = player.y - prevY;
    const targetTilt = dy * 0.05; 
    player.tilt += (targetTilt - player.tilt) * 0.2;

    player.bounce = Math.sin(frameCountRef.current * 0.2) * 3;

    // Invincibility
    if (player.invincible > 0) player.invincible--;

    // Speed Control
    let targetSpeed = INITIAL_SPEED + (player.distance * ACCELERATION); 
    if (targetSpeed > MAX_SPEED) targetSpeed = MAX_SPEED;
    
    if (input.gas) targetSpeed *= 1.3;
    if (input.brake) targetSpeed *= 0.7;
    
    player.speed += (targetSpeed - player.speed) * 0.05;

    // Move World
    player.distance += player.speed;
    const currentScore = Math.floor(player.distance / 10) + (player.coins * 50);
    player.score = currentScore;
    setScore(currentScore);
    setCoins(player.coins);

    // -- THEME INTERPOLATION --
    const targetThemeIndex = Math.floor(player.distance / STAGE_LENGTH) % THEMES.length;
    const targetTheme = THEMES[targetThemeIndex];
    const ct = currentThemeRef.current;
    
    // Interpolate all color properties by 1% per frame for smoothness
    const lerpRate = 0.01;
    ct.sky = lerpColor(ct.sky, targetTheme.sky, lerpRate);
    ct.ground = lerpColor(ct.ground, targetTheme.ground, lerpRate);
    ct.road = lerpColor(ct.road, targetTheme.road, lerpRate);
    ct.stripe = lerpColor(ct.stripe, targetTheme.stripe, lerpRate);
    ct.obstacle = lerpColor(ct.obstacle, targetTheme.obstacle, lerpRate);
    ct.details = lerpColor(ct.details, targetTheme.details, lerpRate);
    // -------------------------

    // Emit Smoke (Coordinate adjusted for new truck design)
    if (frameCountRef.current % 5 === 0) {
      createSmoke(PLAYER_X + 125, player.y - 25 + player.bounce); 
    }

    // Update Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.size *= 0.95; 
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }

    // Spawn Patterns
    spawnPattern();

    // Update Obstacles
    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
      const ob = obstaclesRef.current[i];
      ob.x -= player.speed;
      
      // Keep obstacle color in sync with theme if it's a generic barrier
      if (ob.subType === 'barrier') {
         ob.color = currentThemeRef.current.obstacle;
      }
      
      // Collision Logic
      const playerBox = { 
        l: PLAYER_X + 25, 
        r: PLAYER_X + 175, 
        t: player.y + 35, 
        b: player.y + 85
      };
      
      const obBox = {
        l: ob.x + 15,
        r: ob.x + ob.width - 15,
        t: ob.y - (ob.height / 2) + 15,
        b: ob.y + (ob.height / 2) - 15
      };

      if (
        !ob.destroyed &&
        playerBox.l < obBox.r &&
        playerBox.r > obBox.l &&
        playerBox.t < obBox.b &&
        playerBox.b > obBox.t
      ) {
        if (ob.type === 'coin') {
          // COIN COLLECTED
          player.coins++;
          playSound('coin');
          createSparkles(ob.x + ob.width/2, ob.y);
          obstaclesRef.current.splice(i, 1);
          continue; // Skip rest of loop for this entity
        }
        else if (ob.subType === 'crate' || ob.subType === 'barrel') {
          // DESTRUCTIBLE HIT
          ob.destroyed = true;
          playSound('smash');
          createDebris(ob.x + 40, ob.y, ob.subType === 'crate' ? '#d35400' : '#3498db');
          
          // If not invincible, still take damage!
          if (player.invincible === 0) {
             player.invincible = 180;
             if (lives > 1) playSound('lifeLost');
             else playSound('crash');
             onLifeLost();
          }
        }
        else {
          // HARD OBSTACLE HIT
          if (player.invincible === 0) {
            player.invincible = 180;
            if (lives > 1) playSound('lifeLost');
            else playSound('crash');
            onLifeLost();
          }
        }
      }

      if (ob.x < -200) {
        obstaclesRef.current.splice(i, 1);
      }
    }

    frameCountRef.current++;
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const theme = currentThemeRef.current; // Use the interpolated theme
    const player = playerRef.current;

    // 1. Sky
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 2. Ground 
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, LANE_START_Y, GAME_WIDTH, GAME_HEIGHT - LANE_START_Y);

    // 3. Road 
    const roadHeight = LANE_HEIGHT * 3;
    const roadY = LANE_START_Y;
    
    // Road shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, roadY, GAME_WIDTH, roadHeight + 15);
    
    // Asphalt
    ctx.fillStyle = theme.road;
    ctx.fillRect(0, roadY, GAME_WIDTH, roadHeight);
    
    // Lane Lines
    ctx.fillStyle = theme.stripe;
    const dashOffset = -(player.distance % 120);
    
    // Top Line
    for (let x = dashOffset; x < GAME_WIDTH; x += 120) {
      if (x + 80 > 0) ctx.fillRect(x, roadY + LANE_HEIGHT - 6, 80, 12);
    }
    // Bottom Line
    for (let x = dashOffset; x < GAME_WIDTH; x += 120) {
      if (x + 80 > 0) ctx.fillRect(x, roadY + (LANE_HEIGHT * 2) - 6, 80, 12);
    }

    // 4. Render Entities
    const renderList = [...obstaclesRef.current, { ...player, type: 'player' } as any];
    renderList.sort((a, b) => a.y - b.y);

    renderList.forEach(entity => {
      if (entity.destroyed) return; // Don't draw destroyed objects
      
      if (entity.type === 'player') {
        drawTruck(ctx, player.x || PLAYER_X, player.y, player.tilt, player.bounce, player.invincible);
      } else if (entity.type === 'coin') {
        drawCoin(ctx, entity);
      } else {
        drawObstacle(ctx, entity);
      }
    });

    // 5. Particles (Smoke & Debris)
    particlesRef.current.forEach(p => {
       ctx.fillStyle = p.color;
       ctx.beginPath();
       ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
       ctx.fill();
    });

    // 6. Speed Lines
    if (player.speed > MAX_SPEED * 0.7) {
       ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
       ctx.lineWidth = 3;
       const speedLines = 5;
       for(let i=0; i<speedLines; i++) {
          const ly = Math.random() * GAME_HEIGHT;
          const lx = Math.random() * GAME_WIDTH;
          const len = 50 + Math.random() * 200;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx - len, ly);
          ctx.stroke();
       }
    }
  };

  const drawCoin = (ctx: CanvasRenderingContext2D, coin: Entity) => {
    const cx = coin.x + coin.width/2;
    const cy = coin.y;
    
    // Animation: Bob and Rotate
    const bob = Math.sin(frameCountRef.current * 0.1) * 5;
    const rotateWidth = Math.abs(Math.cos(frameCountRef.current * 0.1 + coin.x * 0.01)); // Simple pseudo-3D rotation
    
    ctx.save();
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 30, 15, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Coin
    ctx.translate(cx, cy + bob);
    
    // Outer
    ctx.fillStyle = '#f1c40f'; // Gold
    ctx.beginPath();
    ctx.ellipse(0, 0, 20 * rotateWidth, 20, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Inner/Highlight
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * rotateWidth, 14, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Shine
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(-5 * rotateWidth, -5, 5 * rotateWidth, 5, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  };

  const drawObstacle = (ctx: CanvasRenderingContext2D, ob: Entity) => {
    const cx = ob.x + ob.width/2;
    const cy = ob.y; 
    
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 35, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (ob.subType === 'cone') {
      ctx.fillStyle = '#ff7675';
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy + 40);
      ctx.lineTo(cx + 20, cy + 40);
      ctx.lineTo(cx, cy - 40);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 10);
      ctx.lineTo(cx + 12, cy + 10);
      ctx.lineTo(cx + 8, cy - 10);
      ctx.lineTo(cx - 8, cy - 10);
      ctx.fill();
    } else if (ob.subType === 'rock') {
      ctx.fillStyle = '#636e72';
      ctx.beginPath();
      ctx.arc(cx, cy + 10, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b2bec3';
      ctx.beginPath();
      ctx.arc(cx - 10, cy - 10, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (ob.subType === 'crate') {
      // Wooden Crate
      ctx.fillStyle = '#d35400'; // Dark Wood
      drawRoundedRect(ctx, ob.x, ob.y - 30, ob.width, 70, 4);
      // Details
      ctx.fillStyle = '#e67e22'; // Lighter Wood
      ctx.fillRect(ob.x + 5, ob.y - 25, ob.width - 10, 60);
      ctx.fillStyle = '#d35400';
      // Cross
      ctx.beginPath();
      ctx.moveTo(ob.x + 5, ob.y - 25);
      ctx.lineTo(ob.x + ob.width - 5, ob.y + 35);
      ctx.stroke();
      ctx.moveTo(ob.x + ob.width - 5, ob.y - 25);
      ctx.lineTo(ob.x + 5, ob.y + 35);
      ctx.stroke();
    } else if (ob.subType === 'barrel') {
      // Blue Barrel
      ctx.fillStyle = '#2980b9'; // Dark Blue
      drawRoundedRect(ctx, ob.x + 10, ob.y - 30, 60, 70, 8);
      ctx.fillStyle = '#3498db'; // Lighter Blue Body
      ctx.fillRect(ob.x + 10, ob.y - 20, 60, 50);
      // Ribs
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(ob.x + 10, ob.y - 10, 60, 5);
      ctx.fillRect(ob.x + 10, ob.y + 10, 60, 5);
    } else {
      // Barrier
      ctx.fillStyle = ob.color;
      drawRoundedRect(ctx, ob.x, ob.y - 30, ob.width, 70, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(ob.x + 15, ob.y - 30);
      ctx.lineTo(ob.x + 35, ob.y - 30);
      ctx.lineTo(ob.x + 15, ob.y + 40);
      ctx.lineTo(ob.x - 5, ob.y + 40);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ob.x + 55, ob.y - 30);
      ctx.lineTo(ob.x + 75, ob.y - 30);
      ctx.lineTo(ob.x + 55, ob.y + 40);
      ctx.lineTo(ob.x + 35, ob.y + 40);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawTruck = (ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number, bounce: number, invincible: number) => {
    ctx.save();
    
    // Invincibility Flash
    if (invincible > 0 && Math.floor(frameCountRef.current / 4) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    const cx = x + 100; 
    const cy = y + 50 + bounce;
    // Tilt transformation
    ctx.translate(cx, cy);
    ctx.rotate(tilt * 0.5); 
    ctx.translate(-cx, -cy);

    const truckBaseX = x;
    const truckBaseY = y + bounce;

    // -- SHADOW --
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 45, 90, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // -- TRAILER --
    const trailerX = truckBaseX;
    const trailerY = truckBaseY - 10;
    const trailerW = 120;
    const trailerH = 80;
    
    // Main Container
    ctx.fillStyle = '#feca57'; // Pastel Yellow
    drawRoundedRect(ctx, trailerX, trailerY, trailerW, trailerH, 12);
    
    // Vertical Ribs
    ctx.fillStyle = '#ff9f43'; // Darker Orange/Yellow
    const ribW = 12;
    ctx.fillRect(trailerX + 20, trailerY, ribW, trailerH);
    ctx.fillRect(trailerX + 55, trailerY, ribW, trailerH);
    ctx.fillRect(trailerX + 90, trailerY, ribW, trailerH);
    
    // Roof Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(trailerX + 5, trailerY + 2, trailerW - 10, 6);

    // Chassis Frame
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(trailerX + 15, trailerY + trailerH - 5, trailerW - 30, 12);

    // -- CONNECTOR --
    ctx.fillStyle = '#636e72';
    ctx.fillRect(truckBaseX + trailerW - 5, truckBaseY + 50, 20, 10);

    // -- CABIN --
    const cabX = truckBaseX + 115;
    const cabY = truckBaseY + 10;
    const cabW = 60;
    const cabH = 60;

    // Cab Body
    ctx.fillStyle = '#ff6b6b'; // Pastel Red
    drawRoundedRect(ctx, cabX, cabY, cabW, cabH, 10);
    
    // Aerodynamic Roof Spoiler
    ctx.beginPath();
    ctx.moveTo(cabX, cabY + 5);
    ctx.lineTo(cabX + cabW, cabY + 5);
    ctx.lineTo(cabX + cabW - 5, cabY - 18);
    ctx.lineTo(cabX + 5, cabY - 18);
    ctx.fill();

    // Side Window
    ctx.fillStyle = '#48dbfb'; // Sky Blue
    ctx.beginPath();
    ctx.roundRect(cabX + 35, cabY + 10, 25, 25, [2, 6, 6, 2]);
    ctx.fill();
    
    // Window Glint
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(cabX + 40, cabY + 10);
    ctx.lineTo(cabX + 52, cabY + 10);
    ctx.lineTo(cabX + 37, cabY + 35);
    ctx.lineTo(cabX + 35, cabY + 35);
    ctx.fill();

    // Front Grill
    ctx.fillStyle = '#dfe6e9'; // Silver
    drawRoundedRect(ctx, cabX + cabW - 6, cabY + 40, 6, 18, 2);
    
    // Headlight
    ctx.fillStyle = '#feca57'; // Yellow Light
    ctx.beginPath();
    ctx.arc(cabX + cabW - 2, cabY + 54, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#feca57';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Exhaust Pipe (Smoke Source)
    ctx.fillStyle = '#b2bec3';
    ctx.fillRect(cabX + 8, cabY - 28, 8, 35); // Vertical pipe
    ctx.fillStyle = '#636e72'; 
    ctx.beginPath();
    ctx.ellipse(cabX + 12, cabY - 28, 6, 2, 0, 0, Math.PI*2); // Top opening
    ctx.fill();

    // -- WHEELS --
    const wheelY = truckBaseY + 75;
    const wheelRotation = -(playerRef.current.distance * 0.05);

    const drawFancyWheel = (wx: number, wy: number) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(wheelRotation);
        
        // Tire
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI*2);
        ctx.fill();
        
        // Rim
        ctx.fillStyle = '#b2bec3'; 
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI*2);
        ctx.fill();
        
        // Spokes
        ctx.strokeStyle = '#636e72';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
        ctx.moveTo(0, -10); ctx.lineTo(0, 10);
        ctx.stroke();
        
        // Center Nut
        ctx.fillStyle = '#dfe6e9';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    };

    // Trailer Wheels
    drawFancyWheel(trailerX + 30, wheelY);
    drawFancyWheel(trailerX + 65, wheelY);
    
    // Cab Wheels
    drawFancyWheel(cabX + 25, wheelY);
    drawFancyWheel(cabX + 55, wheelY);

    ctx.restore();
  };

  // Loop
  const loop = () => {
    if (gameState === GameState.PLAYING) {
      update();
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx);
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  return (
    <canvas
      ref={canvasRef}
      width={GAME_WIDTH}
      height={GAME_HEIGHT}
      className="w-full h-full object-contain bg-neutral-900"
    />
  );
};
