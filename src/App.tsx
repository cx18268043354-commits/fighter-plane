import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Trophy, Shield, Zap, Play, Volume2, VolumeX, Pause, RotateCcw, 
  Gamepad2, Award, ChevronsUp, Heart, Info, X, Flame, Target, Star as StarIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Import local utilities and components
import { 
  GameState, EnemyType, PowerUpType, Player, Enemy, Bullet, Particle, PowerUp, Star, Achievement 
} from './types';
import { sound } from './audio';
import Sidebar from './components/Sidebar';
import AchievementToast from './components/AchievementToast';

// Canvas standard logical dimensions (scaled to fit responsive display)
const LOGICAL_WIDTH = 600;
const LOGICAL_HEIGHT = 800;

export default function App() {
  // Canvas and interaction references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  
  // Game Logic state variables in Refs for high performance loop without stale closures
  const playerRef = useRef<Player>({
    x: 276,
    y: 680,
    width: 48,
    height: 48,
    speed: 6.5,
    health: 3,
    maxHealth: 3,
    shield: false,
    invincible: false,
    invincibleTimer: 0,
    tripleShotTimer: 0,
  });

  const keysActive = useRef<{ [key: string]: boolean }>({});
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const starsRef = useRef<Star[]>([]);
  const lastTimeRef = useRef<number>(0);
  
  // Spawning frequencies & timing controls
  const enemySpawnTimer = useRef<number>(0);
  const enemySpawnInterval = useRef<number>(100); // lower = spawn faster
  const powerupSpawnTimer = useRef<number>(0);
  const shotCooldown = useRef<number>(0);
  
  // Scoring & Wave details
  const scoreRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const killsRef = useRef<number>(0);
  const tripleKillsRef = useRef<number>(0); // Tracker for "Triple shot carnage" achievement
  const tookDamageInLevel1 = useRef<boolean>(false);

  // Warning flashes indicators
  const borderFlashTimer = useRef<number>(0);
  const levelUpPromptTimer = useRef<number>(0);

  // React State for overlay UI updates (synchronized on major events to reduce re-render budget)
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('space_fighter_highscore') || '0');
    } catch {
      return 0;
    }
  });
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [playerLives, setPlayerLives] = useState<number>(3);
  const [shieldActive, setShieldActive] = useState<boolean>(false);
  const [weaponTimer, setWeaponTimer] = useState<number>(0); // countdown progress bar
  const [warningFlash, setWarningFlash] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  
  // Touch interactivity state support
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const touchActive = useRef<boolean>(false);
  const touchTargetX = useRef<number>(300);
  const touchTargetY = useRef<number>(600);

  // Achievements State
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: 'first-kill', name: '第一滴血 (First Blood)', description: '成功击毁第1架敌军战机', unlocked: false, icon: 'Sword' },
    { id: 'shield-master', name: '护盾大师 (Shield Master)', description: '在拥有护盾的情况下，成功抵挡并瓦解了一次危机伤害', unlocked: false, icon: 'Shield' },
    { id: 'triple-rampage', name: '火力全开 (Triple Rampage)', description: '在拾取三向子弹的狂暴期内，击毁5架敌军战机', unlocked: false, icon: 'Flame' },
    { id: 'survivor', name: '无伤幸存者 (Survivor)', description: '毫发未损地通过危险的第一关卡', unlocked: false, icon: 'Heart' },
    { id: 'expert-pilot', name: '王牌飞行员 (Ace Pilot)', description: '累积防卫得分超越 5000分', unlocked: false, icon: 'Trophy' },
    { id: 'unstoppable', name: '宇宙大主宰 (Unstoppable)', description: '坚忍卓越，挑战并踏足第 5 级战区', unlocked: false, icon: 'Zap' },
  ]);
  const [toastAchievement, setToastAchievement] = useState<Achievement | null>(null);

  // Initialize scrolling background stars
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.7 + 0.3,
      });
    }
    starsRef.current = stars;

    // Detect browser viewport dimensions
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || ('ontouchstart' in window));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save High Score helper
  const handleScoreUpdate = (newScore: number) => {
    scoreRef.current = newScore;
    setCurrentScore(newScore);
    if (newScore > highScore) {
      setHighScore(newScore);
      try {
        localStorage.setItem('space_fighter_highscore', newScore.toString());
      } catch (e) {
        console.warn(e);
      }
    }
    checkScoreAchievements(newScore);
  };

  // Sound Handler
  const toggleSoundConfig = () => {
    const nextState = sound.toggleSound();
    setSoundOn(nextState);
  };

  // Achievements unlocking function
  const unlockAchievement = (id: string) => {
    setAchievements(prev => {
      return prev.map(ach => {
        if (ach.id === id && !ach.unlocked) {
          // Play synth melody chime
          sound.playAchievementChime();
          
          const updatedAch = { ...ach, unlocked: true, unlockedAt: new Date() };
          // Set toast banner
          setToastAchievement(updatedAch);
          return updatedAch;
        }
        return ach;
      });
    });
  };

  // Scoring and level checks for achievements
  const checkScoreAchievements = (score: number) => {
    if (score >= 5000) {
      unlockAchievement('expert-pilot');
    }
  };

  // Reset Game States
  const resetGame = () => {
    // Player values
    playerRef.current = {
      x: LOGICAL_WIDTH / 2 - 24,
      y: 680,
      width: 48,
      height: 48,
      speed: 6.8,
      health: 3,
      maxHealth: 3,
      shield: false,
      invincible: false,
      invincibleTimer: 0,
      tripleShotTimer: 0,
    };
    
    // Arrays
    enemiesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    powerupsRef.current = [];
    keysActive.current = {};
    
    // Ticks & Timers
    enemySpawnTimer.current = 0;
    enemySpawnInterval.current = 100;
    powerupSpawnTimer.current = 0;
    shotCooldown.current = 0;
    
    // Score & Levels
    scoreRef.current = 0;
    levelRef.current = 1;
    killsRef.current = 0;
    tripleKillsRef.current = 0;
    tookDamageInLevel1.current = false;

    // Sync state
    setCurrentScore(0);
    setCurrentLevel(1);
    setPlayerLives(3);
    setShieldActive(false);
    setWeaponTimer(0);
    setWarningFlash(false);
  };

  // Handle Level Upgrade Trigger
  const triggerLevelUp = () => {
    const nextLevel = levelRef.current + 1;
    levelRef.current = nextLevel;
    setCurrentLevel(nextLevel);
    
    // Level up effects
    sound.playLevelUp();
    levelUpPromptTimer.current = 45; // Display Level Up banner text for 45 frames
    
    // Wipe current enemies cleanly with particles
    enemiesRef.current.forEach(enemy => {
      spawnEnemyExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.type);
    });
    enemiesRef.current = [];

    // Partially restore health as reward
    if (playerRef.current.health < playerRef.current.maxHealth) {
      playerRef.current.health += 1;
      setPlayerLives(playerRef.current.health);
    }

    // Double-check Survivor achievement
    if (nextLevel === 2 && !tookDamageInLevel1.current) {
      unlockAchievement('survivor');
    }

    // Level 5 achievement check
    if (nextLevel >= 5) {
      unlockAchievement('unstoppable');
    }

    // Shrink spawn interval (faster difficulty scaling)
    enemySpawnInterval.current = Math.max(35, 100 - (nextLevel - 1) * 12);
  };

  // Spawn visual particle explosions
  const spawnEnemyExplosion = (x: number, y: number, type: EnemyType) => {
    let count = 15;
    let baseColor = '#ef4444'; // Red for Basic
    
    if (type === EnemyType.FAST) {
      count = 12;
      baseColor = '#10b981'; // Lime Green
    } else if (type === EnemyType.HEAVY) {
      count = 35;
      baseColor = '#a855f7'; // Purple-indigo
    }

    // Sparks
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 1.5;
      particlesRef.current.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3.5 + 1.2,
        color: baseColor,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.015,
      });
    }

    // Heavy units produce nice central white core flare and dynamic shockwave rings
    if (type === EnemyType.HEAVY) {
      // White sparks
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        particlesRef.current.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 2 + 1,
          color: '#ffffff',
          alpha: 1,
          decay: 0.04,
        });
      }
    }
  };

  // Player hit splash effects
  const spawnPlayerHurtEffect = (x: number, y: number) => {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particlesRef.current.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 1,
        color: '#06b6d4', // Cyan electric energy sparks
        alpha: 1,
        decay: 0.03,
      });
    }
  };

  // Powerup float pickups
  const spawnPickupSparkles = (x: number, y: number, type: PowerUpType) => {
    const color = type === PowerUpType.SHIELD ? '#22d3ee' : '#e879f9';
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particlesRef.current.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.5 + 1,
        color: color,
        alpha: 0.9,
        decay: 0.025,
      });
    }
  };

  // Action: Launch lasers
  const fireLaser = () => {
    if (gameState !== GameState.PLAYING) return;
    
    const p = playerRef.current;
    
    // Play synthesizer arcade sound
    sound.playLaser(p.tripleShotTimer > 0);

    if (p.tripleShotTimer > 0) {
      // Bullet 1: Straight up
      bulletsRef.current.push({
        id: Math.random().toString(),
        x: p.x + p.width / 2,
        y: p.y,
        radius: 3.5,
        speedX: 0,
        speedY: -11.5,
        isPlayer: true,
        damage: 100,
        color: '#f472b6', // hot pink
      });
      // Bullet 2: Left spread angle
      bulletsRef.current.push({
        id: Math.random().toString(),
        x: p.x + p.width / 4,
        y: p.y + 10,
        radius: 3,
        speedX: -3.2,
        speedY: -10.5,
        isPlayer: true,
        damage: 100,
        color: '#f472b6',
      });
      // Bullet 3: Right spread angle
      bulletsRef.current.push({
        id: Math.random().toString(),
        x: p.x + (p.width * 3) / 4,
        y: p.y + 10,
        radius: 3,
        speedX: 3.2,
        speedY: -10.5,
        isPlayer: true,
        damage: 100,
        color: '#f472b6',
      });
    } else {
      // Standard single cyan laser
      bulletsRef.current.push({
        id: Math.random().toString(),
        x: p.x + p.width / 2,
        y: p.y,
        radius: 3,
        speedX: 0,
        speedY: -13,
        isPlayer: true,
        damage: 100,
        color: '#22d3ee', // bright cyan
      });
    }
    shotCooldown.current = p.tripleShotTimer > 0 ? 11 : 14; // cooldown in ticks
  };

  // Start actual game looping
  const startGame = () => {
    // Initiate context gracefully on user gesture input
    sound.playLaser(false); 
    resetGame();
    setGameState(GameState.PLAYING);
  };

  const handlePauseToggle = () => {
    if (gameState === GameState.PLAYING) {
      setGameState(GameState.PAUSED);
    } else if (gameState === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
    }
  };

  const quitToMainMenu = () => {
    setGameState(GameState.START);
    resetGame();
  };

  // Keyboard Event Binders
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && gameState === GameState.PLAYING) {
        e.preventDefault();
      }
      keysActive.current[e.code] = true;

      // P Key for Pause
      if (e.code === 'KeyP') {
        handlePauseToggle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysActive.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Main Canvas Real-time Tick Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localAnimationFrameId: number;

    const gameTick = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const progress = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Update Screen Drawing Width & Height dynamically matching display wrapper boundaries
      const rect = canvas.parentElement?.getBoundingClientRect();
      const parentWidth = rect?.width || 600;
      const parentHeight = rect?.height || 800;

      if (canvas.width !== parentWidth || canvas.height !== parentHeight) {
        canvas.width = parentWidth;
        canvas.height = parentHeight;
      }

      // Reset and refresh matrix drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save drawing layer
      ctx.save();
      // Apply stretching system scaling from fixed logical units (600x800) to actual monitor canvas width/height
      const scaleX = canvas.width / LOGICAL_WIDTH;
      const scaleY = canvas.height / LOGICAL_HEIGHT;
      ctx.scale(scaleX, scaleY);

      // 1. Draw Space background starry skies
      starsRef.current.forEach(star => {
        // Scroll stars downwards based on individual relative speeds
        if (gameState === GameState.PLAYING) {
          star.y += star.speed;
        } else {
          star.y += star.speed * 0.15; // move very slowly when paused/started
        }
        
        if (star.y > LOGICAL_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * LOGICAL_WIDTH;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = star.size > 2 ? 6 : 0;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0; // reset shadows

      // Ambient Nebular gas glows
      const gradient = ctx.createRadialGradient(
        LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 50,
        LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 400
      );
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.4)');
      gradient.addColorStop(0.5, 'rgba(8, 47, 73, 0.15)');
      gradient.addColorStop(1, 'rgba(2, 6, 23, 0.9)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // 2. Physics & Engine calculations when Playing active
      if (gameState === GameState.PLAYING) {
        // Player translation processing
        const p = playerRef.current;
        let dx = 0;
        let dy = 0;

        // A. Desktop inputs
        if (keysActive.current['KeyA'] || keysActive.current['ArrowLeft']) dx = -p.speed;
        if (keysActive.current['KeyD'] || keysActive.current['ArrowRight']) dx = p.speed;
        if (keysActive.current['KeyW'] || keysActive.current['ArrowUp']) dy = -p.speed;
        if (keysActive.current['KeyS'] || keysActive.current['ArrowDown']) dy = p.speed;

        // B. Touch or Mouse drags inputs (drag relative translation targeting)
        if (touchActive.current) {
          const tarX = touchTargetX.current;
          const tarY = touchTargetY.current;
          
          // Smoothed direct interpolation towards touch focus points
          const distanceX = tarX - (p.x + p.width / 2);
          const distanceY = tarY - (p.y + p.height / 2);
          
          if (Math.abs(distanceX) > 4) {
            dx = Math.sign(distanceX) * Math.min(Math.abs(distanceX) * 0.22, p.speed * 1.3);
          }
          if (Math.abs(distanceY) > 4) {
            dy = Math.sign(distanceY) * Math.min(Math.abs(distanceY) * 0.22, p.speed * 1.3);
          }
        }

        p.x += dx;
        p.y += dy;

        // Boundaries constraint clamping
        p.x = Math.max(0, Math.min(LOGICAL_WIDTH - p.width, p.x));
        p.y = Math.max(100, Math.min(LOGICAL_HEIGHT - p.height - 20, p.y));

        // Rapid laser trigger timers
        if (shotCooldown.current > 0) {
          shotCooldown.current--;
        } else {
          // ALWAYS AUTO-FIRE by default during active battle!
          // This eliminates keyboard key rollover/ghosting limitations and matches modern arcade feel.
          fireLaser();
        }

        // Weapon buff decrementers
        if (p.tripleShotTimer > 0) {
          p.tripleShotTimer--;
          // Sync weapon timer slider back to UI components precisely
          if (p.tripleShotTimer % 10 === 0) {
            setWeaponTimer(Math.max(0, Math.round((p.tripleShotTimer / 600) * 100)));
          }
        }

        // Player invincibility tickers
        if (p.invincible) {
          p.invincibleTimer--;
          if (p.invincibleTimer <= 0) {
            p.invincible = false;
          }
        }

        // --- ENEMY SPAWN MECHANIC ---
        enemySpawnTimer.current++;
        if (enemySpawnTimer.current >= enemySpawnInterval.current) {
          enemySpawnTimer.current = 0;
          
          // Weighted randomize selection based on active Levels
          const rng = Math.random() * 100;
          let type = EnemyType.BASIC;
          let color = '#f87171'; // pale red
          let maxHP = 100;
          let scoreValue = 100;
          let speedVal = 1.8 + levelRef.current * 0.35;

          // Introduce fast agility & heavy units after Wave levels increase
          if (levelRef.current >= 2 && rng > 65 && rng <= 88) {
            type = EnemyType.FAST;
            color = '#34d399'; // green emerald
            maxHP = 50;
            scoreValue = 200;
            speedVal = 3.2 + levelRef.current * 0.42;
          } else if (levelRef.current >= 3 && rng > 88) {
            type = EnemyType.HEAVY;
            color = '#c084fc'; // purple neon
            maxHP = 320;
            scoreValue = 400;
            speedVal = 1.0 + levelRef.current * 0.22;
          }

          // Generate randomized initial offsets
          enemiesRef.current.push({
            id: Math.random().toString(),
            x: Math.random() * (LOGICAL_WIDTH - 60) + 10,
            y: -50,
            width: type === EnemyType.HEAVY ? 64 : 42,
            height: type === EnemyType.HEAVY ? 64 : 42,
            type: type,
            color: color,
            speedY: speedVal,
            speedX: type === EnemyType.FAST ? (Math.random() > 0.5 ? 2.5 : -2.5) : 0,
            health: maxHP,
            maxHealth: maxHP,
            scoreValue: scoreValue,
            lastShotTime: 0,
            shootInterval: 140 - Math.min(levelRef.current * 10, 60), // shoot interval ticks
            sineOffset: Math.random() * 80,
          });
        }

        // --- POWER UP ITEM SPAWNING ---
        powerupSpawnTimer.current++;
        if (powerupSpawnTimer.current >= 540) { // every 9 seconds, evaluate spawning a buff item
          powerupSpawnTimer.current = 0;
          
          // Randomize diamond layout placement
          const type = Math.random() > 0.55 ? PowerUpType.SHIELD : PowerUpType.TRIPLE_SHOT;
          powerupsRef.current.push({
            id: Math.random().toString(),
            x: Math.random() * (LOGICAL_WIDTH - 80) + 40,
            y: -40,
            width: 32,
            height: 32,
            type: type,
            speedY: 2.2,
            pulseScale: 1.0,
            pulseDir: 0.02,
          });
        }

        // --- BULLET UPDATES & TRANSLATIONS ---
        bulletsRef.current.forEach((bullet, index) => {
          bullet.x += bullet.speedX;
          bullet.y += bullet.speedY;
        });

        // Filter out bullets which left bounds
        bulletsRef.current = bulletsRef.current.filter(
          b => b.y > -20 && b.y < LOGICAL_HEIGHT + 20 && b.x > -20 && b.x < LOGICAL_WIDTH + 20
        );

        // --- ENEMY BULLETS AUTO-SHOOT FOR HEAVY BASES ---
        enemiesRef.current.forEach(enemy => {
          if (enemy.type === EnemyType.HEAVY) {
            enemy.lastShotTime++;
            if (enemy.lastShotTime >= enemy.shootInterval) {
              enemy.lastShotTime = 0;
              // Target directly toward the Player fighter coordinates
              const dx = (playerRef.current.x + playerRef.current.width/2) - (enemy.x + enemy.width/2);
              const dy = (playerRef.current.y + playerRef.current.height/2) - (enemy.y + enemy.height/2);
              const distance = Math.sqrt(dx*dx + dy*dy);
              
              // Standard constant Bullet speedY vector
              const baseSpeed = 4.2;
              bulletsRef.current.push({
                id: Math.random().toString(),
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height + 2,
                radius: 5,
                speedX: (dx / distance) * baseSpeed,
                speedY: Math.max(1.8, (dy / distance) * baseSpeed), // avoid moving up heavily
                isPlayer: false,
                damage: 1,
                color: '#ec4899', // bright pink-violet bullet
              });
            }
          }
        });

        // --- ENEMY PHYSICS & SWAYS TRANSLATION ---
        enemiesRef.current.forEach(enemy => {
          enemy.y += enemy.speedY;

          // Zigzag horizontal offsets for FAST type scout units
          if (enemy.type === EnemyType.FAST) {
            enemy.sineOffset! += 0.08;
            enemy.x += Math.sin(enemy.sineOffset!) * 1.8;
            
            // Constrain left/right limits
            if (enemy.x < 10 || enemy.x > LOGICAL_WIDTH - 52) {
              enemy.x = Math.max(10, Math.min(LOGICAL_WIDTH - 52, enemy.x));
            }
          }
        });

        // --- DISMISS ESCAPED ENEMIES & SUBTRACT SCORING PENALTIES ---
        const escapedCount = enemiesRef.current.filter(e => e.y > LOGICAL_HEIGHT).length;
        if (escapedCount > 0) {
          // Deduct score as penalty
          const penalty = escapedCount * 50;
          const targetScore = Math.max(0, scoreRef.current - penalty);
          handleScoreUpdate(targetScore);
          
          // Trigger Red border warning flash
          borderFlashTimer.current = 14;
          setWarningFlash(true);

          // Clear those escaped elements
          enemiesRef.current = enemiesRef.current.filter(e => e.y <= LOGICAL_HEIGHT);
        }

        // --- POWER UP ITINERARY TRANSLATION ---
        powerupsRef.current.forEach(pUp => {
          pUp.y += pUp.speedY;
          
          // Glowing scale pulses animation
          pUp.pulseScale += pUp.pulseDir;
          if (pUp.pulseScale > 1.25 || pUp.pulseScale < 0.85) {
            pUp.pulseDir = -pUp.pulseDir;
          }
        });

        // Clear out-of-screen power ups
        powerupsRef.current = powerupsRef.current.filter(pUp => pUp.y < LOGICAL_HEIGHT + 20);

        // --- COLLISION DETECTION MODULE ---
        // A. PLAYER LASER BULLETS vs ENEMIES
        for (let bIdx = bulletsRef.current.length - 1; bIdx >= 0; bIdx--) {
          const bullet = bulletsRef.current[bIdx];
          if (!bullet.isPlayer) continue;

          for (let eIdx = enemiesRef.current.length - 1; eIdx >= 0; eIdx--) {
            const enemy = enemiesRef.current[eIdx];

            // Bounding box collider
            if (
              bullet.x >= enemy.x &&
              bullet.x <= enemy.x + enemy.width &&
              bullet.y >= enemy.y &&
              bullet.y <= enemy.y + enemy.height
            ) {
              // Deem bullet vanished
              bulletsRef.current.splice(bIdx, 1);

              // Subtract enemy health
              enemy.health -= bullet.damage;
              
              // Spark particles on direct damage hit
              for (let s = 0; s < 4; s++) {
                particlesRef.current.push({
                  x: bullet.x,
                  y: bullet.y,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  radius: Math.random() * 2 + 0.8,
                  color: '#ffffff',
                  alpha: 0.9,
                  decay: 0.05,
                });
              }

              if (enemy.health <= 0) {
                // Delete enemy and execute explosion particle burst
                enemiesRef.current.splice(eIdx, 1);
                spawnEnemyExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.type);
                sound.playExplosion(enemy.type);

                // Update kills
                const nextKills = killsRef.current + 1;
                killsRef.current = nextKills;

                // Fire special tracking for triple-kills achievement
                if (playerRef.current.tripleShotTimer > 0) {
                  tripleKillsRef.current++;
                  if (tripleKillsRef.current >= 5) {
                    unlockAchievement('triple-rampage');
                  }
                }

                // Standard kills achievements checks
                if (nextKills >= 1) {
                  unlockAchievement('first-kill');
                }

                // Increment score stats
                const nextScore = scoreRef.current + enemy.scoreValue;
                handleScoreUpdate(nextScore);

                // Score thresholds trigger immediate Level-Up check (every 2200 points)
                if (nextScore >= levelRef.current * 2200) {
                  triggerLevelUp();
                }
              }
              break; // break enemy iteration for this laser bullet
            }
          }
        }

        // B. POWERUP PICKS vs PLAYER
        const player = playerRef.current;
        for (let pIdx = powerupsRef.current.length - 1; pIdx >= 0; pIdx--) {
          const pUp = powerupsRef.current[pIdx];

          // AABB Collision bounds box check
          if (
            pUp.x + pUp.width >= player.x &&
            pUp.x <= player.x + player.width &&
            pUp.y + pUp.height >= player.y &&
            pUp.y <= player.y + player.height
          ) {
            // Delete powerup
            powerupsRef.current.splice(pIdx, 1);
            
            // Visual sparkles & pick buzzer synth SFX
            spawnPickupSparkles(pUp.x + pUp.width / 2, pUp.y + pUp.height / 2, pUp.type);
            sound.playPowerUp(pUp.type);

            if (pUp.type === PowerUpType.SHIELD) {
              player.shield = true;
              setShieldActive(true);
            } else if (pUp.type === PowerUpType.TRIPLE_SHOT) {
              player.tripleShotTimer = 600; // 10 seconds (60 FPS * 10)
              setWeaponTimer(100);
            }
          }
        }

        // C. ENEMY UNITS OR ENEMY BULLETS COLLIDE WITH PLAYER FIGHTER (CRITICAL DAMAGE)
        if (!player.invincible) {
          let playerHurt = false;

          // bullet-to-player
          for (let bIdx = bulletsRef.current.length - 1; bIdx >= 0; bIdx--) {
            const bullet = bulletsRef.current[bIdx];
            if (bullet.isPlayer) continue;

            const bRadius = bullet.radius;
            // Circular vs Box collision approx
            const closestX = Math.max(player.x, Math.min(bullet.x, player.x + player.width));
            const closestY = Math.max(player.y, Math.min(bullet.y, player.y + player.height));
            const distX = bullet.x - closestX;
            const distY = bullet.y - closestY;
            const bDist = distX*distX + distY*distY;

            if (bDist <= bRadius * bRadius) {
              // erase bullet
              bulletsRef.current.splice(bIdx, 1);
              playerHurt = true;
              break;
            }
          }

          // ship-to-ship crash
          if (!playerHurt) {
            for (let eIdx = enemiesRef.current.length - 1; eIdx >= 0; eIdx--) {
              const enemy = enemiesRef.current[eIdx];
              if (
                enemy.x + enemy.width >= player.x &&
                enemy.x <= player.x + player.width &&
                enemy.y + enemy.height >= player.y &&
                enemy.y <= player.y + player.height
              ) {
                // Erase crashed enemy unit immediately with visual fireworks explosion
                enemiesRef.current.splice(eIdx, 1);
                spawnEnemyExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.type);
                sound.playExplosion(enemy.type);
                playerHurt = true;
                break;
              }
            }
          }

          if (playerHurt) {
            // Evaluated damage handling based on Shield statuses
            if (player.shield) {
              // Shield absorbed completely!
              player.shield = false;
              setShieldActive(false);
              
              // Cool visual disintegrating shockwave sparks
              spawnPlayerHurtEffect(player.x + player.width / 2, player.y + player.height / 2);
              
              // Shield Master achievement unlocked safely
              unlockAchievement('shield-master');
              
              // Brief safe grace invincibility duration
              player.invincible = true;
              player.invincibleTimer = 45; // 0.75 seconds of flash
            } else {
              // Inflict health damage
              player.health -= 1;
              setPlayerLives(player.health);
              
              // Track damage in level-1
              if (levelRef.current === 1) {
                tookDamageInLevel1.current = true;
              }

              // Play hurt low synth SFX
              sound.playHurt();
              spawnPlayerHurtEffect(player.x + player.width / 2, player.y + player.height / 2);

              if (player.health <= 0) {
                // Game Over sequence!
                sound.playExplosion('PLAYER');
                
                // Exploding player sparks
                for (let j = 0; j < 45; j++) {
                  const angle = Math.random() * Math.PI * 2;
                  const speed = Math.random() * 8 + 3;
                  particlesRef.current.push({
                    x: player.x + player.width / 2,
                    y: player.y + player.height / 2,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    radius: Math.random() * 5 + 2,
                    color: '#ffffff',
                    alpha: 1,
                    decay: 0.02,
                  });
                }
                
                // Trigger transition
                setGameState(GameState.GAMEOVER);
              } else {
                // Apply temporary 1.5 seconds general immunity frames
                player.invincible = true;
                player.invincibleTimer = 90;
              }
            }
          }
        }
      }

      // --- GENERAL DEBRIS PARTICLES MOTION ---
      particlesRef.current.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        
        // apply slight drag
        p.vx *= 0.965;
        p.vy *= 0.965;
        
        p.alpha -= p.decay;
      });

      // Filter out vanished particles
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);


      // 3. CANVAS GRAPHICAL RENDER OUTLINES
      // A. DRAW EXPLOSION DEBRIS DETAILS
      particlesRef.current.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // B. DRAW FLOATING UPGRADES ITEMS
      powerupsRef.current.forEach(pUp => {
        ctx.save();
        const centerX = pUp.x + pUp.width / 2;
        const centerY = pUp.y + pUp.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.scale(pUp.pulseScale, pUp.pulseScale);

        // Define neon colors
        const glowColor = pUp.type === PowerUpType.SHIELD ? '#22d3ee' : '#e0f2fe';
        const outlineColor = pUp.type === PowerUpType.SHIELD ? '#06b6d4' : '#d946ef';

        // Outer Hexagon
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const angle = (Math.PI / 3) * s;
          const xPos = Math.cos(angle) * 16;
          const yPos = Math.sin(angle) * 16;
          if (s === 0) ctx.moveTo(xPos, yPos);
          else ctx.lineTo(xPos, yPos);
        }
        ctx.closePath();
        
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = outlineColor;
        ctx.shadowBlur = 12;
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fill();

        // Innermost letter icons core
        ctx.fillStyle = glowColor;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = pUp.pulseScale > 1.0 ? 15 : 6;
        ctx.fillText(pUp.type === PowerUpType.SHIELD ? 'S' : 'T', 0, 0);

        ctx.restore();
      });

      // C. DRAW INCOMING ENEMY SPACESHIPS
      enemiesRef.current.forEach(enemy => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);

        // Customize layout outlines depending on Enemy Types
        if (enemy.type === EnemyType.BASIC) {
          // --- BASIC STEALTH JET FIGHTER (Matches the user's uploaded image exactly) ---
          const w = enemy.width;
          const h = enemy.height;

          // 1. Dual Glowing Amber/Orange Engine Plumes firing upwards (backwards)
          if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) {
            const fLeft = 8 + Math.random() * 10;
            const fRight = 8 + Math.random() * 10;

            const drawEnemyFlame = (cx: number, cy: number, pW: number, pY: number) => {
              ctx.save();
              const flameGrad = ctx.createLinearGradient(cx, cy, cx, cy - pY);
              flameGrad.addColorStop(0, '#ffffff'); // super thermal core
              flameGrad.addColorStop(0.2, '#ff8c00'); // glowing amber
              flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
              ctx.fillStyle = flameGrad;
              ctx.shadowColor = '#ff4d00';
              ctx.shadowBlur = pW * 1.8;

              ctx.beginPath();
              ctx.moveTo(cx - pW / 2, cy);
              ctx.lineTo(cx, cy - pY);
              ctx.lineTo(cx + pW / 2, cy);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            };

            drawEnemyFlame(w * 0.34, h * 0.16, 5, fLeft);
            drawEnemyFlame(w * 0.66, h * 0.16, 5, fRight);
          }

          // 2. Twin back stabilizer fins (Outward angled tail elevators)
          ctx.save();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = '#ff5500';
          ctx.shadowColor = '#ff5100';
          ctx.shadowBlur = 6;
          ctx.fillStyle = '#1c1917';

          // Left Fin
          ctx.beginPath();
          ctx.moveTo(w * 0.34, h * 0.18);
          ctx.lineTo(w * 0.18, -2);
          ctx.lineTo(w * 0.28, -2);
          ctx.lineTo(w * 0.38, h * 0.14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Right Fin
          ctx.beginPath();
          ctx.moveTo(w * 0.66, h * 0.18);
          ctx.lineTo(w * 0.82, -2);
          ctx.lineTo(w * 0.72, -2);
          ctx.lineTo(w * 0.62, h * 0.14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // 3. Main Swept Wing & Core Fuselage Geometry
          ctx.beginPath();
          ctx.moveTo(w / 2, h); // Pointed Nose apex at bottom
          ctx.quadraticCurveTo(w * 0.15, h * 0.6, 0, h * 0.44); // Left wing leading edge
          ctx.lineTo(0, h * 0.36); // Wingtip slice
          ctx.quadraticCurveTo(w * 0.24, h * 0.32, w * 0.32, h * 0.18); // Left wing trailing inward
          ctx.lineTo(w / 2, h * 0.24); // Fuselage junction base
          ctx.lineTo(w * 0.68, h * 0.18); // Right fuselage trailing junction
          ctx.quadraticCurveTo(w * 0.76, h * 0.32, w, h * 0.36); // Right wing trailing outwards
          ctx.lineTo(w, h * 0.44); // Right wingtip slice
          ctx.quadraticCurveTo(w * 0.85, h * 0.6, w / 2, h); // Right wing leading edge
          ctx.closePath();

          const enemyGrad = ctx.createLinearGradient(0, 0, 0, h);
          enemyGrad.addColorStop(0, '#27272a'); // Zinc metal structure
          enemyGrad.addColorStop(0.5, '#09090b'); // Dark carbon steel
          enemyGrad.addColorStop(1, '#18181b'); // Tapered metallic reflection

          ctx.fillStyle = enemyGrad;
          ctx.strokeStyle = '#ff4500';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#ff4500';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.stroke();

          // 4. Glow-Strips/Orange conduction conduits along Wing Edges (Aesthetic of image)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(w / 2, h - 2);
          ctx.quadraticCurveTo(w * 0.18, h * 0.58, 2, h * 0.43);
          ctx.moveTo(w / 2, h - 2);
          ctx.quadraticCurveTo(w * 0.82, h * 0.58, w - 2, h * 0.43);
          ctx.strokeStyle = '#ff8800';
          ctx.lineWidth = 1.8;
          ctx.shadowColor = '#ffaa00';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();

          // 5. Dark Central Canopy Cockpit mound
          ctx.save();
          const capGrad = ctx.createLinearGradient(0, h * 0.32, 0, h * 0.56);
          capGrad.addColorStop(0, '#0a0a0c');
          capGrad.addColorStop(0.5, '#451a03'); // rich brown-orange glass reflection
          capGrad.addColorStop(1, '#ff6a00'); // front canopy amber glow
          ctx.fillStyle = capGrad;
          ctx.strokeStyle = '#ffaa00';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.ellipse(w / 2, h * 0.44, w * 0.12, h * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

        } else if (enemy.type === EnemyType.FAST) {
          // --- FAST HYPERSONIC GHOST-FIGHTER (Supersonic blue multi-plume interceptor matching the uploaded image) ---
          const w = enemy.width;
          const h = enemy.height;

          // 1. Four (4) parallel high-intensity Glowing Cyan/Blue Jet Plumes (2 on each wing underside, firing backwards/upwards)
          if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) {
            // Random flame flicker heights
            const flameL1 = 12 + Math.random() * 12;
            const flameL2 = 10 + Math.random() * 10;
            const flameR1 = 12 + Math.random() * 12;
            const flameR2 = 10 + Math.random() * 10;

            const drawSupersonicFlame = (cx: number, cy: number, pW: number, pY: number) => {
              ctx.save();
              const flameGrad = ctx.createLinearGradient(cx, cy, cx, cy - pY);
              flameGrad.addColorStop(0, '#ffffff');             // Hot white focus core
              flameGrad.addColorStop(0.2, '#00bfff');           // Deep electric sky-blue
              flameGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.5)'); // Semi-lucent cyan halo
              flameGrad.addColorStop(1, 'rgba(0, 191, 255, 0)');     // Gradual dissipation
              ctx.fillStyle = flameGrad;
              ctx.shadowColor = '#00f0ff';
              ctx.shadowBlur = pW * 2.2;

              ctx.beginPath();
              ctx.moveTo(cx - pW / 2, cy);
              ctx.lineTo(cx, cy - pY);
              ctx.lineTo(cx + pW / 2, cy);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            };

            // Left engine outer & inner plumes
            drawSupersonicFlame(w * 0.16, h * 0.36, 4.5, flameL1);
            drawSupersonicFlame(w * 0.28, h * 0.32, 4.5, flameL2);

            // Right engine inner & outer plumes
            drawSupersonicFlame(w * 0.72, h * 0.32, 4.5, flameR2);
            drawSupersonicFlame(w * 0.84, h * 0.36, 4.5, flameR1);
          }

          // 2. Twin close-mounted back vertical stabilizer elevators (Angled parallel fins at top rear)
          ctx.save();
          ctx.lineWidth = 1.0;
          ctx.strokeStyle = '#00d8ff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 5;
          ctx.fillStyle = '#27272a'; // metallic darker stabilizer structures

          // Left Upright Stabilizer Fin
          ctx.beginPath();
          ctx.moveTo(w * 0.44, h * 0.18);
          ctx.lineTo(w * 0.40, -4);
          ctx.lineTo(w * 0.44, -4);
          ctx.lineTo(w * 0.47, h * 0.14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Right Upright Stabilizer Fin
          ctx.beginPath();
          ctx.moveTo(w * 0.56, h * 0.18);
          ctx.lineTo(w * 0.60, -4);
          ctx.lineTo(w * 0.56, -4);
          ctx.lineTo(w * 0.53, h * 0.14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // 3. Forward Sweeping Supersonic Main Wings & Needle Fuselage
          ctx.beginPath();
          ctx.moveTo(w / 2, h); // Needle-sharp nose pointing straight down
          ctx.bezierCurveTo(w * 0.25, h * 0.65, 0, h * 0.5, 0, h * 0.38); // Swept wing forward leading edge
          ctx.lineTo(w * 0.05, h * 0.3); // Wingtip slice
          ctx.quadraticCurveTo(w * 0.28, h * 0.26, w * 0.38, h * 0.18); // Trailing edge merging inwards
          ctx.lineTo(w / 2, h * 0.24); // Rear spine base
          ctx.lineTo(w * 0.62, h * 0.18); // Symmetry matching right
          ctx.quadraticCurveTo(w * 0.72, h * 0.26, w * 0.95, h * 0.3);
          ctx.lineTo(w, h * 0.38);
          ctx.bezierCurveTo(w, h * 0.5, w * 0.75, h * 0.65, w / 2, h);
          ctx.closePath();

          const fastGrad = ctx.createLinearGradient(0, 0, 0, h);
          fastGrad.addColorStop(0, '#3f3f46');      // Titanium gray head casing
          fastGrad.addColorStop(0.3, '#1c1917');    // Dark burner steel
          fastGrad.addColorStop(0.7, '#27272a');    // Polished carbon composite
          fastGrad.addColorStop(1, '#52525b');      // Nose metal reflect panel

          ctx.fillStyle = fastGrad;
          ctx.strokeStyle = '#00d8ff';
          ctx.lineWidth = 1.6;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 9;
          ctx.fill();
          ctx.stroke();

          // 4. Glowing Cyan Panel Trim conduits along wing roots of the fighter
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(w / 2, h - 3);
          ctx.quadraticCurveTo(w * 0.26, h * 0.6, w * 0.05, h * 0.4);
          ctx.moveTo(w / 2, h - 3);
          ctx.quadraticCurveTo(w * 0.74, h * 0.6, w * 0.95, h * 0.4);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.8;
          ctx.shadowColor = '#00ffea';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();

          // 5. Tactical cockpit canopy windshield
          ctx.save();
          const canopyGrad = ctx.createLinearGradient(0, h * 0.35, 0, h * 0.58);
          canopyGrad.addColorStop(0, '#09090b');
          canopyGrad.addColorStop(0.5, '#0c4a6e'); // deep blue ocean cockpit glass
          canopyGrad.addColorStop(1, '#00d8ff'); // electric cyan light reflection
          ctx.fillStyle = canopyGrad;
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.ellipse(w / 2, h * 0.46, w * 0.08, h * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

        } else {
          // --- HEAVY CAPITAL CRUISER (Colossal Magenta Mother-Dreadnaught) ---
          const w = enemy.width;
          const h = enemy.height;

          // 1. Triple Colossal thrusters
          if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) {
            const f1 = 12 + Math.random() * 15;
            const f2 = 12 + Math.random() * 15;
            const f3 = 16 + Math.random() * 18;

            const drawHeavyFlame = (cx: number, cy: number, pW: number, pY: number) => {
              ctx.save();
              const flameGrad = ctx.createLinearGradient(cx, cy, cx, cy - pY);
              flameGrad.addColorStop(0, '#ffffff');
              flameGrad.addColorStop(0.3, '#ff00d0');
              flameGrad.addColorStop(1, 'rgba(255, 0, 229, 0)');
              ctx.fillStyle = flameGrad;
              ctx.shadowColor = '#ff00e5';
              ctx.shadowBlur = pW * 2.0;

              ctx.beginPath();
              ctx.moveTo(cx - pW / 2, cy);
              ctx.lineTo(cx, cy - pY);
              ctx.lineTo(cx + pW / 2, cy);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            };

            drawHeavyFlame(w * 0.28, h * 0.12, 6, f1);
            drawHeavyFlame(w * 0.72, h * 0.12, 6, f2);
            drawHeavyFlame(w * 0.5, h * 0.1, 9, f3);
          }

          // 2. Colossal wings structures
          ctx.beginPath();
          ctx.moveTo(w / 2, h); // Heavy nose deck
          ctx.bezierCurveTo(w * 0.2, h * 0.7, 2, h * 0.52, 2, h * 0.3); // Left giant swept wing edge
          ctx.lineTo(w * 0.18, h * 0.14);
          ctx.lineTo(w * 0.38, h * 0.16);
          ctx.lineTo(w / 2, h * 0.22);
          ctx.lineTo(w * 0.62, h * 0.16);
          ctx.lineTo(w * 0.82, h * 0.14);
          ctx.lineTo(w - 2, h * 0.3);
          ctx.bezierCurveTo(w * 0.8, h * 0.7, w / 2, h, w / 2, h);
          ctx.closePath();

          const enemyGrad = ctx.createLinearGradient(0, 0, 0, h);
          enemyGrad.addColorStop(0, '#18181b');
          enemyGrad.addColorStop(0.5, '#020204');
          enemyGrad.addColorStop(1, '#27272a');

          ctx.fillStyle = enemyGrad;
          ctx.strokeStyle = '#ff00e5';
          ctx.lineWidth = 1.8;
          ctx.shadowColor = '#ff00e5';
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.stroke();

          // 3. Heavy energy line overlays
          ctx.save();
          ctx.strokeStyle = '#ff00e5';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(w * 0.34, h * 0.35);
          ctx.lineTo(w * 0.15, h * 0.44);
          ctx.moveTo(w * 0.66, h * 0.35);
          ctx.lineTo(w * 0.85, h * 0.44);
          ctx.stroke();
          ctx.restore();

          // 4. Multiple command bridge / core pods
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(w / 3, h * 0.45, 2.5, 0, Math.PI * 2);
          ctx.arc(w * 2 / 3, h * 0.45, 2.5, 0, Math.PI * 2);
          ctx.arc(w / 2, h * 0.5, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.stroke();

        // Inner glowing cores
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(enemy.width / 2, enemy.height * 0.45, enemy.type === EnemyType.HEAVY ? 6 : 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw individual Health Bars for damaged Heavy units
        if (enemy.type === EnemyType.HEAVY && enemy.health < enemy.maxHealth) {
          const hpPercent = enemy.health / enemy.maxHealth;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(4, -8, enemy.width - 8, 3);
          ctx.fillStyle = '#ff00e5';
          ctx.fillRect(4, -8, (enemy.width - 8) * hpPercent, 3);
        }

        ctx.restore();
      });

      // D. DRAW LASER BULLETS (Cyan player beams & Magenta alien energy balls)
      bulletsRef.current.forEach(bullet => {
        ctx.save();
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = bullet.color;

        if (bullet.isPlayer) {
          // Linear laser beams
          ctx.fillRect(bullet.x - 2, bullet.y - 12, 4, 18);
          // Inner glowing plasma core
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bullet.x - 1, bullet.y - 10, 2, 14);
        } else {
          // Circular fireballs
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
          ctx.fill();
          // Inner core
          ctx.beginPath();
          ctx.fillStyle = '#ffffff';
          ctx.arc(bullet.x, bullet.y, bullet.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // E. DRAW PLAYER SHIP SPACESHIP
      const player = playerRef.current;
      if (gameState !== GameState.GAMEOVER && (gameState === GameState.PLAYING || gameState === GameState.PAUSED || gameState === GameState.START)) {
        
        ctx.save();

        // Pulse drawing if player is invincible under crash protection
        let drawPlayer = true;
        if (player.invincible && gameState === GameState.PLAYING) {
          // Rapid toggles every 4 frames
          drawPlayer = Math.floor(player.invincibleTimer / 4) % 2 === 0;
        }

        if (drawPlayer) {
          ctx.translate(player.x, player.y);

          // 1. Draw glowing high-intensity Amber/Orange Twin Engine jet plumes (Left and Right) under wings
          if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) {
            const fLeft = 14 + Math.random() * 14;
            const fRight = 14 + Math.random() * 14;

            const drawAmberPlume = (cx: number, cy: number, w: number, flickerH: number) => {
              ctx.save();
              const jetGrad = ctx.createLinearGradient(cx, cy, cx, cy + flickerH);
              jetGrad.addColorStop(0, '#ffffff');       // Ultra hot white thermal entry
              jetGrad.addColorStop(0.15, '#ffaa00');    // Pure glowing amber
              jetGrad.addColorStop(0.5, 'rgba(255, 60, 0, 0.55)');  // Tapering orange-red
              jetGrad.addColorStop(1, 'rgba(255, 40, 0, 0)');      // Cool-down gradient dissolve
              
              ctx.fillStyle = jetGrad;
              ctx.shadowColor = '#ff6000';
              ctx.shadowBlur = w * 2.2;

              ctx.beginPath();
              ctx.moveTo(cx - w / 2, cy);
              ctx.lineTo(cx, cy + flickerH);
              ctx.lineTo(cx + w / 2, cy);
              ctx.closePath();
              ctx.fill();

              // Inner core core glow
              const coreGrad = ctx.createLinearGradient(cx, cy, cx, cy + flickerH * 0.4);
              coreGrad.addColorStop(0, '#ffffff');
              coreGrad.addColorStop(1, 'rgba(255, 220, 100, 0)');
              ctx.fillStyle = coreGrad;
              ctx.beginPath();
              ctx.moveTo(cx - w / 4, cy);
              ctx.lineTo(cx, cy + flickerH * 0.4);
              ctx.lineTo(cx + w / 4, cy);
              ctx.closePath();
              ctx.fill();

              ctx.restore();
            };

            // Draw plumes from engine nozzle exhaust
            drawAmberPlume(player.width * 0.18, player.height * 0.65, 8, fLeft);
            drawAmberPlume(player.width * 0.82, player.height * 0.65, 8, fRight);
          }

          // 2. Draw Rear Horizontal-Stabilizer Elevators & Tail Structure (elevated T-tail look at very back)
          ctx.save();
          // Vertical spine mounting
          ctx.fillStyle = '#1e1e24';
          ctx.strokeStyle = '#3f3f46';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(player.width * 0.45, player.height * 0.55);
          ctx.lineTo(player.width * 0.48, player.height * 0.86);
          ctx.lineTo(player.width * 0.52, player.height * 0.86);
          ctx.lineTo(player.width * 0.55, player.height * 0.55);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Horizontal elevons stabilizer bar at bottom back
          ctx.beginPath();
          ctx.moveTo(player.width * 0.28, player.height * 0.82);
          ctx.lineTo(player.width * 0.38, player.height * 0.8);
          ctx.lineTo(player.width * 0.48, player.height * 0.86);
          ctx.lineTo(player.width * 0.52, player.height * 0.86);
          ctx.lineTo(player.width * 0.62, player.height * 0.8);
          ctx.lineTo(player.width * 0.72, player.height * 0.82);
          ctx.lineTo(player.width * 0.64, player.height * 0.88);
          ctx.lineTo(player.width * 0.36, player.height * 0.88);
          ctx.closePath();
          
          const tailGrad = ctx.createLinearGradient(player.width * 0.3, 0, player.width * 0.7, 0);
          tailGrad.addColorStop(0, '#3f3f46');
          tailGrad.addColorStop(0.5, '#71717a');
          tailGrad.addColorStop(1, '#3f3f46');
          ctx.fillStyle = tailGrad;
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // 3. Draw Massive Stealth Delta Wings (as seen in image)
          ctx.beginPath();
          // Forward aerodynamic nose apex
          ctx.moveTo(player.width / 2, player.height * 0.24);
          // Left wing leading edge curve sweeping outer-leftwards
          ctx.bezierCurveTo(player.width * 0.2, player.height * 0.3, 0, player.height * 0.42, 0, player.height * 0.54);
          // Left Wingtip outer corner slice
          ctx.lineTo(player.width * 0.04, player.height * 0.63);
          // Left wing trailing edge curving inside towards inner engines
          ctx.quadraticCurveTo(player.width * 0.24, player.height * 0.58, player.width * 0.34, player.height * 0.6);
          // Rear central hull merge point
          ctx.lineTo(player.width / 2, player.height * 0.72);
          // Right wing trailing edge symmetry matching left
          ctx.lineTo(player.width * 0.66, player.height * 0.6);
          ctx.quadraticCurveTo(player.width * 0.76, player.height * 0.58, player.width * 0.96, player.height * 0.63);
          // Right Wingtip outer corner slice
          ctx.lineTo(player.width, player.height * 0.54);
          // Right wing leading edge curve sweeping back to nose
          ctx.bezierCurveTo(player.width, player.height * 0.42, player.width * 0.8, player.height * 0.3, player.width / 2, player.height * 0.24);
          ctx.closePath();

          // Apply rich metallic Titanium / Slate-steel dark gradients
          const wingGrad = ctx.createLinearGradient(0, 0, 0, player.height);
          wingGrad.addColorStop(0, '#52525b');      // Cool silver shadow
          wingGrad.addColorStop(0.35, '#27272a');   // Gunmetal gray
          wingGrad.addColorStop(0.7, '#18181b');    // Deep carbon fiber
          wingGrad.addColorStop(1, '#09090b');      // Base bottom shadow

          ctx.fillStyle = wingGrad;
          ctx.strokeStyle = player.tripleShotTimer > 0 ? '#ff00e5' : '#ff7c00'; // pink glow during triple, amber orange normally
          ctx.lineWidth = 1.8;
          ctx.shadowColor = player.tripleShotTimer > 0 ? '#ff00e5' : '#ff6000';
          ctx.shadowBlur = player.tripleShotTimer > 0 ? 16 : 8;
          ctx.fill();
          ctx.stroke();

          // 4. Draw Cylindrical Wing Turbine Engine Nacelles (Mounted directly in left/right wing sections)
          const drawEngineNacelle = (cx: number, cy: number, w: number, h: number) => {
            ctx.save();
            // Black intake scoop ring at top of engine
            ctx.beginPath();
            ctx.ellipse(cx, cy, w / 2, h / 3.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#09090b';
            ctx.fill();

            // Cylindrical engine body with metallic reflection highlight
            ctx.beginPath();
            ctx.rect(cx - w / 2, cy, w, h);
            const nacelleGrad = ctx.createLinearGradient(cx - w / 2, cy, cx + w / 2, cy);
            nacelleGrad.addColorStop(0, '#18181b');
            nacelleGrad.addColorStop(0.4, '#e4e4e7'); // polished chrome stripe
            nacelleGrad.addColorStop(0.65, '#71717a');
            nacelleGrad.addColorStop(1, '#18181b');
            ctx.fillStyle = nacelleGrad;
            ctx.strokeStyle = '#3f3f46';
            ctx.lineWidth = 0.8;
            ctx.fill();
            ctx.stroke();

            // Hot exhaust burner nozzle ring with active heating glow
            ctx.beginPath();
            ctx.rect(cx - w / 2, cy + h, w, 2.5);
            ctx.fillStyle = '#ff3300';
            ctx.shadowColor = '#ff5100';
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.restore();
          };

          // Draw the Left and Right engines integrated exactly inside the wing structure
          drawEngineNacelle(player.width * 0.18, player.height * 0.42, 8.5, 11);
          drawEngineNacelle(player.width * 0.82, player.height * 0.42, 8.5, 11);

          // 5. Draw high-fidelity aerodynamic panel pathways (orange energy light conduit traces on wings)
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 120, 0, 0.4)';
          ctx.lineWidth = 0.8;
          // Left wing panel lines
          ctx.beginPath();
          ctx.moveTo(player.width * 0.14, player.height * 0.48);
          ctx.lineTo(player.width * 0.32, player.height * 0.54);
          ctx.stroke();

          // Right wing panel lines
          ctx.beginPath();
          ctx.moveTo(player.width * 0.86, player.height * 0.48);
          ctx.lineTo(player.width * 0.68, player.height * 0.54);
          ctx.stroke();
          ctx.restore();

          // 6. Draw central raised elevated upper fuselage spine (3D curve)
          ctx.beginPath();
          ctx.moveTo(player.width / 2, player.height * 0.24);
          ctx.lineTo(player.width * 0.38, player.height * 0.38);
          ctx.lineTo(player.width * 0.36, player.height * 0.68);
          ctx.lineTo(player.width / 2, player.height * 0.74);
          ctx.lineTo(player.width * 0.64, player.height * 0.68);
          ctx.lineTo(player.width * 0.62, player.height * 0.38);
          ctx.closePath();

          const fuseGrad = ctx.createLinearGradient(player.width * 0.36, 0, player.width * 0.64, 0);
          fuseGrad.addColorStop(0, '#27272a');
          fuseGrad.addColorStop(0.25, '#52525b');
          fuseGrad.addColorStop(0.5, '#f4f4f5'); // high metal peak core
          fuseGrad.addColorStop(0.75, '#52525b');
          fuseGrad.addColorStop(1, '#27272a');

          ctx.fillStyle = fuseGrad;
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 0.8;
          ctx.fill();
          ctx.stroke();

          // 7. Draw central glorious warm-glowing amber tactical glass canopy (dome-like cockpit)
          ctx.save();
          const canopyY = player.height * 0.34;
          const canopyH = player.height * 0.20;
          const canopyW = player.width * 0.15;

          const glassGrad = ctx.createLinearGradient(0, canopyY, 0, canopyY + canopyH);
          glassGrad.addColorStop(0, '#ffffff');        // front glass reflection strip
          glassGrad.addColorStop(0.25, '#ff9900');     // bright amber orange windshield
          glassGrad.addColorStop(0.75, '#7c2d12');     // rich volcanic shadow
          glassGrad.addColorStop(1, '#1c1917');

          ctx.fillStyle = glassGrad;
          ctx.shadowColor = '#ff7c00';
          ctx.shadowBlur = 9;

          ctx.beginPath();
          ctx.moveTo(player.width / 2, canopyY);
          ctx.quadraticCurveTo(player.width / 2 - canopyW, canopyY + canopyH * 0.3, player.width / 2 - canopyW, canopyY + canopyH * 0.85);
          ctx.quadraticCurveTo(player.width / 2, canopyY + canopyH, player.width / 2 + canopyW, canopyY + canopyH * 0.85);
          ctx.quadraticCurveTo(player.width / 2 + canopyW, canopyY + canopyH * 0.3, player.width / 2, canopyY);
          ctx.closePath();
          ctx.fill();

          // Add realistic cockpit light reflection gleams
          ctx.beginPath();
          ctx.moveTo(player.width / 2, canopyY + 1.5);
          ctx.quadraticCurveTo(player.width / 2 + 2.5, canopyY + canopyH * 0.4, player.width / 2 + 2.5, canopyY + canopyH * 0.85);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 0.8;
          ctx.shadowBlur = 0;
          ctx.stroke();
          ctx.restore();

          // 8. Draw Energetic Forcefield Shield Bubble centered around fighter (if shielded)
          if (player.shield) {
            ctx.save();
            ctx.translate(player.width / 2, player.height * 0.44);
            
            const shieldPulse = 1.0 + Math.sin(timestamp * 0.0075) * 0.05;
            ctx.scale(shieldPulse, shieldPulse);

            const shieldGrad = ctx.createRadialGradient(0, 0, 32, 0, 0, 42);
            shieldGrad.addColorStop(0, 'rgba(0, 240, 255, 0.05)');
            shieldGrad.addColorStop(0.85, 'rgba(0, 240, 255, 0.25)');
            shieldGrad.addColorStop(1, 'rgba(0, 240, 255, 0.85)');

            ctx.beginPath();
            ctx.arc(0, 0, 39, 0, Math.PI * 2);
            ctx.fillStyle = shieldGrad;
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 1.8;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 18;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.restore();
      }

      // F. GRAPHICS: LEVEL UP FLASH TEXT
      if (levelUpPromptTimer.current > 0) {
        levelUpPromptTimer.current--;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.min(1.0, levelUpPromptTimer.current / 15) + ')';
        ctx.font = 'bold italic 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20;
        
        ctx.fillText(`WARP LEVEL ${levelRef.current}`, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 40);
        ctx.font = 'bold 14px monospace';
        ctx.fillText('武器过载 & 防护能注入 !', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 5);
        ctx.restore();
      }

      // G. GRAPHICS: DAMAGE PENALTY WARNING FLASH RED VIGNETTES
      if (borderFlashTimer.current > 0) {
        borderFlashTimer.current--;
        if (borderFlashTimer.current <= 0) {
          setWarningFlash(false);
        }
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${borderFlashTimer.current / 14})`;
        ctx.lineWidth = 12;
        ctx.strokeRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        ctx.restore();
      }

      // Restore drawing logic scale matrix
      ctx.restore();

      // Trigger standard Request Animation Frame loops
      localAnimationFrameId = requestAnimationFrame(gameTick);
    };

    localAnimationFrameId = requestAnimationFrame(gameTick);
    return () => cancelAnimationFrame(localAnimationFrameId);
  }, [gameState, isMobile]);


  // Pointer movements listeners mappings (Supports smooth mouse drag on desktop and touch gestures on devices!)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== GameState.PLAYING) return;
    // For mouse clicks, only respond to left-click button (button === 0)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    touchActive.current = true;
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch (err) {}
    updatePointerTarget(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== GameState.PLAYING) return;
    if (touchActive.current) {
      updatePointerTarget(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    touchActive.current = false;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  const updatePointerTarget = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    
    // Calculate normalized relative canvas coordinates (0-600 width, 0-800 height)
    const relativeX = ((e.clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
    const relativeY = ((e.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;

    touchTargetX.current = relativeX;
    touchTargetY.current = relativeY;
  };

  // Memoized stats for rendering
  const earnedAchievements = useMemo(() => {
    return achievements.filter(ach => ach.unlocked);
  }, [achievements]);

  return (
    <div 
      ref={containerRef}
      className="relative min-h-screen bg-[#020205] font-sans text-white overflow-hidden flex flex-col items-center justify-center p-2 md:p-6 transition-colors duration-500"
    >
      
      {/* Background ambient Sophisticated Dark stars & nebula glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0d1117_0%,#020205_100%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* Sophisticated Dark High Value Cyan and Pink Blurry Nebulas */}
      <div className="absolute top-1/6 left-1/4 w-[500px] h-[500px] bg-[#00f0ff]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#ff00e5]/3 blur-[140px] rounded-full pointer-events-none" />

      {/* Header Panel */}
      <header className="w-full max-w-6xl flex justify-between items-center mb-4 z-10 px-4 py-3 bg-[rgba(255,255,255,0.03)] backdrop-blur-md rounded-xl border border-[rgba(255,255,255,0.08)] shadow-[0_0_20px_rgba(0,240,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-black/40 border border-[#00f0ff]/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.25)]">
            <svg viewBox="0 0 40 40" className="w-5 h-5 fill-[#00f0ff]">
              <path d="M20,5 L33,32 L20,26 L7,32 Z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase text-slate-100 flex items-baseline gap-1">
              NEBULA STRIKER <span className="text-[10px] glow-cyan font-mono font-bold tracking-normal">V1.5-BETA</span>
            </h1>
            <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">
              COORDINATES: SEC-01A ALPHA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#00f0ff] bg-[#00f0ff]/5 px-2 py-1 rounded border border-[#00f0ff]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping"></span>
            SYSTEM STATUS: OPTIMAL
          </div>

          {/* Sound Toggle Button */}
          <button
            onClick={toggleSoundConfig}
            className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 backdrop-blur flex items-center justify-center text-slate-300 hover:text-white hover:border-[#00f0ff]/40 transition-all shadow-md cursor-pointer"
            title="切换音效"
            id="sound-config-toggle"
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#00f0ff]" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>
      </header>

      {/* Master Main Board Layout */}
      <main className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 items-stretch justify-center z-10 px-2 lg:px-4">
        
        {/* Playable Game Engine Deck */}
        <div className="flex-1 flex flex-col relative min-h-[500px] md:min-h-[640px] items-center">
          
          {/* Glass Overlay Screen Border Flashes Warns */}
          <div 
            className={`absolute inset-0 rounded-2xl border transition-all duration-300 pointer-events-none z-20 ${
              warningFlash 
                ? 'border-[#ff3300]/80 shadow-[inset_0_0_40px_rgba(255,51,0,0.35)]' 
                : 'border-white/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]'
            }`} 
          />

          {/* Core HUD stats bar floating above Canvas */}
          {gameState === GameState.PLAYING && (
            <div className="absolute top-4 inset-x-4 flex justify-between items-center z-30 bg-black/60 backdrop-blur-lg rounded-xl border border-white/10 p-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] pointer-events-none">
              
              {/* Scores Tickers */}
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-widest text-slate-400 font-mono">
                  SCORE 积分
                </span>
                <span className="text-lg font-black font-mono tracking-wider glow-cyan">
                  {currentScore.toLocaleString()}
                </span>
              </div>

              {/* Levels / Waves */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold tracking-widest text-slate-400 font-mono">
                  WARP LEVEL 战区关卡
                </span>
                <span className="text-lg font-black font-mono flex items-center gap-1 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                  <ChevronsUp className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  {currentLevel.toString().padStart(2, '0')}
                </span>
              </div>

              {/* Buff timer status */}
              <div className="hidden sm:flex flex-col min-w-[120px] gap-1">
                <span className="text-[9px] font-bold tracking-widest text-slate-400 font-mono">
                  WEAPON STATUS 武器过载
                </span>
                {weaponTimer > 0 ? (
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
                    <div 
                      className="bg-gradient-to-r from-[#ff00e5] to-[#00f0ff] h-2 rounded-full transition-all duration-100 shadow-[0_0_8px_#ff00e5]" 
                      style={{ width: `${weaponTimer}%` }}
                    />
                  </div>
                ) : (
                  <span className="text-[10px] font-semibold text-[#00f0ff] font-mono bg-[#00f0ff]/5 px-2 py-0.5 rounded border border-[#00f0ff]/20">
                    SINGLE STANDARD LASER
                  </span>
                )}
              </div>

              {/* Player HP icons and Shield Status */}
              <div className="flex items-center gap-3">
                {shieldActive && (
                  <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff] animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                    <Shield className="w-3" />
                  </div>
                )}
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold tracking-widest text-slate-400 font-mono mb-1">
                    VESSEL ENERGY 能量值
                  </span>
                  <div className="flex gap-1.5">
                    {[...Array(3)].map((_, idx) => (
                      <Heart 
                        key={idx} 
                        className={`w-3.5 h-3.5 transition-all duration-300 ${
                          idx < playerLives 
                            ? 'fill-[#ff3300] text-[#ff3300] drop-shadow-[0_0_5px_rgba(255,51,0,0.8)]' 
                            : 'text-slate-800 fill-transparent'
                        }`} 
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Interactive Screen Overlay Panels (Start, Pause, Gameover) */}
          <AnimatePresence mode="wait">
            
            {/* START SCREEN */}
            {gameState === GameState.START && (
              <motion.div 
                key="start-screen"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                className="absolute inset-0 bg-[#020205]/90 backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center p-6 text-center z-40 border border-white/10"
              >
                {/* Visual Accent */}
                <div className="w-16 h-16 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center mb-6 text-[#00f0ff] animate-pulse shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                  <Gamepad2 className="w-8 h-8" />
                </div>

                <h2 className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-[#00f0ff] via-white to-[#ff00e5] drop-shadow-[0_0_12px_rgba(0,240,255,0.3)] mb-3">
                  太空防御: 战机出航
                </h2>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                  敌军主力舰队已穿跃至基地防卫红线。即刻阻截来袭敌机，获取太空等离子强化包！守卫银河终极屏障。
                </p>

                {/* Score Indicators */}
                {highScore > 0 && (
                  <div className="mb-6 flex items-center gap-2 bg-white/3 border border-white/10 rounded-xl px-4 py-2 text-slate-200 shadow-[inset_0_0_10px_rgba(0,240,255,0.05)] text-xs font-mono">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      本地最高纪录: <strong className="glow-cyan text-sm font-bold font-mono ml-1">{highScore.toLocaleString()}</strong> 积分
                    </span>
                  </div>
                )}

                <div className="mb-6 flex flex-col items-center gap-2 text-[11px] text-slate-400 font-mono max-w-sm bg-white/3 border border-white/5 rounded-xl p-3 shadow-inner">
                  <div className="flex items-center gap-1 text-[#00f0ff] font-semibold">
                    <span>移动操控：WASD / 方向键 或 鼠标拖拽飞船</span>
                  </div>
                  <div className="text-[10px] text-slate-300">
                    火控系统：<strong>推进器升空，核芯自动超频开火 (AUTO-FIRE)</strong>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    暂停/时空结界：<span className="key-cap text-[9px] px-1 py-0.5 ml-1">P</span>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-widest text-[#00f0ff] bg-black/40 border border-[#00f0ff] hover:bg-[#00f0ff]/10 hover:border-white transition-all shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2.5"
                  id="star-game-main-btn"
                >
                  <Play className="w-4 h-4 text-[#00f0ff] fill-[#00f0ff]" />
                  启动太空引擎 START ENGINE
                </button>
              </motion.div>
            )}

            {/* PAUSE OVERLAY */}
            {gameState === GameState.PAUSED && (
              <motion.div 
                key="pause-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#020205]/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center z-40 border border-white/10"
              >
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-400/35 flex items-center justify-center mb-5 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Pause className="w-6 h-6" />
                </div>

                <h3 className="text-xl font-bold tracking-[0.15em] text-amber-400 uppercase font-mono">
                  时空结界 PAUSED
                </h3>
                <p className="text-xs text-slate-400 mt-2 mb-8 max-w-xs leading-relaxed">
                  战区星轨能量被锁闭。平流深吸调解状态，准备迎接更剧烈的重核巡洋舰队。
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handlePauseToggle}
                    className="px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-black border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.2)] flex items-center justify-center gap-2"
                  >
                    解锁时空 RESUME
                  </button>
                  <button
                    onClick={quitToMainMenu}
                    className="px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-black border border-[#ff00e5] text-[#ff00e5] hover:bg-[#ff00e5]/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    退出折返 QUIT
                  </button>
                </div>
              </motion.div>
            )}

            {/* GAME OVER SCREEN */}
            {gameState === GameState.GAMEOVER && (
              <motion.div 
                key="gameover-screen"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                className="absolute inset-0 bg-[#020205]/95 backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center p-6 text-center z-40 border border-white/10 overflow-y-auto"
              >
                {/* Title */}
                <h3 className="text-2xl font-black tracking-widest text-[#ff3300] uppercase drop-shadow-[0_0_12px_rgba(255,51,0,0.4)] mb-2 mt-4">
                  编队坠毁 MISSION OVER
                </h3>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mb-6">
                  拦截机推进核心过载停摆。您的坚韧英魂已被雕琢在银河英雄底座。
                </p>

                {/* Final Stats Card */}
                <div className="grid grid-cols-2 gap-4 max-w-sm w-full bg-white/2 backdrop-blur-md border border-white/10 p-4 rounded-xl mb-6">
                  <div className="flex flex-col bg-black/40 p-3 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">
                      最终结算分
                    </span>
                    <span className="text-xl font-bold font-mono glow-cyan mt-1">
                      {scoreRef.current.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col bg-black/40 p-3 rounded-lg border border-white/5">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">
                      最大关卡数
                    </span>
                    <span className="text-xl font-bold font-mono text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)] mt-1">
                      {levelRef.current.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Unlocked Achievements list inside Gameover layout */}
                <div className="w-full max-w-sm mb-6 flex flex-col items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-3 flex items-center gap-1.5 font-mono">
                    <Award className="w-3.5 h-3.5 text-[#00f0ff]" />
                    已授勋荣誉徽章 UNLOCKED ({earnedAchievements.length}/{achievements.length})
                  </h4>
                  
                  {earnedAchievements.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-center gap-2 max-h-28 overflow-y-auto pr-1">
                      {earnedAchievements.map(ach => (
                        <div 
                          key={ach.id} 
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ff00e5]/5 border border-[#ff00e5]/30 rounded text-slate-200 text-[10px]"
                          title={ach.description}
                        >
                          <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="font-semibold">{ach.name.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic mt-1 font-mono uppercase">
                      NO DECORATIONS EARNED THIS RUN
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <button
                    onClick={startGame}
                    className="px-6 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest bg-black border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff]/10 hover:border-white transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.2)] flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    重装引擎 RETRY
                  </button>
                  <button
                    onClick={quitToMainMenu}
                    className="px-6 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest bg-black border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    回到主页 MENU
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* HTML5 Canvas Active drawing board */}
          <div 
            className="w-full h-full min-h-[500px] md:min-h-[640px] bg-slate-950/60 rounded-2xl overflow-hidden cursor-crosshair relative touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 block w-full h-full"
            />
          </div>

          {/* Weapons overload warning indicator inside footer overlay */}
          {gameState === GameState.PLAYING && (
            <div className="absolute bottom-4 left-4 text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800/50 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              武器火控: 自动全频开火 (AUTO-FIRE) | 拖拽鼠标或WASD移动
            </div>
          )}

        </div>

        {/* Dynamic side guide panels (collapsed nicely into mobile displays) */}
        <div className="w-full lg:w-auto h-auto shrink-0 z-10">
          <Sidebar />
        </div>

      </main>

      {/* Achievement unlocked toast micro overlay */}
      <AchievementToast 
        achievement={toastAchievement} 
        onClose={() => setToastAchievement(null)} 
      />

      {/* Global Aesthetic Footer */}
      <footer className="w-full max-w-6xl mt-8 text-center text-slate-600 text-[11px] font-mono tracking-widest uppercase border-t border-slate-900/80 pt-4 z-10">
        © 2026 Interstellar Defense Command. All Rights Reserved.
      </footer>

    </div>
  );
}
