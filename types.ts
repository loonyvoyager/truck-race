
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  PAUSED = 'PAUSED'
}

export enum Lane {
  TOP = 0,
  MIDDLE = 1,
  BOTTOM = 2
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type?: 'obstacle' | 'coin' | 'decoration';
  lane: Lane;
  // Specific visual properties
  subType?: 'tree' | 'building' | 'cone' | 'barrier' | 'rock' | 'crate' | 'barrel'; 
  destroyed?: boolean;
  collected?: boolean;
}

export interface SceneryEntity {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: 'house' | 'tree' | 'car' | 'mailbox' | 'cloud';
  details?: {
    roofColor?: string;
    doorColor?: string;
    carColor?: string;
    hasGarage?: boolean;
  };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface Player {
  lane: Lane;
  y: number; // Visual Y position (for smooth animation)
  speed: number; // Current movement speed
  distance: number; // Total distance traveled
  score: number;
  coins: number;
  tilt: number; // Rotation angle for lane changes
  bounce: number; // Vertical suspension offset
  invincible: number; // Frames remaining of invincibility
}

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const LANE_HEIGHT = 120; // Slightly tighter lanes for better proportion
export const LANE_START_Y = 320; // Lower horizon
export const PLAYER_X = 180;
