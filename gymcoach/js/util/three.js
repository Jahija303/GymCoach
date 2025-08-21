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

    // Draw the 3D stickman representation
    drawStickman3D(results, color, cameraId) {
        this.clearPoseLines(cameraId);
        if (results.landmarks && results.landmarks.length > 0) {
            for (const landmarks of results.landmarks) {
                POSE_CONNECTIONS.forEach(([i, j]) => {
                    const landmark1 = landmarks[i];
                    const landmark2 = landmarks[j];
                    
                    if (landmark1 && landmark2 && landmark1.visibility > 0.5 && landmark2.visibility > 0.5) {
                        // Fix horizontal flipping by inverting X coordinate and adjusting Y
                        const pos1 = [
                            1 - landmark1.x,  // Flip X to fix horizontal mirroring
                            (1 - landmark1.y) + 1,  // Flip Y to match screen coordinates
                            -landmark1.z      // Negate Z for better depth perception
                        ];
                        const pos2 = [
                            1 - landmark2.x,
                            (1 - landmark2.y) + 1,
                            -landmark2.z
                        ];
                        this.addLine(pos1, pos2, color, cameraId);
                    }
                });
            }
        }
    }
}