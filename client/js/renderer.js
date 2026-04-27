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

        // 拳皇风格配色
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFDBAC, metalness: 0.1, roughness: 0.9
        });
        const mainMaterial = new THREE.MeshStandardMaterial({
            color: colors.main, metalness: 0.4, roughness: 0.6
        });
        const secondaryMaterial = new THREE.MeshStandardMaterial({
            color: colors.secondary, metalness: 0.3, roughness: 0.7
        });
        const accentMaterial = new THREE.MeshStandardMaterial({
            color: colors.emissive, emissive: colors.emissive, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.5
        });
        const hairMaterial = new THREE.MeshStandardMaterial({
            color: playerId === 1 ? 0x2D1810 : 0x101020, metalness: 0.2, roughness: 0.8
        });
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF, emissive: 0x444444, emissiveIntensity: 0.2
        });

        // ===== 头部 =====
        const headGroup = new THREE.Group();
        headGroup.position.y = CHARACTER_CONFIG.HEIGHT - 8;

        // 头 - 稍微椭圆一点更像人
        const headGeo = new THREE.SphereGeometry(10, 24, 24);
        headGeo.scale(1, 1.1, 0.9);
        const head = new THREE.Mesh(headGeo, skinMaterial);
        head.name = 'head';
        headGroup.add(head);

        // 头发 - 拳皇风格的刺头
        if (playerId === 1) {
            // 玩家1 - 火焰风格头发
            for (let i = 0; i < 7; i++) {
                const spikeGeo = new THREE.ConeGeometry(3 + Math.random() * 2, 8 + Math.random() * 6, 8);
                const spike = new THREE.Mesh(spikeGeo, hairMaterial);
                const angle = (i / 7) * Math.PI - Math.PI / 2;
                spike.position.set(Math.sin(angle) * 5, 8 + Math.random() * 2, Math.cos(angle) * 3);
                spike.rotation.x = Math.sin(angle) * 0.3;
                spike.rotation.z = -Math.cos(angle) * 0.3;
                headGroup.add(spike);
            }
            // 头顶主发
            const topHairGeo = new THREE.ConeGeometry(6, 12, 8);
            const topHair = new THREE.Mesh(topHairGeo, hairMaterial);
            topHair.position.y = 12;
            topHair.rotation.x = 0.2;
            headGroup.add(topHair);
        } else {
            // 玩家2 - 酷炫背头
            const hairGeo = new THREE.SphereGeometry(11, 24, 24);
            hairGeo.scale(1, 0.8, 1.2);
            const hair = new THREE.Mesh(hairGeo, hairMaterial);
            hair.position.y = 3;
            hair.position.z = -2;
            headGroup.add(hair);

            // 留海
            for (let i = 0; i < 5; i++) {
                const fringeGeo = new THREE.BoxGeometry(3, 6, 2);
                const fringe = new THREE.Mesh(fringeGeo, hairMaterial);
                fringe.position.set(-4 + i * 2, 5, 8);
                fringe.rotation.x = 0.3;
                headGroup.add(fringe);
            }
        }

        // 眼睛
        const eyeGeo = new THREE.SphereGeometry(2, 12, 12);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
        leftEye.position.set(-4, 1, 8);
        headGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
        rightEye.position.set(4, 1, 8);
        headGroup.add(rightEye);

        // 瞳孔
        const pupilGeo = new THREE.SphereGeometry(1, 8, 8);
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000 });
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-4, 1, 9.5);
        headGroup.add(leftPupil);
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(4, 1, 9.5);
        headGroup.add(rightPupil);

        // 眉毛
        const browGeo = new THREE.BoxGeometry(5, 1.5, 1);
        const leftBrow = new THREE.Mesh(browGeo, hairMaterial);
        leftBrow.position.set(-4, 5, 8.5);
        leftBrow.rotation.z = playerId === 1 ? 0.2 : -0.1;
        headGroup.add(leftBrow);
        const rightBrow = new THREE.Mesh(browGeo, hairMaterial);
        rightBrow.position.set(4, 5, 8.5);
        rightBrow.rotation.z = playerId === 1 ? -0.2 : 0.1;
        headGroup.add(rightBrow);

        // 嘴巴
        const mouthGeo = new THREE.BoxGeometry(4, 1, 0.5);
        const mouthMat = new THREE.MeshStandardMaterial({ color: 0xCC6666 });
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, -4, 9);
        headGroup.add(mouth);

        charGroup.add(headGroup);

        // ===== 身体 =====
        const torsoGroup = new THREE.Group();
        torsoGroup.position.y = CHARACTER_CONFIG.HEIGHT - 35;

        // 躯干 - 肌肉感造型
        const chestGeo = new THREE.BoxGeometry(22, 18, 12);
        const chest = new THREE.Mesh(chestGeo, mainMaterial);
        chest.position.y = 3;
        torsoGroup.add(chest);

        // 腹肌
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 2; col++) {
                const abGeo = new THREE.BoxGeometry(8, 5, 3);
                const ab = new THREE.Mesh(abGeo, secondaryMaterial);
                ab.position.set(-6 + col * 12, -3 - row * 6, 7);
                torsoGroup.add(ab);
            }
        }

        // 肩膀护甲
        const shoulderGeo = new THREE.SphereGeometry(7, 16, 16);
        shoulderGeo.scale(1.2, 0.6, 1);
        const leftShoulder = new THREE.Mesh(shoulderGeo, accentMaterial);
        leftShoulder.position.set(-15, 10, 0);
        torsoGroup.add(leftShoulder);
        const rightShoulder = new THREE.Mesh(shoulderGeo, accentMaterial);
        rightShoulder.position.set(15, 10, 0);
        torsoGroup.add(rightShoulder);

        // 腰带
        const beltGeo = new THREE.BoxGeometry(24, 6, 14);
        const belt = new THREE.Mesh(beltGeo, accentMaterial);
        belt.position.y = -12;
        torsoGroup.add(belt);

        // 带扣
        const buckleGeo = new THREE.BoxGeometry(8, 6, 3);
        const buckle = new THREE.Mesh(buckleGeo, new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 }));
        buckle.position.set(0, -12, 8);
        torsoGroup.add(buckle);

        charGroup.add(torsoGroup);

        // ===== 手臂 =====
        // 左臂
        const leftArmGroup = new THREE.Group();
        leftArmGroup.name = 'leftArm';
        leftArmGroup.position.set(-18, CHARACTER_CONFIG.HEIGHT - 28, 0);

        // 左上臂
        const leftUpperArmGeo = new THREE.CylinderGeometry(5, 6, 16, 16);
        const leftUpperArm = new THREE.Mesh(leftUpperArmGeo, secondaryMaterial);
        leftUpperArm.position.y = -8;
        leftUpperArm.name = 'leftUpperArm';
        leftArmGroup.add(leftUpperArm);

        // 左前臂
        const leftLowerArmGroup = new THREE.Group();
        leftLowerArmGroup.name = 'leftLowerArm';
        leftLowerArmGroup.position.y = -16;
        const leftLowerArmGeo = new THREE.CylinderGeometry(4, 5, 14, 16);
        const leftLowerArm = new THREE.Mesh(leftLowerArmGeo, secondaryMaterial);
        leftLowerArm.position.y = -7;
        leftLowerArm.name = 'leftLowerArmMesh';
        leftLowerArmGroup.add(leftLowerArm);

        // 左手
        const leftHandGeo = new THREE.SphereGeometry(5, 16, 16);
        const leftHand = new THREE.Mesh(leftHandGeo, skinMaterial);
        leftHand.position.y = -15;
        leftLowerArmGroup.add(leftHand);

        leftArmGroup.add(leftLowerArmGroup);
        charGroup.add(leftArmGroup);

        // 右臂
        const rightArmGroup = new THREE.Group();
        rightArmGroup.name = 'rightArm';
        rightArmGroup.position.set(18, CHARACTER_CONFIG.HEIGHT - 28, 0);

        // 右上臂
        const rightUpperArmGeo = new THREE.CylinderGeometry(5, 6, 16, 16);
        const rightUpperArm = new THREE.Mesh(rightUpperArmGeo, secondaryMaterial);
        rightUpperArm.position.y = -8;
        rightUpperArm.name = 'rightUpperArm';
        rightArmGroup.add(rightUpperArm);

        // 右前臂
        const rightLowerArmGroup = new THREE.Group();
        rightLowerArmGroup.name = 'rightLowerArm';
        rightLowerArmGroup.position.y = -16;
        const rightLowerArmGeo = new THREE.CylinderGeometry(4, 5, 14, 16);
        const rightLowerArm = new THREE.Mesh(rightLowerArmGeo, secondaryMaterial);
        rightLowerArm.position.y = -7;
        rightLowerArm.name = 'rightLowerArmMesh';
        rightLowerArmGroup.add(rightLowerArm);

        // 右手
        const rightHandGeo = new THREE.SphereGeometry(5, 16, 16);
        const rightHand = new THREE.Mesh(rightHandGeo, skinMaterial);
        rightHand.position.y = -15;
        rightLowerArmGroup.add(rightHand);

        rightArmGroup.add(rightLowerArmGroup);
        charGroup.add(rightArmGroup);

        // ===== 腿部 =====
        const hipY = CHARACTER_CONFIG.HEIGHT - 50;

        // 左腿
        const leftLegGroup = new THREE.Group();
        leftLegGroup.name = 'leftLeg';
        leftLegGroup.position.set(-7, hipY, 0);

        // 左大腿
        const leftUpperLegGeo = new THREE.CylinderGeometry(7, 6, 20, 16);
        const leftUpperLeg = new THREE.Mesh(leftUpperLegGeo, mainMaterial);
        leftUpperLeg.position.y = -10;
        leftUpperLeg.name = 'leftUpperLeg';
        leftLegGroup.add(leftUpperLeg);

        // 左小腿
        const leftLowerLegGroup = new THREE.Group();
        leftLowerLegGroup.name = 'leftLowerLeg';
        leftLowerLegGroup.position.y = -20;
        const leftLowerLegGeo = new THREE.CylinderGeometry(5, 6, 18, 16);
        const leftLowerLeg = new THREE.Mesh(leftLowerLegGeo, mainMaterial);
        leftLowerLeg.position.y = -9;
        leftLowerLeg.name = 'leftLowerLegMesh';
        leftLowerLegGroup.add(leftLowerLeg);

        // 左脚
        const leftFootGeo = new THREE.BoxGeometry(8, 4, 14);
        const leftFoot = new THREE.Mesh(leftFootGeo, accentMaterial);
        leftFoot.position.set(0, -20, 2);
        leftLowerLegGroup.add(leftFoot);

        leftLegGroup.add(leftLowerLegGroup);
        charGroup.add(leftLegGroup);

        // 右腿
        const rightLegGroup = new THREE.Group();
        rightLegGroup.name = 'rightLeg';
        rightLegGroup.position.set(7, hipY, 0);

        // 右大腿
        const rightUpperLegGeo = new THREE.CylinderGeometry(7, 6, 20, 16);
        const rightUpperLeg = new THREE.Mesh(rightUpperLegGeo, mainMaterial);
        rightUpperLeg.position.y = -10;
        rightUpperLeg.name = 'rightUpperLeg';
        rightLegGroup.add(rightUpperLeg);

        // 右小腿
        const rightLowerLegGroup = new THREE.Group();
        rightLowerLegGroup.name = 'rightLowerLeg';
        rightLowerLegGroup.position.y = -20;
        const rightLowerLegGeo = new THREE.CylinderGeometry(5, 6, 18, 16);
        const rightLowerLeg = new THREE.Mesh(rightLowerLegGeo, mainMaterial);
        rightLowerLeg.position.y = -9;
        rightLowerLeg.name = 'rightLowerLegMesh';
        rightLowerLegGroup.add(rightLowerLeg);

        // 右脚
        const rightFootGeo = new THREE.BoxGeometry(8, 4, 14);
        const rightFoot = new THREE.Mesh(rightFootGeo, accentMaterial);
        rightFoot.position.set(0, -20, 2);
        rightLowerLegGroup.add(rightFoot);

        rightLegGroup.add(rightLowerLegGroup);
        charGroup.add(rightLegGroup);

        // 玩家标识（悬浮）
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`P${playerId}`, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(25, 25, 1);
        sprite.position.y = CHARACTER_CONFIG.HEIGHT + 20;
        charGroup.add(sprite);

        // 旋转角色使其面对面
        // 玩家1在左边(-160)，朝右看玩家2
        // 玩家2在右边(160)，朝左看玩家1
        if (playerId === 1) {
            charGroup.rotation.y = Math.PI / 2;
        } else {
            charGroup.rotation.y = Math.PI / 2;
            charGroup.rotation.y += Math.PI;
        }

        charGroup.bodyParts = {
            head: headGroup, torso: torsoGroup,
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
        const walkCycle = t * 0.015 * (animState.params.walkSpeed || 1.0);
        const legSwing = Math.sin(walkCycle) * 0.5;
        const armSwing = Math.sin(walkCycle + Math.PI) * 0.4;
        const attackProgress = animState.current === 'attack' ? Math.min(animState.timers.attack / 400, 1.0) : 0;
        const hitProgress = animState.current === 'hit' ? Math.min(animState.timers.hit / 300, 1.0) : 0;

        // ===== 呼吸和头部动画 =====
        parts.head.rotation.x = idleHeadTilt;
        parts.head.rotation.y = Math.sin(t * 0.001) * 0.02;
        // 呼吸时身体轻微起伏
        parts.torso.position.y = idleBreath * 3;

        if (animState.current === 'attack') {
            // ===== 拳皇风格攻击动画 =====
            // 攻击分为：蓄力 -> 出拳 -> 收回
            if (attackProgress < 0.2) {
                // 蓄力阶段 - 身体扭转，手臂回收
                const charge = attackProgress / 0.2;
                parts.torso.rotation.y = -Math.sin(charge * Math.PI / 2) * 0.4;
                parts.rightArm.rotation.z = Math.sin(charge * Math.PI / 2) * 0.5;
                parts.rightArm.rotation.x = Math.sin(charge * Math.PI / 2) * 0.3;
                parts.leftArm.rotation.x = -0.2;
            } else if (attackProgress < 0.5) {
                // 出拳阶段 - 快速出击！
                const swing = (attackProgress - 0.2) / 0.3;
                const swingEase = swing < 0.5 ? 2 * swing * swing : 1 - Math.pow(-2 * swing + 2, 2) / 2;

                parts.torso.rotation.y = Math.sin(swingEase * Math.PI) * 0.3;
                parts.rightArm.rotation.z = -swingEase * 0.8;
                parts.rightArm.rotation.x = -swingEase * 1.2;
                parts.rightLowerArm.rotation.x = -swingEase * 0.5;
                parts.leftArm.rotation.x = 0.3 + swingEase * 0.3;
                parts.rightLeg.rotation.z = -swingEase * 0.2;
            } else {
                // 收回阶段
                const recover = (attackProgress - 0.5) / 0.5;
                parts.torso.rotation.y = (1 - recover) * 0.3;
                parts.rightArm.rotation.z = -(1 - recover) * 0.8;
                parts.rightArm.rotation.x = -(1 - recover) * 1.2;
                parts.rightLowerArm.rotation.x = -(1 - recover) * 0.5;
            }
        } else if (animState.current === 'walk') {
            // ===== 走路动画 =====
            parts.torso.rotation.y = Math.sin(walkCycle) * 0.05;
            parts.rightArm.rotation.x = armSwing;
            parts.leftArm.rotation.x = -armSwing;
            parts.rightArm.rotation.z = Math.abs(armSwing) * 0.1;
            parts.leftArm.rotation.z = -Math.abs(armSwing) * 0.1;
            parts.rightLeg.rotation.x = legSwing;
            parts.leftLeg.rotation.x = -legSwing;
            parts.rightLowerLeg.rotation.x = Math.max(0, -legSwing) * 0.4;
            parts.leftLowerLeg.rotation.x = Math.max(0, legSwing) * 0.4;
            // 走路时身体重心起伏
            parts.torso.position.y = idleBreath * 3 + Math.abs(Math.sin(walkCycle)) * 3;
        } else if (animState.current === 'hit') {
            // ===== 受击动画 =====
            const hitEase = hitProgress < 0.3 ? hitProgress / 0.3 : 1 - (hitProgress - 0.3) / 0.7;
            const hitAmount = hitEase;

            // 整个角色向后仰
            charGroup.rotation.x = hitAmount * 0.5;
            charGroup.position.y = Math.sin(hitProgress * Math.PI) * 10;

            // 手臂张开
            parts.leftArm.rotation.x = -hitAmount * 0.8;
            parts.rightArm.rotation.x = -hitAmount * 0.8;
            parts.leftArm.rotation.z = hitAmount * 0.5;
            parts.rightArm.rotation.z = -hitAmount * 0.5;

            // 头部向后
            parts.head.rotation.x = -hitAmount * 0.3;
        } else {
            // ===== 待机动画 =====
            // 手臂自然摆动
            parts.rightArm.rotation.x = Math.sin(t * 0.0015) * 0.08;
            parts.leftArm.rotation.x = -Math.sin(t * 0.0015 + 0.5) * 0.08;
            parts.rightArm.rotation.z = Math.sin(t * 0.002) * 0.03;
            parts.leftArm.rotation.z = -Math.sin(t * 0.002 + 0.3) * 0.03;

            // 腿部轻微调整
            parts.rightLeg.rotation.x = Math.sin(t * 0.001) * 0.02;
            parts.leftLeg.rotation.x = -Math.sin(t * 0.001 + 1) * 0.02;

            // 重置其他旋转
            parts.torso.rotation.y = 0;
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
