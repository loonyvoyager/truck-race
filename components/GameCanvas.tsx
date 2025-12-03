
import React, { useEffect, useRef, useCallback } from 'react';
import { GameState, GAME_WIDTH, GAME_HEIGHT, Lane, LANE_HEIGHT, LANE_START_Y, PLAYER_X, Entity, Player, Particle, SceneryEntity } from '../types';
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
  gameSessionId: number;
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

export const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, setScore, setCoins, onLifeLost, lives, gameSessionId }) => {
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
  const sceneryRef = useRef<SceneryEntity[]>([]);
  const frameCountRef = useRef(0);
  const nextSpawnDistanceRef = useRef(SAFE_ZONE);
  const nextScenerySpawnRef = useRef(0);
  
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
    sceneryRef.current = [];
    frameCountRef.current = 0;
    currentThemeRef.current = { ...THEMES[0] };
    playerRef.current.distance = 0; 
    nextSpawnDistanceRef.current = SAFE_ZONE;
    nextScenerySpawnRef.current = 0;
    setScore(0);
    setCoins(0);
  }, [setScore, setCoins]);

  // Reset logic is now strictly tied to the session ID provided by App.tsx
  useEffect(() => {
    resetGame();
  }, [gameSessionId, resetGame]);

  const spawnScenery = () => {
      // Scenery spawn logic (Parallax background)
      if (nextScenerySpawnRef.current > 0) {
          nextScenerySpawnRef.current -= (playerRef.current.speed * 0.5); // Parallax factor
          return;
      }

      const spawnX = GAME_WIDTH + 100;
      const groundY = LANE_START_Y - 20; // Grounded position
      
      const typeRoll = Math.random();
      
      if (typeRoll < 0.45) {
          // HOUSE
          const houseWidth = 140 + Math.random() * 40;
          const hasGarage = Math.random() > 0.5;
          const totalWidth = houseWidth + (hasGarage ? 70 : 0);
          
          sceneryRef.current.push({
              x: spawnX,
              y: groundY, 
              width: totalWidth,
              height: 90 + Math.random() * 30,
              color: ['#ffefc5', '#ffeaa7', '#fab1a0', '#74b9ff', '#a29bfe'][Math.floor(Math.random()*5)],
              type: 'house',
              details: {
                  roofColor: ['#ff7675', '#6c5ce7', '#e17055', '#2d3436'][Math.floor(Math.random()*4)],
                  hasGarage,
                  doorColor: '#d63031'
              }
          });
          
          // Maybe spawn a car in driveway
          if (hasGarage && Math.random() > 0.3) {
              sceneryRef.current.push({
                  x: spawnX + houseWidth + 5,
                  y: groundY + 10, // Slightly forward
                  width: 55,
                  height: 25,
                  color: ['#0984e3', '#d63031', '#00b894'][Math.floor(Math.random()*3)],
                  type: 'car',
                  details: { carColor: 'white' } 
              });
          }
          
          // Mailbox
          sceneryRef.current.push({
              x: spawnX - 25,
              y: groundY + 10,
              width: 10,
              height: 25,
              color: '#fff',
              type: 'mailbox'
          });

          nextScenerySpawnRef.current = totalWidth + 120 + Math.random() * 250;

      } else {
          // TREE
          sceneryRef.current.push({
              x: spawnX,
              y: groundY,
              width: 50 + Math.random() * 30,
              height: 100 + Math.random() * 50,
              color: '#00b894',
              type: 'tree'
          });
           nextScenerySpawnRef.current = 100 + Math.random() * 150;
      }
  };

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
      } else if (theme.name === 'Sunny Village' || theme.name === 'Idyllic Suburbia') {
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
      // Adjusted for Cute Truck stack position
      createSmoke(PLAYER_X + 110, player.y - 50 + player.bounce); 
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
    
    // Update Scenery (Parallax)
    spawnScenery();
    for (let i = sceneryRef.current.length - 1; i >= 0; i--) {
        const sc = sceneryRef.current[i];
        sc.x -= player.speed * 0.5; // Move slower than road
        if (sc.x + sc.width < -100) sceneryRef.current.splice(i, 1);
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
        l: PLAYER_X + 10, 
        r: PLAYER_X + 160, 
        t: player.y + 20, 
        b: player.y + 80
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

  const drawScenery = (ctx: CanvasRenderingContext2D) => {
      // Draw background scenery behind the road
      sceneryRef.current.forEach(sc => {
          ctx.save();
          
          // Shadow for all scenery
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.beginPath();
          ctx.ellipse(sc.x + sc.width/2, sc.y, sc.width/2 + 10, 8, 0, 0, Math.PI*2);
          ctx.fill();

          if (sc.type === 'house') {
              // Body
              ctx.fillStyle = sc.color;
              drawRoundedRect(ctx, sc.x, sc.y - sc.height, sc.width, sc.height, 4);
              
              // Roof (Varied)
              ctx.fillStyle = sc.details?.roofColor || '#333';
              ctx.beginPath();
              if (sc.width > 180) {
                 // Trapezoid roof for wide houses
                 ctx.moveTo(sc.x - 10, sc.y - sc.height);
                 ctx.lineTo(sc.x + sc.width + 10, sc.y - sc.height);
                 ctx.lineTo(sc.x + sc.width - 20, sc.y - sc.height - 40);
                 ctx.lineTo(sc.x + 20, sc.y - sc.height - 40);
              } else {
                 // Triangle roof
                 ctx.moveTo(sc.x - 10, sc.y - sc.height);
                 ctx.lineTo(sc.x + sc.width + 10, sc.y - sc.height);
                 ctx.lineTo(sc.x + sc.width / 2, sc.y - sc.height - 50);
              }
              ctx.fill();
              
              // Chimney
              ctx.fillStyle = '#636e72';
              ctx.fillRect(sc.x + 20, sc.y - sc.height - 30, 15, 25);
              
              // Door
              ctx.fillStyle = '#fff'; // Frame
              ctx.fillRect(sc.x + sc.width/2 - 17, sc.y - 42, 34, 42);
              ctx.fillStyle = sc.details?.doorColor || '#d63031';
              ctx.fillRect(sc.x + sc.width/2 - 15, sc.y - 40, 30, 40);
              // Knob
              ctx.fillStyle = '#fdcb6e';
              ctx.beginPath(); ctx.arc(sc.x + sc.width/2 + 8, sc.y - 20, 3, 0, Math.PI*2); ctx.fill();

              // Windows
              const drawWindow = (wx: number, wy: number) => {
                  ctx.fillStyle = '#fff'; // Frame
                  ctx.fillRect(wx - 2, wy - 2, 34, 34);
                  ctx.fillStyle = '#74b9ff'; // Glass
                  ctx.fillRect(wx, wy, 30, 30);
                  ctx.fillStyle = '#fff'; // Bars
                  ctx.fillRect(wx + 13, wy, 4, 30);
                  ctx.fillRect(wx, wy + 13, 30, 4);
                  // Reflection
                  ctx.fillStyle = 'rgba(255,255,255,0.4)';
                  ctx.beginPath(); ctx.moveTo(wx, wy+30); ctx.lineTo(wx+20, wy); ctx.lineTo(wx+30, wy); ctx.lineTo(wx+10, wy+30); ctx.fill();
              };

              drawWindow(sc.x + 20, sc.y - sc.height + 20);
              drawWindow(sc.x + sc.width - 50, sc.y - sc.height + 20);
              
              // Garage
              if (sc.details?.hasGarage) {
                  ctx.fillStyle = '#b2bec3';
                  drawRoundedRect(ctx, sc.x + sc.width - 75, sc.y - 50, 70, 50, 2);
                  // Garage lines
                  ctx.fillStyle = 'rgba(0,0,0,0.1)';
                  for(let i=1; i<5; i++) {
                      ctx.fillRect(sc.x + sc.width - 75, sc.y - 50 + (i*10), 70, 2);
                  }
              }
          } else if (sc.type === 'tree') {
              // Trunk
              ctx.fillStyle = '#a0522d'; // Sienna
              ctx.beginPath();
              ctx.moveTo(sc.x + sc.width/2 - 8, sc.y - 40);
              ctx.lineTo(sc.x + sc.width/2 + 8, sc.y - 40);
              ctx.lineTo(sc.x + sc.width/2 + 12, sc.y);
              ctx.lineTo(sc.x + sc.width/2 - 12, sc.y);
              ctx.fill();
              
              // Foliage - Fluffy cluster
              ctx.fillStyle = sc.color;
              const r = sc.width/2;
              const cy = sc.y - 60;
              ctx.beginPath(); ctx.arc(sc.x + sc.width/2, cy - 20, r, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(sc.x + sc.width/2 - 15, cy + 10, r * 0.8, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(sc.x + sc.width/2 + 15, cy + 10, r * 0.8, 0, Math.PI*2); ctx.fill();
              
          } else if (sc.type === 'mailbox') {
              ctx.fillStyle = '#636e72'; // Post
              ctx.fillRect(sc.x, sc.y - 20, 5, 20);
              ctx.fillStyle = '#fff'; // Box
              drawRoundedRect(ctx, sc.x - 5, sc.y - 30, 20, 12, 4);
              ctx.fillStyle = '#d63031'; // Flag
              ctx.fillRect(sc.x + 10, sc.y - 35, 2, 10);
              ctx.fillRect(sc.x + 10, sc.y - 35, 8, 5);

          } else if (sc.type === 'car') {
              ctx.fillStyle = sc.color;
              drawRoundedRect(ctx, sc.x, sc.y - 20, 60, 20, 4); // body
              ctx.fillStyle = '#81ecec';
              drawRoundedRect(ctx, sc.x + 10, sc.y - 30, 40, 15, 4); // cabin
              // wheels
              ctx.fillStyle = '#2d3436';
              ctx.beginPath(); ctx.arc(sc.x + 15, sc.y - 5, 8, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(sc.x + 45, sc.y - 5, 8, 0, Math.PI*2); ctx.fill();
          }
          ctx.restore();
      });
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const theme = currentThemeRef.current; // Use the interpolated theme
    const player = playerRef.current;

    // 1. Sky
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 2. Parallax Scenery Layer
    // Ground strip for scenery (Lawn/Sidewalk)
    ctx.fillStyle = theme.details; // Bushes color, usually green
    ctx.fillRect(0, LANE_START_Y - 30, GAME_WIDTH, 40);
    // Bevel
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, LANE_START_Y + 5, GAME_WIDTH, 5);

    drawScenery(ctx);

    // 3. Ground (Foreground)
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, LANE_START_Y, GAME_WIDTH, GAME_HEIGHT - LANE_START_Y);

    // 4. Road 
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

    // 5. Render Entities
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

    // 6. Particles (Smoke & Debris)
    particlesRef.current.forEach(p => {
       ctx.fillStyle = p.color;
       ctx.beginPath();
       ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
       ctx.fill();
    });

    // 7. Speed Lines
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

    const truckBaseX = x + 20;
    const truckBaseY = y + bounce + 10;

    // -- SHADOW --
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy + 45, 90, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // === TRAILER (Short and Chubby) ===
    const trailerX = truckBaseX;
    const trailerY = truckBaseY - 30;
    const trailerW = 80;
    const trailerH = 90;
    
    // Main Body
    ctx.fillStyle = '#feca57'; // Yellow
    drawRoundedRect(ctx, trailerX, trailerY, trailerW, trailerH, 12);
    // Stripe
    ctx.fillStyle = '#ff9f43';
    ctx.fillRect(trailerX, trailerY + 35, trailerW, 20);
    // Connection
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(trailerX + trailerW, trailerY + 60, 20, 15);


    // === CAB (Cute Rounded "Ivan") ===
    const cabX = truckBaseX + 90;
    const cabY = truckBaseY - 25;
    const cabW = 75;
    const cabH = 85;

    // 1. Cap/Visor
    ctx.fillStyle = '#0984e3'; // Bright Blue
    ctx.beginPath();
    ctx.roundRect(cabX, cabY - 10, cabW, 20, 10);
    ctx.fill();
    // Brim
    ctx.fillStyle = '#0984e3';
    ctx.beginPath();
    ctx.moveTo(cabX + cabW, cabY);
    ctx.quadraticCurveTo(cabX + cabW + 20, cabY + 5, cabX + cabW, cabY + 15);
    ctx.lineTo(cabX + cabW - 5, cabY + 15);
    ctx.fill();

    // 2. Main Body (Red Blob)
    ctx.fillStyle = '#ff6b6b'; // Red
    drawRoundedRect(ctx, cabX, cabY, cabW, cabH, 16);

    // 3. Windshield / Eye Area
    ctx.fillStyle = '#dff9fb'; // Very light cyan
    // Large rounded rect for glass
    ctx.beginPath();
    ctx.roundRect(cabX + 10, cabY + 10, cabW - 10, 40, 8);
    ctx.fill();
    
    // 4. Eyes (The Character)
    const eyeY = cabY + 30;
    // Left Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cabX + 45, eyeY, 12, 16, 0, 0, Math.PI*2); ctx.fill();
    // Right Eye
    ctx.beginPath(); ctx.ellipse(cabX + 68, eyeY, 12, 16, 0, 0, Math.PI*2); ctx.fill();
    
    // Pupils (Looking forward)
    ctx.fillStyle = '#2d3436';
    const bobEye = Math.sin(frameCountRef.current * 0.1) * 2;
    ctx.beginPath(); ctx.arc(cabX + 48 + bobEye, eyeY, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cabX + 71 + bobEye, eyeY, 5, 0, Math.PI*2); ctx.fill();
    
    // 5. Grill / Smile
    ctx.fillStyle = '#dfe6e9'; // Silver
    ctx.beginPath();
    // Smile shape grill
    ctx.roundRect(cabX + 40, cabY + 55, 35, 20, 10);
    ctx.fill();
    // Grid lines
    ctx.fillStyle = '#b2bec3';
    ctx.fillRect(cabX + 48, cabY + 55, 2, 20);
    ctx.fillRect(cabX + 57, cabY + 55, 2, 20);
    ctx.fillRect(cabX + 66, cabY + 55, 2, 20);

    // 6. Bumper
    ctx.fillStyle = '#636e72';
    drawRoundedRect(ctx, cabX + 35, cabY + 75, 45, 12, 6);


    // === WHEELS (Big & Chunky) ===
    const wheelY = truckBaseY + 65;
    const wheelRotation = -(playerRef.current.distance * 0.08); // Faster spin for smaller wheels effect

    const drawChunkyWheel = (wx: number, wy: number) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(wheelRotation);
        
        // Tire
        ctx.fillStyle = '#2d3436';
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI*2); ctx.fill();
        
        // Rim
        ctx.fillStyle = '#dfe6e9'; 
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
        
        // Nut
        ctx.fillStyle = '#ff7675'; // Red accent
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
        
        // Spokes (Cute rounded)
        ctx.fillStyle = '#636e72';
        ctx.beginPath(); ctx.arc(0, -8, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, 5, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-8, 5, 2, 0, Math.PI*2); ctx.fill();

        ctx.restore();
    };

    // Trailer Wheels
    drawChunkyWheel(trailerX + 25, wheelY);
    drawChunkyWheel(trailerX + 60, wheelY);
    
    // Cab Wheel
    drawChunkyWheel(cabX + 40, wheelY);

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
