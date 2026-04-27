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

    createPlayerMesh(playerId) {
        const geometry = new THREE.BoxGeometry(
            PLAYER_CONFIG.WIDTH,
            PLAYER_CONFIG.HEIGHT,
            PLAYER_CONFIG.DEPTH
        );
        const color = playerId === 1 ? 0xFF6B35 : 0x1E90FF;
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.4,
            roughness: 0.3
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        const edgeGeometry = new THREE.EdgesGeometry(geometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        mesh.add(edges);
        
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${playerId}`, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(40, 40, 1);
        sprite.position.z = PLAYER_CONFIG.DEPTH / 2 + 1;
        mesh.add(sprite);
        
        mesh.playerId = playerId;
        return mesh;
    }

    clear() {
    }

    drawArena(radius) {
    }

    drawGrid(radius) {
    }

    drawPlayer(player, hasShield, playerData = null, isInvisible = false) {
        let mesh = this.playerMeshes.find(m => m.playerId === player.playerId);
        
        if (!mesh) {
            mesh = this.createPlayerMesh(player.playerId);
            this.scene.add(mesh);
            this.playerMeshes.push(mesh);
        }
        
        // 直接使用 3D 物理坐标
        mesh.position.set(player.position.x, player.position.y + 20, player.position.z);
        
        if (isInvisible) {
            mesh.material.opacity = 0.2;
            mesh.material.transparent = true;
        } else {
            mesh.material.opacity = 1;
            mesh.material.transparent = false;
        }
    }

    drawEffects(effects, players) {
        this.effectMeshes.forEach(mesh => this.scene.remove(mesh));
        this.effectMeshes = [];
        
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
                // 直接使用 3D 坐标
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
                mesh.position.set(effect.x || 0, (effect.y || 0) + 2.5, effect.z || 0);
                this.scene.add(mesh);
                this.effectMeshes.push(mesh);
            } else if ((effect.type === 'rigid_constraint' || effect.type === 'soft_rope') && players && players.length >= 2) {
                const p1 = players[0];
                const p2 = players[1];
                const points = [
                    new THREE.Vector3(p1.position.x, p1.position.y + 20, p1.position.z),
                    new THREE.Vector3(p2.position.x, p2.position.y + 20, p2.position.z)
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const color = effect.type === 'rigid_constraint' ? 0xFFD700 : 0x87CEEB;
                const material = new THREE.LineBasicMaterial({ color: color, linewidth: 4 });
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
                this.effectMeshes.push(line);
            }
        });
    }

    drawTempEffects(tempEffects) {
    }

    drawAimingLine(player, target, gameState = null) {
        if (this.aimingLine) {
            this.scene.remove(this.aimingLine);
        }
        
        if (!player || !target) {
            this.aimingLine = null;
            return;
        }
        
        const points = [
            new THREE.Vector3(player.position.x, player.position.y + 30, player.position.z),
            new THREE.Vector3(target.x, (target.y || 0) + 30, target.z || 0)
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
        marker.position.set(target.x, (target.y || 0) + 30, target.z || 0);
        this.scene.add(marker);
        this.effectMeshes.push(marker);
    }

    drawFallWarning(player, arenaRadius) {
    }

    render(gameState, aimingTarget = null, currentPlayerPhysics = null) {
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
            this.drawEffects(gameState.effects, gameState.players || gameState.physicsPlayers);
        }
        
        if (aimingTarget && currentPlayerPhysics) {
            this.drawAimingLine(currentPlayerPhysics, aimingTarget, gameState);
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}
