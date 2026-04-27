class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);

        this.camera = new THREE.PerspectiveCamera(
            60,
            GAME_CONFIG.CANVAS_WIDTH / GAME_CONFIG.CANVAS_HEIGHT,
            0.1,
            1000
        );
        this.camera.position.set(0, 400, 500);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        });
        this.renderer.setSize(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

        this.playerMeshes = [];
        this.effectMeshes = [];
        this.tempEffectMeshes = [];
        this.aimingLine = null;

        // 动画系统
        this.animationTime = 0;
        this.playerAnimations = new Map();

        // 状态指示器
        this.stateIndicators = new Map();

        this.setupLighting();
        this.createArena();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 200, 100);
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0x1E90FF, 0.5);
        pointLight.position.set(0, 100, 0);
        this.scene.add(pointLight);
    }

    createArena() {
        const radius = GAME_CONFIG.ARENA_RADIUS;

        const arenaGeometry = new THREE.CylinderGeometry(radius, radius, 10, 64);
        const arenaMaterial = new THREE.MeshStandardMaterial({
            color: 0x252540,
            metalness: 0.3,
            roughness: 0.7
        });
        this.arenaMesh = new THREE.Mesh(arenaGeometry, arenaMaterial);
        this.arenaMesh.position.y = -5;
        this.scene.add(this.arenaMesh);

        const edgeGeometry = new THREE.TorusGeometry(radius, 5, 16, 100);
        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x1E90FF,
            emissive: 0x1E90FF,
            emissiveIntensity: 0.5
        });
        const edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial);
        edgeMesh.rotation.x = Math.PI / 2;
        this.scene.add(edgeMesh);

        const gridHelper = new THREE.PolarGridHelper(radius, 8, 8, 64, 0x1E90FF, 0x1E90FF);
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    createHumanoidCharacter(playerId) {
        const colors = CHARACTER_CONFIG.PLAYER_COLORS[playerId];
        const charGroup = new THREE.Group();
        charGroup.playerId = playerId;

        const mainMaterial = new THREE.MeshStandardMaterial({
            color: colors.main, metalness: 0.3, roughness: 0.7
        });
        const secondaryMaterial = new THREE.MeshStandardMaterial({
            color: colors.secondary, metalness: 0.2, roughness: 0.8
        });

        const headGeo = new THREE.SphereGeometry(CHARACTER_CONFIG.HEAD_RADIUS, 16, 16);
        const head = new THREE.Mesh(headGeo, mainMaterial);
        head.position.y = CHARACTER_CONFIG.HEIGHT - CHARACTER_CONFIG.HEAD_RADIUS;
        head.name = 'head';
        charGroup.add(head);

        const torsoGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.TORSO_WIDTH, CHARACTER_CONFIG.TORSO_HEIGHT, CHARACTER_CONFIG.TORSO_DEPTH
        );
        const torso = new THREE.Mesh(torsoGeo, mainMaterial);
        torso.position.y = CHARACTER_CONFIG.HEIGHT - CHARACTER_CONFIG.HEAD_RADIUS * 2 - CHARACTER_CONFIG.TORSO_HEIGHT / 2;
        torso.name = 'torso';
        charGroup.add(torso);

        const leftArmGroup = new THREE.Group();
        leftArmGroup.name = 'leftArm';
        leftArmGroup.position.y = torso.position.y + CHARACTER_CONFIG.TORSO_HEIGHT / 2 - 5;
        leftArmGroup.position.x = -CHARACTER_CONFIG.TORSO_WIDTH / 2 - CHARACTER_CONFIG.UPPER_ARM_WIDTH / 2;

        const leftUpperArmGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.UPPER_ARM_WIDTH, CHARACTER_CONFIG.UPPER_ARM_HEIGHT, CHARACTER_CONFIG.UPPER_ARM_DEPTH
        );
        const leftUpperArm = new THREE.Mesh(leftUpperArmGeo, secondaryMaterial);
        leftUpperArm.position.y = -CHARACTER_CONFIG.UPPER_ARM_HEIGHT / 2;
        leftUpperArm.name = 'leftUpperArm';
        leftArmGroup.add(leftUpperArm);

        const leftLowerArmGroup = new THREE.Group();
        leftLowerArmGroup.name = 'leftLowerArm';
        leftLowerArmGroup.position.y = -CHARACTER_CONFIG.UPPER_ARM_HEIGHT;

        const leftLowerArmGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.LOWER_ARM_WIDTH, CHARACTER_CONFIG.LOWER_ARM_HEIGHT, CHARACTER_CONFIG.LOWER_ARM_DEPTH
        );
        const leftLowerArm = new THREE.Mesh(leftLowerArmGeo, secondaryMaterial);
        leftLowerArm.position.y = -CHARACTER_CONFIG.LOWER_ARM_HEIGHT / 2;
        leftLowerArm.name = 'leftLowerArmMesh';
        leftLowerArmGroup.add(leftLowerArm);
        leftArmGroup.add(leftLowerArmGroup);
        charGroup.add(leftArmGroup);

        const rightArmGroup = new THREE.Group();
        rightArmGroup.name = 'rightArm';
        rightArmGroup.position.y = leftArmGroup.position.y;
        rightArmGroup.position.x = CHARACTER_CONFIG.TORSO_WIDTH / 2 + CHARACTER_CONFIG.UPPER_ARM_WIDTH / 2;

        const rightUpperArmGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.UPPER_ARM_WIDTH, CHARACTER_CONFIG.UPPER_ARM_HEIGHT, CHARACTER_CONFIG.UPPER_ARM_DEPTH
        );
        const rightUpperArm = new THREE.Mesh(rightUpperArmGeo, secondaryMaterial);
        rightUpperArm.position.y = -CHARACTER_CONFIG.UPPER_ARM_HEIGHT / 2;
        rightUpperArm.name = 'rightUpperArm';
        rightArmGroup.add(rightUpperArm);

        const rightLowerArmGroup = new THREE.Group();
        rightLowerArmGroup.name = 'rightLowerArm';
        rightLowerArmGroup.position.y = -CHARACTER_CONFIG.UPPER_ARM_HEIGHT;

        const rightLowerArmGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.LOWER_ARM_WIDTH, CHARACTER_CONFIG.LOWER_ARM_HEIGHT, CHARACTER_CONFIG.LOWER_ARM_DEPTH
        );
        const rightLowerArm = new THREE.Mesh(rightLowerArmGeo, secondaryMaterial);
        rightLowerArm.position.y = -CHARACTER_CONFIG.LOWER_ARM_HEIGHT / 2;
        rightLowerArm.name = 'rightLowerArmMesh';
        rightLowerArmGroup.add(rightLowerArm);
        rightArmGroup.add(rightLowerArmGroup);
        charGroup.add(rightArmGroup);

        const hipY = torso.position.y - CHARACTER_CONFIG.TORSO_HEIGHT / 2;

        const leftLegGroup = new THREE.Group();
        leftLegGroup.name = 'leftLeg';
        leftLegGroup.position.y = hipY;
        leftLegGroup.position.x = -CHARACTER_CONFIG.TORSO_WIDTH / 4;

        const leftUpperLegGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.UPPER_LEG_WIDTH, CHARACTER_CONFIG.UPPER_LEG_HEIGHT, CHARACTER_CONFIG.UPPER_LEG_DEPTH
        );
        const leftUpperLeg = new THREE.Mesh(leftUpperLegGeo, secondaryMaterial);
        leftUpperLeg.position.y = -CHARACTER_CONFIG.UPPER_LEG_HEIGHT / 2;
        leftUpperLeg.name = 'leftUpperLeg';
        leftLegGroup.add(leftUpperLeg);

        const leftLowerLegGroup = new THREE.Group();
        leftLowerLegGroup.name = 'leftLowerLeg';
        leftLowerLegGroup.position.y = -CHARACTER_CONFIG.UPPER_LEG_HEIGHT;

        const leftLowerLegGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.LOWER_LEG_WIDTH, CHARACTER_CONFIG.LOWER_LEG_HEIGHT, CHARACTER_CONFIG.LOWER_LEG_DEPTH
        );
        const leftLowerLeg = new THREE.Mesh(leftLowerLegGeo, secondaryMaterial);
        leftLowerLeg.position.y = -CHARACTER_CONFIG.LOWER_LEG_HEIGHT / 2;
        leftLowerLeg.name = 'leftLowerLegMesh';
        leftLowerLegGroup.add(leftLowerLeg);
        leftLegGroup.add(leftLowerLegGroup);
        charGroup.add(leftLegGroup);

        const rightLegGroup = new THREE.Group();
        rightLegGroup.name = 'rightLeg';
        rightLegGroup.position.y = hipY;
        rightLegGroup.position.x = CHARACTER_CONFIG.TORSO_WIDTH / 4;

        const rightUpperLegGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.UPPER_LEG_WIDTH, CHARACTER_CONFIG.UPPER_LEG_HEIGHT, CHARACTER_CONFIG.UPPER_LEG_DEPTH
        );
        const rightUpperLeg = new THREE.Mesh(rightUpperLegGeo, secondaryMaterial);
        rightUpperLeg.position.y = -CHARACTER_CONFIG.UPPER_LEG_HEIGHT / 2;
        rightUpperLeg.name = 'rightUpperLeg';
        rightLegGroup.add(rightUpperLeg);

        const rightLowerLegGroup = new THREE.Group();
        rightLowerLegGroup.name = 'rightLowerLeg';
        rightLowerLegGroup.position.y = -CHARACTER_CONFIG.UPPER_LEG_HEIGHT;

        const rightLowerLegGeo = new THREE.BoxGeometry(
            CHARACTER_CONFIG.LOWER_LEG_WIDTH, CHARACTER_CONFIG.LOWER_LEG_HEIGHT, CHARACTER_CONFIG.LOWER_LEG_DEPTH
        );
        const rightLowerLeg = new THREE.Mesh(rightLowerLegGeo, secondaryMaterial);
        rightLowerLeg.position.y = -CHARACTER_CONFIG.LOWER_LEG_HEIGHT / 2;
        rightLowerLeg.name = 'rightLowerLegMesh';
        rightLowerLegGroup.add(rightLowerLeg);
        rightLegGroup.add(rightLowerLegGroup);
        charGroup.add(rightLegGroup);

        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white'; ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`P${playerId}`, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(30, 30, 1);
        sprite.position.y = CHARACTER_CONFIG.HEIGHT + 15;
        charGroup.add(sprite);

        charGroup.bodyParts = {
            head, torso,
            leftArm: leftArmGroup, rightArm: rightArmGroup,
            leftUpperArm, rightUpperArm,
            leftLowerArm: leftLowerArmGroup, rightLowerArm: rightLowerArmGroup,
            leftLeg: leftLegGroup, rightLeg: rightLegGroup,
            leftUpperLeg, rightUpperLeg,
            leftLowerLeg: leftLowerLegGroup, rightLowerLeg: rightLowerLegGroup
        };

        charGroup.originalY = 0;

        return charGroup;
    }

    drawPlayer(player, hasShield, playerData = null, isInvisible = false) {
        let charGroup = this.playerMeshes.find(m => m.playerId === player.playerId);

        if (!charGroup) {
            charGroup = this.createHumanoidCharacter(player.playerId);
            this.scene.add(charGroup);
            this.playerMeshes.push(charGroup);
        }

        charGroup.position.set(player.position.x, player.position.y, player.position.z);

        charGroup.traverse((child) => {
            if (child.isMesh) {
                child.material.opacity = isInvisible ? 0.2 : 1.0;
                child.material.transparent = isInvisible;
            }
        });

        if (playerData) {
            this.updateStateIndicators(playerData, charGroup);
        }
    }

    initPlayerAnimation(playerId) {
        return {
            current: 'idle', previous: null, blendTime: 0, blendDuration: 200,
            timers: { idle: 0, walk: 0, attack: 0, hit: 0, charge: 0 },
            params: { walkSpeed: 1.0, attackProgress: 0, hitDirection: { x: 0, y: 0, z: 0 }, chargeLevel: 0 }
        };
    }

    transitionAnimation(animState, newAnim) {
        if (animState.current !== newAnim) {
            animState.previous = animState.current;
            animState.current = newAnim;
            animState.blendTime = 0;
            animState.timers[newAnim] = 0;
        }
    }

    updateAnimations(deltaTime, gameState) {
        this.animationTime += deltaTime;

        if (gameState && gameState.physicsPlayers) {
            gameState.physicsPlayers.forEach(player => {
                let animState = this.playerAnimations.get(player.playerId);
                if (!animState) {
                    animState = this.initPlayerAnimation(player.playerId);
                    this.playerAnimations.set(player.playerId, animState);
                }

                const speed = Math.sqrt(
                    player.velocity.x ** 2 + player.velocity.y ** 2 + player.velocity.z ** 2
                );

                if (speed > 1) {
                    this.transitionAnimation(animState, 'walk');
                    animState.params.walkSpeed = Math.min(speed / 10, 2.0);
                } else if (animState.current !== 'attack' && animState.current !== 'hit') {
                    this.transitionAnimation(animState, 'idle');
                }

                Object.keys(animState.timers).forEach(key => {
                    animState.timers[key] += deltaTime;
                });

                const charGroup = this.playerMeshes.find(m => m.playerId === player.playerId);
                if (charGroup && charGroup.bodyParts) {
                    this.applyAnimationToCharacter(charGroup, animState, deltaTime);
                }
            });
        }
    }

    applyAnimationToCharacter(charGroup, animState, deltaTime) {
        const parts = charGroup.bodyParts;
        const t = this.animationTime;

        if (animState.previous) {
            animState.blendTime += deltaTime;
            if (animState.blendTime >= animState.blendDuration) {
                animState.previous = null;
            }
        }

        const idleBreath = Math.sin(t * 0.003) * 0.02;
        const idleHeadTilt = Math.sin(t * 0.002) * 0.05;
        const walkCycle = t * 0.01 * (animState.params.walkSpeed || 1.0);
        const legSwing = Math.sin(walkCycle) * 0.4;
        const armSwing = Math.sin(walkCycle + Math.PI) * 0.3;
        const attackProgress = animState.current === 'attack' ? Math.min(animState.timers.attack / 300, 1.0) : 0;
        const attackSwing = attackProgress < 0.5 ? Math.sin(attackProgress * Math.PI * 2) : 0;
        const hitProgress = animState.current === 'hit' ? Math.min(animState.timers.hit / 250, 1.0) : 0;
        const hitRecoil = (1 - hitProgress) * 0.3;

        parts.head.rotation.x = idleHeadTilt;
        parts.head.rotation.y = Math.sin(t * 0.001) * 0.03;

        if (animState.current === 'attack') {
            parts.rightArm.rotation.x = -attackSwing * 1.5;
            parts.rightLowerArm.rotation.x = -attackSwing * 0.5;
            parts.leftArm.rotation.x = attackSwing * 0.3;
        } else if (animState.current === 'walk') {
            parts.rightArm.rotation.x = armSwing;
            parts.leftArm.rotation.x = -armSwing;
        } else {
            parts.rightArm.rotation.x = Math.sin(t * 0.001) * 0.05;
            parts.leftArm.rotation.x = -Math.sin(t * 0.001) * 0.05;
        }

        if (animState.current === 'walk') {
            parts.rightLeg.rotation.x = legSwing;
            parts.leftLeg.rotation.x = -legSwing;
            parts.rightLowerLeg.rotation.x = Math.max(0, -legSwing) * 0.3;
            parts.leftLowerLeg.rotation.x = Math.max(0, legSwing) * 0.3;
        } else {
            parts.rightLeg.rotation.x = 0;
            parts.leftLeg.rotation.x = 0;
            parts.rightLowerLeg.rotation.x = 0;
            parts.leftLowerLeg.rotation.x = 0;
        }

        if (animState.current === 'hit') {
            charGroup.rotation.x = hitRecoil * 0.2;
            charGroup.position.y = Math.sin(hitProgress * Math.PI) * 5;
        } else {
            charGroup.rotation.x = 0;
            charGroup.position.y = 0;
        }

        if (animState.current === 'attack' && attackProgress >= 1.0) {
            this.transitionAnimation(animState, 'idle');
        }
        if (animState.current === 'hit' && hitProgress >= 1.0) {
            this.transitionAnimation(animState, 'idle');
        }
    }

    triggerAttackAnimation(playerId) {
        const animState = this.playerAnimations.get(playerId);
        if (animState) {
            this.transitionAnimation(animState, 'attack');
        }
    }

    triggerHitAnimation(playerId, direction) {
        const animState = this.playerAnimations.get(playerId);
        if (animState) {
            animState.params.hitDirection = direction || { x: 1, y: 0, z: 0 };
            this.transitionAnimation(animState, 'hit');
        }
    }

    createEffect(type, params) {
        const effectGroup = new THREE.Group();
        effectGroup.type = type;
        effectGroup.life = params.life || 1000;
        effectGroup.maxLife = params.life || 1000;
        effectGroup.createdAt = this.animationTime;

        switch (type) {
            case 'laser':
                this.buildLaserEffect(effectGroup, params);
                break;
            case 'explosion':
                this.buildExplosionEffect(effectGroup, params);
                break;
            case 'ice':
                this.buildIceEffect(effectGroup, params);
                break;
            case 'quantum':
                this.buildQuantumEffect(effectGroup, params);
                break;
            case 'heat_engine':
                this.buildHeatEngineEffect(effectGroup, params);
                break;
            case 'fire_blast':
                this.buildFireBlastEffect(effectGroup, params);
                break;
        }

        return effectGroup;
    }

    buildLaserEffect(group, params) {
        const start = new THREE.Vector3(params.startX || 0, params.startY || 0, params.startZ || 0);
        const end = new THREE.Vector3(params.endX || 0, params.endY || 0, params.endZ || 0);
        const direction = end.clone().sub(start).normalize();
        const distance = start.distanceTo(end);

        const laserGeo = new THREE.CylinderGeometry(2, 2, distance, 16);
        const laserMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.9 });
        const laser = new THREE.Mesh(laserGeo, laserMat);
        laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        laser.position.copy(start).add(end).multiplyScalar(0.5);
        group.add(laser);

        const glowGeo = new THREE.CylinderGeometry(5, 5, distance, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xFFA500, transparent: true, opacity: 0.3 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.quaternion.copy(laser.quaternion);
        glow.position.copy(laser.position);
        group.add(glow);

        for (let i = 0; i < 10; i++) {
            const particleGeo = new THREE.SphereGeometry(2 + Math.random() * 3, 8, 8);
            const particleMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xFFFF00 : 0xFF8C00, transparent: true, opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeo, particleMat);
            particle.position.copy(end);
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3
            );
            group.add(particle);
        }

        group.userData = { start, end, particles: group.children.filter(c => c.userData.velocity) };
    }

    buildExplosionEffect(group, params) {
        const center = new THREE.Vector3(params.x || 0, params.y || 0, params.z || 0);

        const coreGeo = new THREE.SphereGeometry(15, 32, 32);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 1.0 });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.copy(center);
        group.add(core);

        const ringGeo = new THREE.RingGeometry(5, 20, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xFF4500, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(center);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        for (let i = 0; i < 30; i++) {
            const size = 2 + Math.random() * 4;
            const debrisGeo = new THREE.BoxGeometry(size, size, size);
            const debrisMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xFF4500 : 0xFF8C00, transparent: true, opacity: 0.9
            });
            const debris = new THREE.Mesh(debrisGeo, debrisMat);
            debris.position.copy(center);

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 2 + Math.random() * 4;

            debris.userData.velocity = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed, Math.cos(phi) * speed, Math.sin(phi) * Math.sin(theta) * speed
            );
            debris.userData.angularVelocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2
            );

            group.add(debris);
        }

        group.userData = { center, core, ring };
    }

    buildIceEffect(group, params) {
        const center = new THREE.Vector3(params.x || 0, params.y || 0, params.z || 0);

        for (let i = 0; i < 20; i++) {
            const crystalGeo = new THREE.ConeGeometry(3, 10 + Math.random() * 10, 6);
            const crystalMat = new THREE.MeshBasicMaterial({ color: 0xADD8E6, transparent: true, opacity: 0.7 });
            const crystal = new THREE.Mesh(crystalGeo, crystalMat);

            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (params.radius || 80);
            crystal.position.set(
                center.x + Math.cos(angle) * radius,
                center.y - 10 + Math.random() * 5,
                center.z + Math.sin(angle) * radius
            );
            crystal.rotation.z = (Math.random() - 0.5) * 0.5;
            crystal.userData.originalY = crystal.position.y;
            crystal.userData.floatOffset = Math.random() * Math.PI * 2;

            group.add(crystal);
        }

        const fogGeo = new THREE.SphereGeometry(params.radius || 80, 32, 32);
        const fogMat = new THREE.MeshBasicMaterial({ color: 0xE0FFFF, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
        const fog = new THREE.Mesh(fogGeo, fogMat);
        fog.position.copy(center);
        group.add(fog);

        group.userData = { center };
    }

    buildQuantumEffect(group, params) {
        const center = new THREE.Vector3(params.x || 0, params.y || 0, params.z || 0);

        const sphereGeo = new THREE.SphereGeometry(20, 32, 32);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0x9400D3, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.copy(center);
        group.add(sphere);

        for (let i = 0; i < 15; i++) {
            const cubeGeo = new THREE.BoxGeometry(3, 3, 3);
            const cubeMat = new THREE.MeshBasicMaterial({ color: 0xDA70D6, transparent: true, opacity: 0.8 });
            const cube = new THREE.Mesh(cubeGeo, cubeMat);

            const offset = new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
            cube.position.copy(center).add(offset);
            cube.userData.offset = offset;
            cube.userData.glitchOffset = Math.random() * 1000;

            group.add(cube);
        }

        for (let ring = 0; ring < 3; ring++) {
            const ringGeo = new THREE.TorusGeometry(10 + ring * 10, 2, 16, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x9400D3, transparent: true, opacity: 0.5 });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.copy(center);
            ringMesh.userData.rotationAxis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
            group.add(ringMesh);
        }

        group.userData = { center };
    }

    buildHeatEngineEffect(group, params) {
        const center = new THREE.Vector3(params.x || 0, params.y || 0, params.z || 0);

        for (let i = 0; i < 40; i++) {
            const size = 2 + Math.random() * 5;
            const fireGeo = new THREE.SphereGeometry(size, 8, 8);
            const fireMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xFF4500 : 0xFF8C00, transparent: true, opacity: 0.9
            });
            const fire = new THREE.Mesh(fireGeo, fireMat);

            const theta = Math.random() * Math.PI * 2;
            const radius = Math.random() * 15;
            fire.position.set(
                center.x + Math.cos(theta) * radius, center.y + 10 + Math.random() * 10, center.z + Math.sin(theta) * radius
            );

            fire.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.5, 1 + Math.random() * 2, (Math.random() - 0.5) * 0.5);
            fire.userData.originalPosition = fire.position.clone();
            fire.userData.lifeOffset = Math.random() * 1000;

            group.add(fire);
        }

        group.userData = { center };
    }

    buildFireBlastEffect(group, params) {
        const center = new THREE.Vector3(params.x || 0, params.y || 0, params.z || 0);

        for (let i = 0; i < 5; i++) {
            const ringGeo = new THREE.TorusGeometry(5 + i * 5, 3, 16, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0xFF4500 : 0xFF8C00, transparent: true, opacity: 0.9
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(center);
            ring.rotation.x = -Math.PI / 2;
            ring.userData.expandSpeed = 0.3 + i * 0.1;
            ring.userData.ringIndex = i;
            group.add(ring);
        }

        const fireGeo = new THREE.SphereGeometry(25, 32, 32);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xFF4500, transparent: true, opacity: 0.6 });
        const fire = new THREE.Mesh(fireGeo, fireMat);
        fire.position.copy(center);
        group.add(fire);

        const lightGeo = new THREE.SphereGeometry(10, 16, 16);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9 });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.copy(center);
        group.add(light);

        group.userData = { center, fire, light };
    }

    updateActiveEffects(deltaTime) {
        const currentTime = this.animationTime;

        this.effectMeshes = this.effectMeshes.filter(effect => {
            const age = currentTime - effect.createdAt;
            const lifeProgress = age / effect.maxLife;

            if (lifeProgress >= 1.0) {
                this.scene.remove(effect);
                return false;
            }

            this.updateEffect(effect, lifeProgress, deltaTime);
            return true;
        });
    }

    updateEffect(effect, lifeProgress, deltaTime) {
        switch (effect.type) {
            case 'laser':
                effect.traverse(child => {
                    if (child.isMesh) child.material.opacity = child.material.opacity * 0.95;
                });
                if (effect.userData.particles) {
                    effect.userData.particles.forEach(p => {
                        p.position.add(p.userData.velocity);
                        p.scale.multiplyScalar(0.95);
                    });
                }
                break;
            case 'explosion':
                const { core, ring } = effect.userData;
                const expandFactor = 1 + lifeProgress * 3;
                if (core) { core.scale.setScalar(expandFactor); core.material.opacity = Math.max(0, 1 - lifeProgress); }
                if (ring) { ring.scale.setScalar(expandFactor); ring.material.opacity = Math.max(0, 0.8 - lifeProgress * 0.8); }
                effect.children.forEach(child => {
                    if (child.userData.velocity) {
                        child.position.add(child.userData.velocity);
                        child.userData.velocity.y -= 0.1;
                        child.rotation.x += child.userData.angularVelocity.x;
                        child.rotation.y += child.userData.angularVelocity.y;
                        child.rotation.z += child.userData.angularVelocity.z;
                        child.material.opacity = Math.max(0, 1 - lifeProgress);
                    }
                });
                break;
            case 'ice':
                const t = this.animationTime;
                effect.children.forEach(child => {
                    if (child.userData.originalY !== undefined) {
                        child.position.y = child.userData.originalY + Math.sin(t * 0.003 + child.userData.floatOffset) * 5;
                        child.rotation.y += 0.01;
                    }
                });
                break;
            case 'quantum':
                const tq = this.animationTime;
                const center = effect.userData.center;
                effect.children.forEach(child => {
                    if (child.userData.rotationAxis) {
                        child.rotation.x += 0.02; child.rotation.y += 0.03;
                        child.material.opacity = 0.5 * (1 - lifeProgress);
                    }
                    if (child.userData.glitchOffset !== undefined) {
                        child.visible = !(Math.sin(tq * 0.01 + child.userData.glitchOffset) > 0.7);
                        if (child.visible) {
                            const offset = child.userData.offset.clone();
                            offset.x += Math.sin(tq * 0.005) * 5;
                            offset.y += Math.cos(tq * 0.007) * 5;
                            child.position.copy(center).add(offset);
                        }
                        child.material.opacity = 0.8 * (1 - lifeProgress);
                    }
                });
                break;
            case 'heat_engine':
                const th = this.animationTime;
                effect.children.forEach(child => {
                    if (child.userData.velocity) {
                        const timeOffset = (th + child.userData.lifeOffset) * 0.005;
                        const cycle = (timeOffset % 1.0);
                        child.position.copy(child.userData.originalPosition);
                        child.position.y += cycle * 30;
                        child.material.opacity = 0.9 * (1 - cycle);
                        child.scale.setScalar(1 - cycle * 0.5);
                    }
                });
                break;
            case 'fire_blast':
                const { fire, light } = effect.userData;
                const expandBlast = 1 + lifeProgress * 4;
                effect.children.forEach(child => {
                    if (child.userData.expandSpeed !== undefined) {
                        const ringExpand = 1 + lifeProgress * 5 * child.userData.expandSpeed;
                        child.scale.setScalar(ringExpand);
                        child.material.opacity = Math.max(0, 0.9 - lifeProgress);
                    }
                });
                if (fire) { fire.scale.setScalar(expandBlast); fire.material.opacity = Math.max(0, 0.6 - lifeProgress * 0.6); }
                if (light) { light.scale.setScalar(expandBlast * 0.5); light.material.opacity = Math.max(0, 0.9 - lifeProgress * 1.2); }
                break;
        }
    }

    drawTempEffects(tempEffects, players) {
        if (tempEffects) {
            tempEffects.forEach(effect => {
                const exists = this.effectMeshes.some(e => e.userData && e.userData._sourceId === effect._id);
                if (exists) return;

                let newEffect = null;

                switch (effect.type) {
                    case 'laser':
                    case 'momentum_blast':
                        newEffect = this.createEffect('laser', {
                            startX: effect.startX, startY: (effect.startY || 0) + 35, startZ: effect.startZ,
                            endX: effect.endX, endY: (effect.endY || 0) + 35, endZ: effect.endZ,
                            life: effect.life || 500
                        });
                        break;
                    case 'explosive_charge':
                        newEffect = this.createEffect('explosion', {
                            x: effect.x, y: (effect.y || 0) + 35, z: effect.z, life: effect.life || 700
                        });
                        break;
                    case 'ice_reset':
                        newEffect = this.createEffect('ice', {
                            x: effect.x, y: (effect.y || 0) + 20, z: effect.z, radius: 50, life: effect.life || 800
                        });
                        break;
                    case 'quantum':
                        newEffect = this.createEffect('quantum', {
                            x: effect.x, y: (effect.y || 0) + 35, z: effect.z, life: effect.life || 1000
                        });
                        break;
                    case 'heat_engine':
                        newEffect = this.createEffect('heat_engine', {
                            x: effect.x, y: (effect.y || 0) + 35, z: effect.z, life: effect.life || 500
                        });
                        break;
                    case 'heat_engine_blast':
                        newEffect = this.createEffect('fire_blast', {
                            x: effect.x, y: (effect.y || 0) + 35, z: effect.z, life: effect.life || 1500
                        });
                        break;
                }

                if (newEffect) {
                    newEffect.userData._sourceId = effect._id || Math.random();
                    newEffect.createdAt = this.animationTime;
                    this.scene.add(newEffect);
                    this.effectMeshes.push(newEffect);
                }
            });
        }
    }

    ensureStateIndicators(playerId) {
        if (this.stateIndicators.has(playerId)) {
            return this.stateIndicators.get(playerId);
        }

        const indicatorGroup = new THREE.Group();
        indicatorGroup.playerId = playerId;

        const chargeGroup = new THREE.Group();
        chargeGroup.name = 'chargeIndicator';
        chargeGroup.visible = false;
        chargeGroup.userData.particles = [];
        indicatorGroup.add(chargeGroup);

        const heatGroup = new THREE.Group();
        heatGroup.name = 'heatEngineIndicator';
        heatGroup.visible = false;
        heatGroup.position.y = CHARACTER_CONFIG.HEIGHT + 25;

        const engineGeo = new THREE.BoxGeometry(8, 8, 8);
        const engineMat = new THREE.MeshStandardMaterial({ color: 0xFF4500, emissive: 0xFF4500, emissiveIntensity: 0.3 });
        const engineIcon = new THREE.Mesh(engineGeo, engineMat);
        engineIcon.name = 'engineIcon';
        heatGroup.add(engineIcon);

        for (let i = 0; i < 4; i++) {
            const dotGeo = new THREE.SphereGeometry(2, 8, 8);
            const dotMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.x = -9 + i * 6;
            dot.position.y = -10;
            dot.name = `heatDot${i}`;
            heatGroup.add(dot);
        }
        indicatorGroup.add(heatGroup);

        const shieldGeo = new THREE.SphereGeometry(45, 32, 32);
        const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.name = 'shieldIndicator';
        shield.visible = false;
        shield.position.y = CHARACTER_CONFIG.HEIGHT / 2;
        indicatorGroup.add(shield);

        const anchorGeo = new THREE.TorusGeometry(8, 3, 16, 32);
        const anchorMat = new THREE.MeshBasicMaterial({ color: 0x808080 });
        const anchor = new THREE.Mesh(anchorGeo, anchorMat);
        anchor.name = 'anchorIndicator';
        anchor.visible = false;
        anchor.rotation.x = -Math.PI / 2;
        anchor.position.y = -5;
        indicatorGroup.add(anchor);

        this.stateIndicators.set(playerId, indicatorGroup);
        return indicatorGroup;
    }

    updateStateIndicators(playerData, playerMesh) {
        if (!playerData || !playerMesh) return;

        const indicators = this.ensureStateIndicators(playerData.id);
        indicators.position.copy(playerMesh.position);

        const chargeIndicator = indicators.getObjectByName('chargeIndicator');
        if (playerData.charge && playerData.charge !== 0) {
            chargeIndicator.visible = true;
            const isPositive = playerData.charge > 0;
            const chargeMagnitude = Math.abs(playerData.charge);

            while (chargeIndicator.userData.particles.length < chargeMagnitude * 3) {
                const particleGeo = new THREE.SphereGeometry(2, 8, 8);
                const particleMat = new THREE.MeshBasicMaterial({
                    color: isPositive ? 0x00FF00 : 0xFF0000,
                    emissive: isPositive ? 0x00FF00 : 0xFF0000,
                    emissiveIntensity: 0.5
                });
                const particle = new THREE.Mesh(particleGeo, particleMat);
                particle.userData.orbitAngle = Math.random() * Math.PI * 2;
                particle.userData.orbitRadius = 25 + Math.random() * 10;
                particle.userData.orbitSpeed = 1.5 + Math.random();
                particle.userData.orbitY = (Math.random() - 0.5) * 40;
                chargeIndicator.add(particle);
                chargeIndicator.userData.particles.push(particle);
            }

            chargeIndicator.userData.particles.forEach((p, i) => {
                p.visible = i < chargeMagnitude * 3;
                p.material.color.setHex(isPositive ? 0x00FF00 : 0xFF0000);
            });

            const t = this.animationTime;
            chargeIndicator.userData.particles.forEach((p, i) => {
                if (!p.visible) return;
                p.userData.orbitAngle += p.userData.orbitSpeed * 0.02;
                p.position.set(
                    Math.cos(p.userData.orbitAngle) * p.userData.orbitRadius,
                    CHARACTER_CONFIG.HEIGHT / 2 + p.userData.orbitY,
                    Math.sin(p.userData.orbitAngle) * p.userData.orbitRadius
                );
            });
        } else {
            chargeIndicator.visible = false;
        }

        const heatIndicator = indicators.getObjectByName('heatEngineIndicator');
        if (playerData.heatEngine && playerData.heatEngine.active) {
            heatIndicator.visible = true;

            const engineIcon = heatIndicator.getObjectByName('engineIcon');
            if (engineIcon) engineIcon.rotation.y += 0.05;

            const chargeLevel = playerData.heatEngine.charge || 0;
            for (let i = 0; i < 4; i++) {
                const dot = heatIndicator.getObjectByName(`heatDot${i}`);
                if (dot) {
                    dot.material.color.setHex(i < chargeLevel ? 0xFF4500 : 0x333333);
                    if (i < chargeLevel) {
                        dot.material.emissive = dot.material.emissive || new THREE.Color(0);
                        dot.material.emissive.setHex(0xFF4500);
                        dot.material.emissiveIntensity = 0.5;
                    }
                }
            }
        } else {
            heatIndicator.visible = false;
        }

        const shieldIndicator = indicators.getObjectByName('shieldIndicator');
        if (playerData.shieldActive) {
            shieldIndicator.visible = true;
            const pulse = Math.sin(this.animationTime * 0.005) * 0.05 + 0.2;
            shieldIndicator.material.opacity = pulse;
        } else {
            shieldIndicator.visible = false;
        }

        const anchorIndicator = indicators.getObjectByName('anchorIndicator');
        const hasAnchor = playerData.effects && playerData.effects.some(e => e.type === 'anchor');
        anchorIndicator.visible = hasAnchor;

        if (!indicators.parent) {
            this.scene.add(indicators);
        }
    }

    drawEffects(effects, players) {
        this.effectMeshes = this.effectMeshes.filter(m => {
            const isPersistent = ['gravityField', 'repulsionField', 'dampingField', 'frictionZone', 'airFrictionZone', 'rigid_constraint', 'soft_rope'].includes(m.type);
            if (!isPersistent) return true;
            this.scene.remove(m);
            return false;
        });

        effects.forEach(effect => {
            if (effect.type === 'gravityField' || effect.type === 'repulsionField') {
                const color = effect.type === 'gravityField' ? 0x800080 : 0x00ffff;
                const geometry = new THREE.SphereGeometry(effect.radius, 32, 32);
                const material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.15,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.type = effect.type;
                mesh.position.set(effect.x || 0, (effect.y || 0) + 10, effect.z || 0);
                this.scene.add(mesh);
                this.effectMeshes.push(mesh);

                const ringGeometry = new THREE.RingGeometry(effect.radius - 5, effect.radius, 32);
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide
                });
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.type = effect.type;
                ring.position.set(effect.x || 0, (effect.y || 0) + 15, effect.z || 0);
                ring.rotation.x = -Math.PI / 2;
                this.scene.add(ring);
                this.effectMeshes.push(ring);
            } else if (effect.type === 'dampingField') {
                const geometry = new THREE.SphereGeometry(effect.radius, 32, 32);
                const material = new THREE.MeshBasicMaterial({
                    color: 0x00ff00,
                    transparent: true,
                    opacity: 0.15,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.type = effect.type;
                mesh.position.set(effect.x || 0, (effect.y || 0) + 10, effect.z || 0);
                this.scene.add(mesh);
                this.effectMeshes.push(mesh);
            } else if (effect.type === 'frictionZone' || effect.type === 'airFrictionZone') {
                const color = effect.type === 'frictionZone' ? 0xC8E6FF : 0xB4B4C8;
                const geometry = new THREE.CylinderGeometry(effect.radius, effect.radius, 5, 32);
                const material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.3
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.type = effect.type;
                mesh.position.set(effect.x || 0, (effect.y || 0) + 2.5, effect.z || 0);
                this.scene.add(mesh);
                this.effectMeshes.push(mesh);
            } else if ((effect.type === 'rigid_constraint' || effect.type === 'soft_rope') && players && players.length >= 2) {
                const p1 = players[0];
                const p2 = players[1];
                const points = [
                    new THREE.Vector3(p1.position.x, p1.position.y + 35, p1.position.z),
                    new THREE.Vector3(p2.position.x, p2.position.y + 35, p2.position.z)
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const color = effect.type === 'rigid_constraint' ? 0xFFD700 : 0x87CEEB;
                const material = new THREE.LineBasicMaterial({ color: color, linewidth: 4 });
                const line = new THREE.Line(geometry, material);
                line.type = effect.type;
                this.scene.add(line);
                this.effectMeshes.push(line);
            }
        });
    }

    drawAimingLine(player, target, gameState = null) {
        if (this.aimingLine) {
            this.scene.remove(this.aimingLine);
            this.aimingLine = null;
        }

        if (!player || !target) {
            return;
        }

        const points = [
            new THREE.Vector3(player.position.x, player.position.y + 40, player.position.z),
            new THREE.Vector3(target.x, (target.y || 0) + 40, target.z || 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0xFFD700,
            dashSize: 10,
            gapSize: 5,
            linewidth: 3
        });
        this.aimingLine = new THREE.Line(geometry, material);
        this.aimingLine.computeLineDistances();
        this.scene.add(this.aimingLine);

        const markerGeometry = new THREE.SphereGeometry(15, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFD700,
            transparent: true,
            opacity: 0.3
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(target.x, (target.y || 0) + 40, target.z || 0);
        this.scene.add(marker);
        this.effectMeshes.push(marker);
    }

    render(gameState, aimingTarget = null, currentPlayerPhysics = null, deltaTime = 16) {
        this.updateAnimations(deltaTime, gameState);
        this.updateActiveEffects(deltaTime);

        let playersToDraw = gameState.players;
        if (!playersToDraw || playersToDraw.length === 0) {
            playersToDraw = gameState.physicsPlayers;
        }

        if (playersToDraw && playersToDraw.length > 0) {
            playersToDraw.forEach(p => {
                let playerData = null;
                if (gameState.playersData) {
                    playerData = gameState.playersData.find(gp => gp.id === p.playerId);
                } else if (gameState.players) {
                    playerData = gameState.players.find(gp => gp.id === p.playerId);
                }
                const isInvisible = gameState.quantumInvisible && gameState.quantumInvisible[p.playerId];
                this.drawPlayer(p, gameState.shields && gameState.shields[p.playerId], playerData, isInvisible);
            });
        }

        if (gameState.effects) {
            this.drawEffects(gameState.effects, gameState.physicsPlayers);
        }

        if (gameState.tempEffects) {
            this.drawTempEffects(gameState.tempEffects, gameState.players);
        }

        if (aimingTarget && currentPlayerPhysics) {
            this.drawAimingLine(currentPlayerPhysics, aimingTarget, gameState);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
