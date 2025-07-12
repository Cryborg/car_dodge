const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constantes du jeu
const GAME_CONSTANTS = {
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 600,
    ROAD_START: 20,
    ROAD_END: 380,
    ROAD_WIDTH: 360,
    LANE_WIDTH: 67,
    PLAYER_START_X: 200,
    PLAYER_START_Y: 550,
    PLAYER_WIDTH: 24,
    PLAYER_HEIGHT: 30,
    COLLISION_EFFECT_DURATION: 15,
    CRASH_ANIMATION_DURATION: 20,
    MAX_LEVEL: 25,
    LEVEL_DURATION: 25,
    BOSS_DURATION: 10,
    LIVES_PER_5_LEVELS: 5,
    LINE_HEIGHT: 100,
    LINE_SPEED_MULTIPLIER: 0.1,
    COUNTDOWN_TOTAL_FRAMES: 90, // 1.5 secondes à 60fps
    COUNTDOWN_DIGIT_FRAMES: 30 // 0.5 seconde entre chaque chiffre
};

// Tailles des véhicules
const VEHICLE_SIZES = {
    car: { width: 30, height: 40, hitboxWidth: 25, hitboxHeight: 35 },
    moto: { width: 80, height: 30, hitboxWidth: 20, hitboxHeight: 28 },
    truck: { width: 100, height: 200, hitboxWidth: 35, hitboxHeight: 180 }
};

// Fonctions utilitaires
function createCollisionEffect(x, y) {
    gameState.collisionEffect = {
        x: x,
        y: y,
        timer: GAME_CONSTANTS.COLLISION_EFFECT_DURATION,
        scale: 0
    };
}

function createNotification(text, color = '#22c55e') {
    gameState.livesNotification = {
        text: text,
        color: color,
        y: GAME_CONSTANTS.CANVAS_HEIGHT / 2,
        timer: 120, // 2 secondes à 60fps
        opacity: 1
    };
}

function isInRoadBounds(x) {
    return x >= GAME_CONSTANTS.ROAD_START && x <= GAME_CONSTANTS.ROAD_END;
}

function getLaneCenter(laneIndex) {
    const lanePositions = [51, 118, 185, 252, 319];
    return lanePositions[laneIndex] || lanePositions[2]; // Par défaut voie centrale
}

function getRandomLane() {
    return Math.floor(Math.random() * 5);
}

let gameState = {
    running: false,
    paused: false,
    level: 1,
    score: 0,
    timeLeft: 60,
    lives: 5,
    playerX: GAME_CONSTANTS.PLAYER_START_X,
    playerY: GAME_CONSTANTS.PLAYER_START_Y,
    playerVelocityX: 0,
    playerCarImage: null,
    enemyCarImages: [],
    truckImages: [],
    motoImages: [],
    bossImages: [],
    cars: [],
    bonuses: [],
    lastCarSpawn: 0,
    lastBonusSpawn: 0,
    lastUpdate: 0,
    keys: {},
    bestScore: localStorage.getItem('bestScore') || 0,
    lastPlayerName: localStorage.getItem('lastPlayerName') || '',
    crashAnimation: 0,
    escapePressed: 0,
    lastEscapeTime: 0,
    levelStartTime: 0,
    bossMode: false,
    boss: null,
    projectiles: [],
    bombs: [],
    levelDuration: GAME_CONSTANTS.LEVEL_DURATION,
    collisionEffect: null,
    explosionImage: null,
    starBonusImage: null,
    livesNotification: null,
    countdown: {
        active: false,
        value: 3,
        timer: 0,
        onComplete: null
    },
    debugMode: {
        active: false,
        vehicleFilter: 'normal', // 'normal', 'car', 'truck', 'moto', 'boss'
        fixedVehicles: false
    }
};

function getLevelConfig(level) {
    const intensity = Math.min(level / 25, 1);

    return {
        carSpeed: 2 + (level * 0.4) + (intensity * 2),
        carSpawnRate: Math.max(2000 - (level * 120) - (intensity * 500), 800),
        bonusSpawnRate: Math.max(3000 + (level * 400), 10000),
        maxCars: Math.min(2 + Math.floor(level / 2), 8)
    };
}

document.addEventListener('keydown', (e) => {
    gameState.keys[e.key] = true;

    // Pause avec P
    if (e.key === 'p' || e.key === 'P') {
        if (gameState.running && !gameState.bossMode) {
            if (gameState.paused) {
                // Reprendre avec décompte
                gameState.paused = false;
                startCountdown(() => {}); // Pas besoin de callback, juste reprendre
            } else {
                // Mettre en pause
                gameState.paused = true;
            }
        }
        return;
    }

    // Rejouer avec R
    if (e.key === 'r' || e.key === 'R') {
        if (!gameState.running) {
            startNewGame(1);
        }
        return;
    }

    // Mode Debug avec D
    if (e.key === 'd' || e.key === 'D') {
        if (!gameState.running) {
            showDebugMenu();
        }
        return;
    }

    // Contrôles debug niveau avec + et -
    if (gameState.debugMode.active) {
        if (e.key === '+' || e.key === '=') {
            gameState.level = gameState.level >= 25 ? 1 : gameState.level + 1;
            document.getElementById('levelDisplay').textContent = gameState.level;
            // Redémarrer le boss avec le nouveau niveau si en mode boss
            if (gameState.boss) {
                startBossMode();
            }
            return;
        }
        if (e.key === '-' || e.key === '_') {
            gameState.level = gameState.level <= 1 ? 25 : gameState.level - 1;
            document.getElementById('levelDisplay').textContent = gameState.level;
            // Redémarrer le boss avec le nouveau niveau si en mode boss
            if (gameState.boss) {
                startBossMode();
            }
            return;
        }
    }

    // Commencer avec Entrée
    if (e.key === 'Enter') {
        if (!gameState.running) {
            const level = parseInt(document.getElementById('levelSlider').value);
            startNewGame(level);
        } else if (document.getElementById('scoreForm').style.display !== 'none') {
            saveScore();
        }
        return;
    }

    if (e.key === 'Escape' && gameState.running) {
        const currentTime = performance.now();
        if (currentTime - gameState.lastEscapeTime < 1000) {
            gameState.escapePressed++;
            if (gameState.escapePressed >= 2) {
                endGame();
                return;
            }
        } else {
            gameState.escapePressed = 1;
        }
        gameState.lastEscapeTime = currentTime;
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.key] = false;
});

function startCountdown(onComplete) {
    gameState.countdown.active = true;
    gameState.countdown.value = 3;
    gameState.countdown.timer = GAME_CONSTANTS.COUNTDOWN_DIGIT_FRAMES; // Commencer immédiatement
    gameState.countdown.onComplete = onComplete;
}

function startNewGame(level) {
    // S'assurer que toutes les images essentielles sont chargées avant de commencer
    if (!gameState.explosionImage || !gameState.explosionImage.complete || 
        !gameState.starBonusImage || !gameState.starBonusImage.complete ||
        !gameState.playerCarImage || !gameState.playerCarImage.complete) {
        setTimeout(() => startNewGame(level), 50);
        return;
    }
    
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    startCountdown(() => startGame(level));
    gameLoop();
}

function startGame(level) {
    // En mode debug, garder le niveau actuel s'il a été modifié pendant le décompte
    if (!gameState.debugMode.active) {
        gameState.level = level;
    }
    gameState.running = true;
    gameState.score = 0;
    gameState.timeLeft = 60;
    gameState.lives = 5;
    gameState.playerX = GAME_CONSTANTS.PLAYER_START_X;
    gameState.playerVelocityX = 0;
    gameState.cars = [];
    gameState.bonuses = [];
    gameState.lastCarSpawn = 0;
    gameState.lastBonusSpawn = 0;
    gameState.lastUpdate = performance.now();
    gameState.levelStartTime = performance.now();
    gameState.crashAnimation = 0;
    gameState.escapePressed = 0;
    gameState.lastEscapeTime = 0;
    gameState.bossMode = false;
    gameState.boss = null;
    gameState.projectiles = [];
    gameState.bombs = [];

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('levelDisplay').textContent = level;

    gameLoop();
}


function updatePlayer() {
    const maxSpeed = 5;
    const acceleration = 0.5;
    const deceleration = 0.95;

    // Accélération progressive
    if (gameState.keys['ArrowLeft'] && gameState.playerX > 20) {
        gameState.playerVelocityX = Math.max(gameState.playerVelocityX - acceleration, -maxSpeed);
    } else if (gameState.keys['ArrowRight'] && gameState.playerX < 380) {
        gameState.playerVelocityX = Math.min(gameState.playerVelocityX + acceleration, maxSpeed);
    } else {
        // Arrêt instantané quand aucune touche n'est pressée
        gameState.playerVelocityX = 0;
    }

    // Appliquer la vélocité
    gameState.playerX += gameState.playerVelocityX;
    
    // S'assurer qu'on reste dans les limites
    gameState.playerX = Math.max(5, Math.min(395, gameState.playerX));
}

function spawnCar(currentTime) {
    if (gameState.bossMode && !gameState.debugMode.active) return;
    if (gameState.debugMode.active && gameState.debugMode.vehicleFilter === 'boss') return;

    const config = getLevelConfig(gameState.level);
    if (currentTime - gameState.lastCarSpawn > config.carSpawnRate && gameState.cars.length < config.maxCars) {
        const lanes = [33, 100, 167, 234, 301, 367];
        const numCarVariants = 5; // Nombre de variantes de couleurs
        
        // Calcul du nombre de voitures à spawner simultanément
        const simultaneousCars = Math.min(1 + Math.floor(gameState.level / 5), 5);
        const usedLanes = [];
        
        for (let i = 0; i < simultaneousCars && gameState.cars.length < config.maxCars; i++) {
            // Éviter de mettre deux voitures sur la même voie
            const availableLanes = lanes.filter(lane => !usedLanes.includes(lane));
            if (availableLanes.length === 0) break;
            
            const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
            usedLanes.push(lane);

            let vehicleType = 'car';
            let size = { width: 30, height: 40 };
            let speed = config.carSpeed;

            // Mode debug : forcer le type de véhicule
            if (gameState.debugMode.active) {
                switch(gameState.debugMode.vehicleFilter) {
                    case 'car':
                        vehicleType = 'car';
                        size = { width: 30, height: 40 };
                        speed = config.carSpeed;
                        break;
                    case 'truck':
                        vehicleType = 'truck';
                        size = { width: 100, height: 200 };
                        speed = config.carSpeed - 1;
                        break;
                    case 'moto':
                        vehicleType = 'moto';
                        size = { width: 80, height: 30 };
                        speed = config.carSpeed + 1;
                        break;
                }
            } else {
                // Mode normal : génération aléatoire
                const rand = Math.random();
                if (rand < 0.15) {
                    vehicleType = 'moto';
                    size = { width: 80, height: 30 };
                    speed = config.carSpeed + 1;
                } else if (rand < 0.25) {
                    vehicleType = 'truck';
                    size = { width: 100, height: 200 };
                    speed = config.carSpeed - 1;
                }
            }

            let imageIndex;
            if (vehicleType === 'truck') {
                imageIndex = Math.floor(Math.random() * 3); // 3 camions
            } else if (vehicleType === 'moto') {
                imageIndex = Math.floor(Math.random() * 3); // 3 motos
            } else {
                imageIndex = Math.floor(Math.random() * numCarVariants); // 5 voitures
            }
            
            // Variation aléatoire de position dans la voie (±15px)
            // Pour les motos : position libre sur toute la largeur
            let actualX;
            if (vehicleType === 'moto') {
                actualX = 30 + Math.random() * 340; // Position libre entre les bords
            } else {
                const laneVariation = (Math.random() - 0.5) * 30;
                actualX = lane + laneVariation;
            }
            
            gameState.cars.push({
                x: actualX,
                y: -50 - (i * 80), // Espacement vertical entre les voitures simultanées
                targetX: actualX,
                imageIndex: imageIndex,
                speed: speed,
                type: vehicleType,
                size: size,
                canChangeLane: gameState.level >= 3 && vehicleType === 'car' && Math.random() < 0.3,
                lastLaneChange: 0,
                scored: false,
                // Propriétés spécifiques aux motos
                zigzagAmplitude: vehicleType === 'moto' ? 15 + Math.random() * 18 : 0, // Amplitude réduite de moitié
                zigzagFrequency: vehicleType === 'moto' ? 0.02 + Math.random() * 0.03 : 0, // Vitesse du zigzag
                zigzagPhase: vehicleType === 'moto' ? Math.random() * Math.PI * 2 : 0, // Phase initiale aléatoire
                initialX: actualX
            });
        }
        gameState.lastCarSpawn = currentTime;
    }
}

function spawnBonus(currentTime) {
    if (gameState.bossMode) return;

    const config = getLevelConfig(gameState.level);
    if (currentTime - gameState.lastBonusSpawn > config.bonusSpawnRate) {
        const lanes = [33, 100, 167, 234, 301, 367];
        let attempts = 0;
        let validPosition = false;
        let bonusX, bonusY = -30;
        
        // Essayer de trouver une position libre (max 10 tentatives)
        while (!validPosition && attempts < 10) {
            bonusX = lanes[Math.floor(Math.random() * lanes.length)];
            validPosition = true;
            
            // Vérifier s'il y a un véhicule dans cette zone
            for (let car of gameState.cars) {
                const distance = Math.sqrt(Math.pow(bonusX - car.x, 2) + Math.pow(bonusY - car.y, 2));
                if (distance < 80) { // Distance de sécurité
                    validPosition = false;
                    break;
                }
            }
            attempts++;
        }
        
        // Seulement ajouter le bonus si on a trouvé une position valide
        if (validPosition) {
            gameState.bonuses.push({
                x: bonusX,
                y: bonusY
            });
        }
        
        gameState.lastBonusSpawn = currentTime;
    }
}

function updateCars() {
    const currentTime = performance.now();

    gameState.cars = gameState.cars.filter(car => {
        car.y += car.speed;

        // Zigzag pour les motos
        if (car.type === 'moto') {
            const timeElapsed = car.y / car.speed; // Approximation du temps basé sur la distance parcourue
            const zigzagOffset = Math.sin(timeElapsed * car.zigzagFrequency + car.zigzagPhase) * car.zigzagAmplitude;
            car.x = car.initialX + zigzagOffset;
            
            // S'assurer que la moto reste dans les limites
            car.x = Math.max(25, Math.min(375, car.x));
        }

        if (car.canChangeLane && currentTime - car.lastLaneChange > 2000) {
            // Vérifier la distance avec le joueur avant de changer de voie
            const distanceToPlayer = Math.abs(car.y - gameState.playerY);
            const safeDistance = 150; // Distance minimale pour changer de voie
            
            if (distanceToPlayer > safeDistance) {
                const lanes = [33, 100, 167, 234, 301, 367];
                const currentLaneIndex = lanes.indexOf(car.targetX);
                if (currentLaneIndex !== -1 && Math.random() < 0.3) {
                    // Limiter le changement à 2 voies adjacentes maximum
                    const possibleLanes = [];
                    if (currentLaneIndex > 0) possibleLanes.push(lanes[currentLaneIndex - 1]);
                    if (currentLaneIndex < lanes.length - 1) possibleLanes.push(lanes[currentLaneIndex + 1]);
                    if (currentLaneIndex > 1) possibleLanes.push(lanes[currentLaneIndex - 2]);
                    if (currentLaneIndex < lanes.length - 2) possibleLanes.push(lanes[currentLaneIndex + 2]);
                    
                    if (possibleLanes.length > 0) {
                        car.targetX = possibleLanes[Math.floor(Math.random() * possibleLanes.length)];
                        car.lastLaneChange = currentTime;
                    }
                }
            }
        }

        if (car.x !== car.targetX) {
            const diff = car.targetX - car.x;
            car.x += Math.sign(diff) * Math.min(Math.abs(diff), 2);
        }

        if (car.y > gameState.playerY + 50 && !car.scored) {
            gameState.score += 1;
            car.scored = true;
        }

        return car.y < canvas.height + 70;
    });
}

function updateBonuses() {
    const config = getLevelConfig(gameState.level);
    const bonusSpeed = 3 + (config.carSpeed - 2) * 0.5; // Moitié moins vite que l'accélération des voitures
    
    gameState.bonuses = gameState.bonuses.filter(bonus => {
        bonus.y += bonusSpeed;
        return bonus.y < canvas.height + 30;
    });
}


function startBossMode() {
    gameState.bossMode = true;
    // Ne pas supprimer les voitures existantes, elles continuent leur route
    gameState.bonuses = [];
    gameState.projectiles = [];
    gameState.bombs = [];

    gameState.boss = {
        x: 200,
        y: 50,
        health: 1,
        lastShot: 0,
        lastBomb: 0,
        moveDirection: 1,
        allies: [],
        // Nouveau système de tir séquentiel
        currentShotSequence: null,
        sequenceIndex: 0,
        nextShotTime: 0,
        // Choisir un boss aléatoire parmi ceux disponibles
        imageIndex: gameState.bossImages.length > 0 ? Math.floor(Math.random() * gameState.bossImages.length) : 0
    };

    if (gameState.level >= 10) {
        for (let i = 0; i < Math.floor(gameState.level / 20); i++) {
            gameState.boss.allies.push({
                x: 100 + i * 100,
                y: 80,
                lastShot: 0
            });
        }
    }
}

function endBossMode() {
    gameState.bossMode = false;
    gameState.boss = null;
    // Ne pas supprimer les projectiles et bombes, ils continuent leur route
    gameState.levelStartTime = performance.now();
}

function updateBoss() {
    if (!gameState.boss) return;

    const currentTime = performance.now();
    const boss = gameState.boss;

    boss.x += boss.moveDirection * 1;
    if (boss.x <= 80 || boss.x >= 320) {
        boss.moveDirection *= -1;
    }

    const shootRate = Math.max(2500 - (gameState.level * 50), 800);
    
    // Démarrer une nouvelle séquence de tir
    if (!boss.currentShotSequence && currentTime - boss.lastShot > shootRate) {
        const numShots = Math.min(1 + Math.floor((gameState.level - 1) / 5), 5);
        
        // Calculer l'angle de base vers le joueur (limité vers le bas)
        const deltaX = gameState.playerX - boss.x;
        const deltaY = Math.max(50, gameState.playerY - boss.y); // Forcer deltaY positif minimum
        const baseAngle = Math.atan2(deltaY, deltaX);
        
        // Créer la séquence de tirs (éventail intelligent)
        boss.currentShotSequence = [];
        for (let i = 0; i < numShots; i++) {
            const angleOffset = (i - Math.floor(numShots/2)) * 0.25; // Espacement entre les tirs
            boss.currentShotSequence.push({
                angle: baseAngle + angleOffset,
                delay: i * (100 + Math.random() * 200) // Délai variable entre 100-300ms
            });
        }
        
        boss.sequenceIndex = 0;
        boss.nextShotTime = currentTime + boss.currentShotSequence[0].delay;
        boss.lastShot = currentTime;
    }
    
    // Tirer les projectiles de la séquence un par un
    if (boss.currentShotSequence && currentTime >= boss.nextShotTime) {
        const shotData = boss.currentShotSequence[boss.sequenceIndex];
        
        // Tirer le projectile
        const speed = 2 + (gameState.level * 0.1);
        gameState.projectiles.push({
            x: boss.x,
            y: boss.y + 30,
            vx: Math.cos(shotData.angle) * speed,
            vy: Math.sin(shotData.angle) * speed
        });
        
        boss.sequenceIndex++;
        
        // Préparer le prochain tir ou terminer la séquence
        if (boss.sequenceIndex < boss.currentShotSequence.length) {
            boss.nextShotTime = currentTime + boss.currentShotSequence[boss.sequenceIndex].delay;
        } else {
            // Séquence terminée
            boss.currentShotSequence = null;
        }
    }

    if (gameState.level >= 20) {
        const bombRate = Math.max(2000 - (gameState.level * 20), 800);
        if (currentTime - boss.lastBomb > bombRate) {
            // Lancer la bombe vers la position prédite du joueur
            const predictedPlayerX = gameState.playerX + gameState.playerVelocityX * 30; // Prédiction sur 30 frames
            const targetX = Math.max(50, Math.min(350, predictedPlayerX)); // Limiter aux bords de la route
            
            gameState.bombs.push({
                x: boss.x, // Commencer depuis le boss
                y: boss.y + 20,
                targetX: targetX,
                targetY: gameState.playerY,
                vx: 0,
                vy: 0,
                timer: 90, // Timer pour la phase de vol
                radius: 50 + gameState.level,
                phase: 'flying' // 'flying' puis 'exploding'
            });
            boss.lastBomb = currentTime;
        }
    }

    boss.allies.forEach(ally => {
        if (currentTime - ally.lastShot > shootRate * 2) {
            gameState.projectiles.push({
                x: ally.x,
                y: ally.y + 20,
                vx: 0,
                vy: 4
            });
            ally.lastShot = currentTime;
        }
    });
}

function updateProjectiles() {
    gameState.projectiles = gameState.projectiles.filter(proj => {
        proj.x += proj.vx;
        proj.y += proj.vy;
        return proj.y < canvas.height + 20 && proj.y > -20 && proj.x > -20 && proj.x < canvas.width + 20;
    });
}

function updateBombs() {
    gameState.bombs = gameState.bombs.filter(bomb => {
        if (bomb.phase === 'flying') {
            // Mouvement linéaire vers la cible
            const speed = 3; // Vitesse ajustable en pixels par frame
            const dx = bomb.targetX - bomb.x;
            const dy = bomb.targetY - bomb.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > speed) {
                // Se déplacer vers la cible
                bomb.x += (dx / distance) * speed;
                bomb.y += (dy / distance) * speed;
            } else {
                // Arrivé à destination, exploser
                bomb.phase = 'exploding';
                bomb.timer = 60; // Durée d'explosion
            }
            
            // Supprimer la bombe si elle dépasse largement la position du joueur
            if (bomb.y > gameState.playerY + 100) {
                return false; // Supprimer la bombe
            }
        } else if (bomb.phase === 'exploding') {
            // Phase d'explosion
            bomb.timer--;
            if (bomb.timer <= 0) {
                return false; // Supprimer la bombe
            }
        }
        
        return true;
    });
}

function checkCollisions() {
    const config = getLevelConfig(gameState.level);

    // Vérifier les collisions avec les voitures (même en mode boss)
    gameState.cars = gameState.cars.filter(car => {
        // Hitbox adaptée au type de véhicule
        let hitboxWidth, hitboxHeight;
        if (car.type === 'truck') {
            hitboxWidth = 35;
            hitboxHeight = 180;
        } else if (car.type === 'moto') {
            hitboxWidth = 20;
            hitboxHeight = 28;
        } else {
            hitboxWidth = 25;
            hitboxHeight = 35;
        }
        
        // Collision rectangulaire plus précise
        const playerLeft = gameState.playerX - 12;
        const playerRight = gameState.playerX + 12;
        const playerTop = gameState.playerY - 15;
        const playerBottom = gameState.playerY + 15;
        
        const carLeft = car.x - hitboxWidth / 2;
        const carRight = car.x + hitboxWidth / 2;
        const carTop = car.y - hitboxHeight / 2;
        const carBottom = car.y + hitboxHeight / 2;
        
        const collision = playerLeft < carRight && 
                         playerRight > carLeft && 
                         playerTop < carBottom && 
                         playerBottom > carTop;

        if (collision) {
            gameState.lives -= 1;
            gameState.crashAnimation = 20;
            // Créer l'effet de collision BD
            createCollisionEffect((gameState.playerX + car.x) / 2, (gameState.playerY + car.y) / 2);
            if (gameState.lives <= 0 && !gameState.debugMode.active) {
                endGame();
            }
            return false;
        }
        return true;
    });

    // Vérifier les collisions avec les bonus (seulement hors mode boss)
    if (!gameState.bossMode) {
        gameState.bonuses = gameState.bonuses.filter(bonus => {
            const distance = Math.sqrt(
                Math.pow(gameState.playerX - bonus.x, 2) +
                Math.pow(gameState.playerY - bonus.y, 2)
            );

            if (distance < 25) {
                gameState.score += 5;
                createNotification('+5 points', '#f1c40f');
                return false;
            }
            return true;
        });
    }

    gameState.projectiles = gameState.projectiles.filter(proj => {
        const distance = Math.sqrt(
            Math.pow(gameState.playerX - proj.x, 2) +
            Math.pow(gameState.playerY - proj.y, 2)
        );

        if (distance < 15) {
            gameState.lives -= 1;
            gameState.crashAnimation = 15;
            // Créer l'effet de collision BD
            createCollisionEffect(gameState.playerX, gameState.playerY);
            if (gameState.lives <= 0) {
                endGame();
            }
            return false;
        }
        return true;
    });

    gameState.bombs.forEach(bomb => {
        if (bomb.phase === 'exploding' && bomb.timer > 30 && !bomb.hasHit) { // Seulement pendant l'explosion active et si pas déjà touché
            const distance = Math.sqrt(
                Math.pow(gameState.playerX - bomb.x, 2) +
                Math.pow(gameState.playerY - bomb.y, 2)
            );

            if (distance < bomb.radius) {
                bomb.hasHit = true; // Marquer comme ayant touché pour éviter les hits multiples
                gameState.lives -= 1;
                gameState.crashAnimation = 30;
                // Créer l'effet de collision BD
                createCollisionEffect(gameState.playerX, gameState.playerY);
                if (gameState.lives <= 0 && !gameState.debugMode.active) {
                    endGame();
                }
            }
        }
    });
}

function checkLevelProgression() {
    // Mode debug boss permanent
    if (gameState.debugMode.active && gameState.debugMode.vehicleFilter === 'boss') {
        if (!gameState.bossMode) {
            startBossMode();
        }
        return;
    }

    const currentTime = performance.now();
    const timeSinceLevel = (currentTime - gameState.levelStartTime) / 1000;
    
    if (timeSinceLevel >= gameState.levelDuration && !gameState.bossMode) {
        startBossMode();
    } else if (timeSinceLevel >= gameState.levelDuration + 10 && gameState.bossMode) {
        endBossMode();
        gameState.level = Math.min(gameState.level + 1, 25);
        // Ajouter 5 vies tous les 5 niveaux
        if (gameState.level % 5 === 0) {
            gameState.lives += 5;
            createNotification('+5 vies', '#22c55e');
        }
        document.getElementById('levelDisplay').textContent = gameState.level;
        showLevelUpMessage();
    }
}

function showLevelUpMessage() {
    const message = document.createElement('div');
    message.style.position = 'absolute';
    message.style.top = '20px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.background = 'rgba(46, 204, 113, 0.9)';
    message.style.color = 'white';
    message.style.padding = '15px 25px';
    message.style.borderRadius = '10px';
    message.style.fontSize = '18px';
    message.style.fontWeight = 'bold';
    message.style.zIndex = '30';
    message.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    message.textContent = `🎉 NIVEAU ${gameState.level} ! 🎉`;

    document.getElementById('gameContainer').appendChild(message);

    setTimeout(() => {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    }, 2000);
}

function updateTime(deltaTime) {
    gameState.timeLeft -= deltaTime / 1000;

    checkLevelProgression();
}

function drawRoad() {
    // Route complète sans bandes blanches
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);

    // Lignes de séparation des voies (défilantes) - 6 voies égales
    const lanePositions = [66, 133, 200, 267, 334];
    ctx.fillStyle = '#5a6b7d';
    const roadOffset = (performance.now() * GAME_CONSTANTS.LINE_SPEED_MULTIPLIER) % 30; // Défilement basé sur le temps
    lanePositions.forEach(x => {
        for (let y = -30; y < GAME_CONSTANTS.CANVAS_HEIGHT + 30; y += 30) {
            const lineY = y + roadOffset;
            ctx.fillRect(x - 1, lineY, 2, 15);
        }
    });
}

function drawVehicle(vehicle) {
    let vehicleImage;
    if (vehicle.type === 'truck') {
        vehicleImage = gameState.truckImages[vehicle.imageIndex];
    } else if (vehicle.type === 'moto') {
        vehicleImage = gameState.motoImages[vehicle.imageIndex];
    } else {
        vehicleImage = gameState.enemyCarImages[vehicle.imageIndex];
    }
    
    if (vehicleImage && vehicleImage.complete) {
        const sizes = VEHICLE_SIZES[vehicle.type] || VEHICLE_SIZES.car;
        ctx.drawImage(vehicleImage, 
            vehicle.x - sizes.width/2, 
            vehicle.y - sizes.height/2, 
            sizes.width, sizes.height);
    }
}

function drawPlayer() {
    const shake = gameState.crashAnimation > 0 ? Math.sin(gameState.crashAnimation * 0.5) * 2 : 0;
    
    if (gameState.playerCarImage && gameState.playerCarImage.complete) {
        if (gameState.crashAnimation > 0) {
            ctx.filter = 'hue-rotate(180deg) brightness(1.5)';
        }
        
        ctx.drawImage(gameState.playerCarImage, 
            gameState.playerX - 18 + shake, 
            gameState.playerY - 25, 
            36, 50);
            
        if (gameState.crashAnimation > 0) {
            ctx.filter = 'none';
            gameState.crashAnimation--;
        }
    }
}

function drawBonus(bonus) {
    if (gameState.starBonusImage && gameState.starBonusImage.complete) {
        // Dessiner l'étoile SVG
        ctx.drawImage(gameState.starBonusImage, 
            bonus.x - 12, 
            bonus.y - 12, 
            24, 24);
    } else {
        // Fallback simple en attendant le chargement
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(bonus.x, bonus.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⭐', bonus.x, bonus.y + 4);
    }
}

function drawBoss() {
    if (!gameState.boss) return;
    
    const boss = gameState.boss;
    
    // Dessiner le boss avec SVG si disponible
    if (gameState.bossImages.length > 0 && gameState.bossImages[boss.imageIndex] && gameState.bossImages[boss.imageIndex].complete) {
        const bossImage = gameState.bossImages[boss.imageIndex];
        ctx.drawImage(bossImage, 
            boss.x - 50, 
            boss.y - 30, 
            100, 60);
    } else {
        // Fallback avec formes géométriques
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(boss.x - 15, boss.y - 10, 30, 20);
        
        ctx.fillStyle = '#34495e';
        ctx.fillRect(boss.x - 35, boss.y - 5, 15, 10);
        ctx.fillRect(boss.x + 20, boss.y - 5, 15, 10);
    }
    
    // Dessiner les alliés (toujours en forme géométrique)
    boss.allies.forEach(ally => {
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(ally.x - 10, ally.y - 8, 20, 16);
    });
}

function drawProjectiles() {
    gameState.projectiles.forEach(proj => {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawBombs() {
    gameState.bombs.forEach(bomb => {
        if (bomb.phase === 'flying') {
            // Phase de vol - dessiner la bombe en mouvement
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(bomb.x, bomb.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Effet de traînée
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(bomb.x, bomb.y, 10, 0, Math.PI * 2);
            ctx.stroke();
            
            // Indicateur de cible
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bomb.targetX, bomb.targetY, 30, 0, Math.PI * 2);
            ctx.stroke();
            
        } else if (bomb.phase === 'exploding') {
            // Phase d'explosion
            const explosionProgress = (60 - bomb.timer) / 60;
            const radius = bomb.radius * explosionProgress;
            const opacity = Math.max(0, 1 - explosionProgress);
            
            // Explosion principale
            ctx.fillStyle = `rgba(255, 100, 0, ${opacity * 0.6})`;
            ctx.beginPath();
            ctx.arc(bomb.x, bomb.y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Cercle extérieur
            ctx.strokeStyle = `rgba(231, 76, 60, ${opacity})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(bomb.x, bomb.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Cercle intérieur brillant
            if (explosionProgress < 0.5) {
                ctx.fillStyle = `rgba(255, 255, 100, ${opacity * 0.8})`;
                ctx.beginPath();
                ctx.arc(bomb.x, bomb.y, radius * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });
}

function draw() {
    drawRoad();
    
    // Dessiner les entités du jeu
    gameState.cars.forEach(car => drawVehicle(car));
    gameState.bonuses.forEach(bonus => drawBonus(bonus));
    
    if (gameState.bossMode && gameState.boss) {
        drawBoss();
    }
    
    drawProjectiles();
    drawBombs();
    
    // Dessiner le joueur
    drawPlayer();
    
    // Dessiner l'effet de collision
    drawCollisionEffect();
    
    // Dessiner la notification
    drawNotification();
    
    // Indicateur mode debug (toujours appeler pour gérer l'affichage/suppression)
    drawDebugIndicator();
}

function drawCollisionEffect() {
    if (gameState.collisionEffect) {
        const effect = gameState.collisionEffect;
        
        // Animation d'échelle (explosion puis contraction)
        let size;
        if (effect.timer > 10) {
            size = (15 - effect.timer) * 12; // Expansion rapide, doublée
        } else {
            size = effect.timer * 6; // Contraction, doublée
        }
        
        // Dessiner le SVG d'explosion si disponible, sinon un cercle simple
        if (gameState.explosionImage && gameState.explosionImage.complete) {
            ctx.drawImage(gameState.explosionImage, 
                effect.x - size/2, 
                effect.y - size/2, 
                size, size);
        } else {
            // Fallback simple en attendant le chargement
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, size/4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Décrémenter le timer
        effect.timer--;
        if (effect.timer <= 0) {
            gameState.collisionEffect = null;
        }
    }
}

function drawNotification() {
    if (gameState.livesNotification) {
        const notification = gameState.livesNotification;
        
        // Animation de montée et de disparition
        notification.y -= 1; // Remonte de 1 pixel par frame
        notification.opacity = notification.timer / 120; // Disparition progressive
        
        // Dessiner le texte
        ctx.save();
        ctx.globalAlpha = notification.opacity;
        ctx.fillStyle = notification.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        
        // Contour blanc
        ctx.strokeText(notification.text, GAME_CONSTANTS.CANVAS_WIDTH / 2, notification.y);
        // Texte coloré
        ctx.fillText(notification.text, GAME_CONSTANTS.CANVAS_WIDTH / 2, notification.y);
        
        ctx.restore();
        
        // Décrémenter le timer
        notification.timer--;
        if (notification.timer <= 0) {
            gameState.livesNotification = null;
        }
    }
}

function drawDebugIndicator() {
    if (!gameState.debugMode.active) {
        // Supprimer l'élément debug s'il existe et que le mode debug est désactivé
        const debugElement = document.getElementById('debugInfo');
        if (debugElement) {
            debugElement.remove();
        }
        return;
    }
    
    // Afficher dans la colonne de gauche, en bas
    const debugElement = document.getElementById('debugInfo');
    if (!debugElement) {
        // Créer l'élément debug s'il n'existe pas
        const div = document.createElement('div');
        div.id = 'debugInfo';
        div.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            z-index: 1000;
            min-width: 180px;
        `;
        document.body.appendChild(div);
    }
    
    let modeText = '';
    switch(gameState.debugMode.vehicleFilter) {
        case 'car': modeText = 'Que des voitures'; break;
        case 'truck': modeText = 'Que des camions'; break;
        case 'moto': modeText = 'Que des motos'; break;
        case 'boss': 
            modeText = `Boss permanent (Niveau ${gameState.level})<br><small>+/- pour changer niveau</small>`; 
            break;
    }
    
    document.getElementById('debugInfo').innerHTML = `
        <strong>MODE DEBUG</strong><br>
        ${modeText}
    `;
}

function drawPauseOverlay() {
    // Overlay semi-transparent
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Texte PAUSE
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSE', canvas.width / 2, canvas.height / 2 - 20);
    
    // Instructions
    ctx.font = '20px Arial';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText('Appuyez sur P pour reprendre', canvas.width / 2, canvas.height / 2 + 30);
}

function drawCountdownOverlay() {
    // Overlay semi-transparent
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Chiffre du décompte
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(gameState.countdown.value.toString(), canvas.width / 2, canvas.height / 2 + 20);
    
    // Texte explicatif
    ctx.font = '20px Arial';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText('Préparez-vous...', canvas.width / 2, canvas.height / 2 - 50);
}

function updateUI() {
    document.getElementById('timeDisplay').textContent = Math.max(0, Math.ceil(gameState.timeLeft));
    document.getElementById('scoreDisplay').textContent = gameState.score;
    document.getElementById('livesDisplay').textContent = gameState.lives;
    updateLeaderboard();
}

function updateLeaderboard() {
    const highScores = JSON.parse(localStorage.getItem('highScores')) || [];
    const liveScoresList = document.getElementById('liveScoresList');
    
    if (highScores.length === 0) {
        liveScoresList.innerHTML = '<div style="text-align: center; color: #bdc3c7; font-size: 12px;">Aucun score</div>';
        return;
    }
    
    liveScoresList.innerHTML = highScores.slice(0, 10).map((score, index) => `
        <div class="live-score-item">
            <span class="live-score-rank">#${index + 1}</span>
            <span class="live-score-name">${score.name}</span>
            <span class="live-score-points">${score.score}</span>
            <span class="live-score-level">Nv${score.maxLevel || score.level}</span>
        </div>
    `).join('');
}

function gameLoop() {
    if (!gameState.running && !gameState.countdown.active) return;

    const currentTime = performance.now();
    
    // Gestion du décompte
    if (gameState.countdown.active) {
        gameState.countdown.timer--;
        
        if (gameState.countdown.timer <= 0) {
            gameState.countdown.value--;
            if (gameState.countdown.value <= 0) {
                // Décompte terminé
                gameState.countdown.active = false;
                if (gameState.countdown.onComplete) {
                    gameState.countdown.onComplete();
                }
            } else {
                // Passer au chiffre suivant
                gameState.countdown.timer = GAME_CONSTANTS.COUNTDOWN_DIGIT_FRAMES;
            }
        }
        
        draw();
        drawCountdownOverlay();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Si le jeu est en pause, on dessine seulement et on sort
    if (gameState.paused) {
        draw();
        drawPauseOverlay();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const deltaTime = currentTime - gameState.lastUpdate;
    gameState.lastUpdate = currentTime;

    // Mettre à jour le joueur seulement si le jeu est vraiment en cours
    if (!gameState.paused) {
        updatePlayer();
    }

    if (gameState.bossMode) {
        updateBoss();
        updateProjectiles();
        updateBombs();
        updateCars(); // Les voitures continuent d'avancer pendant le mode boss
        updateBonuses();
    } else {
        spawnCar(currentTime);
        spawnBonus(currentTime);
        updateCars();
        updateBonuses();
        // Continuer à mettre à jour les projectiles même après le boss
        updateProjectiles();
        updateBombs();
    }

    checkCollisions();
    updateTime(deltaTime);

    draw();
    updateUI();

    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState.running = false;

    document.getElementById('finalScore').textContent = `Score Final: ${gameState.score}`;
    
    // Pré-remplir le champ nom avec le dernier nom utilisé
    const nameInput = document.getElementById('playerName');
    nameInput.value = gameState.lastPlayerName;
    
    // Afficher les scores et l'écran de fin
    displayHighScores();
    document.getElementById('gameOverScreen').style.display = 'flex';
    
    // Focus sur le champ nom pour saisie rapide
    setTimeout(() => nameInput.focus(), 100);
}

function saveScore() {
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        alert('Veuillez entrer votre nom !');
        return;
    }
    
    // Sauvegarder le nom pour la prochaine fois
    gameState.lastPlayerName = playerName;
    localStorage.setItem('lastPlayerName', playerName);
    
    // Récupérer les scores existants
    let highScores = JSON.parse(localStorage.getItem('highScores')) || [];
    
    // Ajouter le nouveau score
    const newScore = {
        name: playerName,
        score: gameState.score,
        level: gameState.level,
        maxLevel: gameState.level, // Niveau max atteint
        date: new Date().toLocaleDateString('fr-FR')
    };
    
    highScores.push(newScore);
    
    // Trier par score décroissant et garder seulement les 10 meilleurs
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10);
    
    // Sauvegarder
    localStorage.setItem('highScores', JSON.stringify(highScores));
    
    // Mettre à jour le meilleur score global
    if (gameState.score > gameState.bestScore) {
        gameState.bestScore = gameState.score;
        localStorage.setItem('bestScore', gameState.bestScore);
    }
    
    // Actualiser l'affichage
    displayHighScores();
    
    // Cacher le formulaire et retourner à l'écran d'accueil
    document.getElementById('scoreForm').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'block';
}

function displayHighScores() {
    updateLeaderboard();
}

function showStartScreen() {
    document.getElementById('startScreen').style.display = 'flex';
    document.getElementById('gameOverScreen').style.display = 'none';
    // Réafficher le formulaire pour la prochaine partie
    document.getElementById('scoreForm').style.display = 'block';
}

function resetScores() {
    if (confirm('⚠️ Êtes-vous sûr de vouloir supprimer TOUS les scores sauvegardés ?\n\nCette action est irréversible !')) {
        localStorage.removeItem('highScores');
        localStorage.removeItem('bestScore');
        gameState.bestScore = 0;
        displayHighScores();
        alert('✅ Tous les scores ont été supprimés !');
    }
}


// Gestion du slider de niveau
document.getElementById('levelSlider').addEventListener('input', function() {
    document.getElementById('levelValue').textContent = this.value;
});

function startGameFromSlider() {
    const level = parseInt(document.getElementById('levelSlider').value);
    startNewGame(level);
}

function handleNameInput(event) {
    if (event.key === 'Enter') {
        saveScore();
    }
}

// Charger l'image SVG de la voiture du joueur
function loadPlayerCar() {
    const img = new Image();
    img.onload = function() {
        gameState.playerCarImage = img;
    };
    img.src = 'svg/vehicules/player.svg';
}

function loadEnemyCars() {
    const colors = ['red', 'blue', 'green', 'yellow', 'purple'];
    gameState.enemyCarImages = [];
    gameState.truckImages = [];
    gameState.motoImages = [];
    
    // Charger les voitures (renommées en car-)
    colors.forEach((color, index) => {
        const img = new Image();
        img.onload = function() {
            gameState.enemyCarImages[index] = img;
        };
        img.src = `svg/vehicules/car-${color}.svg`;
    });
    
    // Charger les camions (seulement 3 couleurs)
    const truckColors = ['red', 'blue', 'green'];
    truckColors.forEach((color, index) => {
        const img = new Image();
        img.onload = function() {
            gameState.truckImages[index] = img;
        };
        img.src = `svg/vehicules/truck-${color}.svg`;
    });
    
    // Charger les motos (seulement 3 couleurs)
    const motoColors = ['red', 'blue', 'green'];
    motoColors.forEach((color, index) => {
        const img = new Image();
        img.onload = function() {
            gameState.motoImages[index] = img;
        };
        img.src = `svg/vehicules/moto-${color}.svg`;
    });
}

async function loadBosses() {
    gameState.bossImages = [];
    
    // Fonction pour essayer de charger un boss
    const tryLoadBoss = (index) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                gameState.bossImages[index] = img;
                resolve(true);
            };
            img.onerror = function() {
                resolve(false);
            };
            img.src = `svg/bosses/boss-${index + 1}.svg`;
        });
    };
    
    // Essayer de charger les boss (jusqu'à 10 max)
    for (let i = 0; i < 10; i++) {
        const loaded = await tryLoadBoss(i);
        if (!loaded) break; // Arrêter si le fichier n'existe pas
    }
    
    console.log(`${gameState.bossImages.length} boss(es) chargé(s)`);
}

function loadExplosion() {
    const img = new Image();
    img.onload = () => {
        gameState.explosionImage = img;
    };
    img.src = 'svg/misc/explosion.svg';
}

function loadStarBonus() {
    const img = new Image();
    img.onload = () => {
        gameState.starBonusImage = img;
    };
    img.src = 'svg/misc/star-bonus.svg';
}

function showDebugMenu() {
    const choice = prompt(`Mode Debug - Choisissez le type de véhicules à tester :
    
1. Mode normal (tous véhicules)
2. Que des voitures
3. Que des camions  
4. Que des motos
5. Que des boss (mode boss permanent)

Tapez le numéro de votre choix :`);
    
    switch(choice) {
        case '1':
            gameState.debugMode.active = false;
            gameState.debugMode.vehicleFilter = 'normal';
            break;
        case '2':
            gameState.debugMode.active = true;
            gameState.debugMode.vehicleFilter = 'car';
            break;
        case '3':
            gameState.debugMode.active = true;
            gameState.debugMode.vehicleFilter = 'truck';
            break;
        case '4':
            gameState.debugMode.active = true;
            gameState.debugMode.vehicleFilter = 'moto';
            break;
        case '5':
            gameState.debugMode.active = true;
            gameState.debugMode.vehicleFilter = 'boss';
            break;
        default:
            return; // Annuler
    }
    
    // Démarrer le jeu avec le mode debug
    const level = parseInt(document.getElementById('levelSlider').value);
    startNewGame(level);
}

// Initialiser les images et le classement au chargement
loadPlayerCar();
loadEnemyCars();
loadBosses();
loadExplosion();
loadStarBonus();
updateLeaderboard();