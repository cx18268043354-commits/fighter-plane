export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER',
}

export enum EnemyType {
  BASIC = 'BASIC',     // Standard speed & health
  FAST = 'FAST',       // Highly agile, zigzags, low health
  HEAVY = 'HEAVY',     // Slow, high health, shoots back
}

export enum PowerUpType {
  SHIELD = 'SHIELD',
  TRIPLE_SHOT = 'TRIPLE_SHOT',
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  health: number;
  maxHealth: number;
  shield: boolean; // Has active forcefield
  invincible: boolean;
  invincibleTimer: number; // Duration in ticks/seconds
  tripleShotTimer: number; // Ticks remaining for triple shot
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: EnemyType;
  color: string;
  speedY: number;
  speedX: number; // For zigzagging behavior
  health: number;
  maxHealth: number;
  scoreValue: number;
  lastShotTime: number; // For heavy enemies shooting
  shootInterval: number; // in increments
  sineOffset?: number; // micro amplitude offsets
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  isPlayer: boolean;
  damage: number;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number; // Alpha decay rate per frame
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: PowerUpType;
  speedY: number;
  pulseScale: number;
  pulseDir: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: Date;
  icon: string; // lucide icon name
}
