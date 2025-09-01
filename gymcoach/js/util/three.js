import * as THREE from 'three';
import { CANVAS_HEIGHT, CANVAS_WIDTH, POSE_CONNECTIONS } from './pose.js';
import { OrbitControls } from '../../node_modules/three/examples/jsm/controls/OrbitControls.js';

// This class handles all 3D rendering using Three.js
export class Three {
    // Create a scene and camera and set the correct camera position, add rotation feature
    constructor() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f5f5);

        const camera = new THREE.PerspectiveCamera(45, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 100);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        document.getElementById('three').appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        
        const gridHelper = new THREE.GridHelper(2, 20, 0x888888, 0xcccccc);
        gridHelper.position.y = 0.8; // Position at typical foot level
        scene.add(gridHelper);
        
        // Better camera positioning for human pose
        camera.position.set(1, 1, 2); // Slightly elevated and angled view
        controls.target.set(0, 1, 0); // Look at center of normalized pose space
        
        console.log('Three.js initialized');

        window.threeJSContext = { scene, camera, renderer, controls };
        
        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
    }

    // Draw a line from point a to point b with a certain color
    // add an optional cameraId parameter to each line so we know which to delete/update
    addLine(startCoords, endCoords, color = 0xff0000, cameraId = null) {
        if (!window.threeJSContext) {
            console.error('Three.js not initialized');
            return;
        }
    
        const { scene } = window.threeJSContext;
    
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(startCoords[0], startCoords[1], startCoords[2]),
            new THREE.Vector3(endCoords[0], endCoords[1], endCoords[2])
        ]);
    
        const material = new THREE.LineBasicMaterial({ color: color });
        const line = new THREE.Line(geometry, material);
    
        line.userData.isPoseLine = true;
        line.userData.cameraId = cameraId;
        
        scene.add(line);
    
        return line;
    }
    
    // Delete 3D Lines for a specific camera
    clearPoseLines(cameraId = null) {
        if (!window.threeJSContext) {
            console.error('Three.js not initialized');
            return;
        }
    
        const { scene } = window.threeJSContext;
    
        const linesToRemove = [];
        scene.traverse((child) => {
            if (child instanceof THREE.Line && child.userData.isPoseLine === true) {
                if (cameraId === null || child.userData.cameraId === cameraId) {
                    linesToRemove.push(child);
                }
            }
        });
        
        linesToRemove.forEach(line => {
            scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        });
    }

    addSphere(coords, color = 0xff0000, radius = 0.01, cameraId = null) {
        const { scene } = window.threeJSContext;
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: color });
        const sphere = new THREE.Mesh(geometry, material);

        sphere.position.set(coords[0], coords[1], coords[2]);
        sphere.userData.isPoseSphere = true;
        sphere.userData.cameraId = cameraId;

        scene.add(sphere);
        return sphere;
    }

    clearPoseSpheres(cameraId = null) {
        const { scene } = window.threeJSContext;
        const spheresToRemove = [];
        scene.traverse((child) => {
            if (child.userData.isPoseSphere === true) {
                if (cameraId === null || child.userData.cameraId === cameraId) {
                    spheresToRemove.push(child);
                }
            }
        });

        spheresToRemove.forEach(sphere => {
            scene.remove(sphere);
            sphere.geometry.dispose();
            sphere.material.dispose();
        });
    }

    drawStickman3D(landmarks, color, cameraId) {
        this.clearPoseLines(cameraId);
        this.clearPoseSpheres(cameraId);
        
        // Draw pose connections
        POSE_CONNECTIONS.forEach(([i, j]) => {
            const landmark1 = landmarks[i];
            const landmark2 = landmarks[j];

            if (landmark1 && landmark2 && landmark1.visibility > 0.5 && landmark2.visibility > 0.5) {
                const pos1 = this.formattedLandmarkCoords(landmark1);
                const pos2 = this.formattedLandmarkCoords(landmark2);
                this.addLine(pos1, pos2, color, cameraId);
            }
        });

        // left_hip, right_hip
        [23, 24].forEach(index => {
            const landmark = landmarks[index];
            if (landmark && landmark.visibility > 0.5) {
                const pos = this.formattedLandmarkCoords(landmark);
                this.addSphere(pos, 0x4ECDC4, 0.025, cameraId); // Turquoise color
            }
        });

        // left_knee, right_knee
        [25, 26].forEach(index => {
            const landmark = landmarks[index];
            if (landmark && landmark.visibility > 0.5) {
                const pos = this.formattedLandmarkCoords(landmark);
                this.addSphere(pos, 0xFF6B6B, 0.025, cameraId); // Orange-red color
            }
        });
    }

    formattedLandmarkCoords(landmark) {
        return [
            landmark.x,
            (1 - landmark.y) + 1,
            -landmark.z
        ];
    }
}