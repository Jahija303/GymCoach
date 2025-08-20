import { initializePoseDetection, drawPoseLandmarks, CANVAS_HEIGHT, CANVAS_WIDTH, LANDMARK_NAMES, POSE_CONNECTIONS } from './pose.js';
import * as THREE from 'three';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';

let stream = null;
let intervalIDs = {};
const FPS = 30;
let poseLandmarkerFront = null;
let poseLandmarkerSide = null;
let devices;
var camSelect1 = document.getElementById("cameraSelect1");
var camSelect2 = document.getElementById("cameraSelect2");
const localVideoFront = document.getElementById('localVideoFront');
const localVideoSide = document.getElementById('localVideoSide');

// Store latest results for alignment
let latestFrontResults = null;
let latestSideResults = null;

// ===== POSE ALIGNMENT CODE =====
// BlazePose landmark indices for key body parts
const REFERENCE_LANDMARKS = {
    NOSE: 0,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_HIP: 23,
    RIGHT_HIP: 24
};

function extractReferencePoints(landmarks) {
    const referencePoints = [];
    
    for (const [name, index] of Object.entries(REFERENCE_LANDMARKS)) {
        const landmark = landmarks[index];
        if (landmark && landmark.visibility > 0.5) {
            referencePoints.push({
                index: index,
                name: name,
                x: landmark.x,
                y: landmark.y,
                z: landmark.z
            });
        }
    }
    
    return referencePoints;
}

function calculateCentroid(points) {
    if (points.length === 0) return { x: 0, y: 0, z: 0 };
    
    const sum = points.reduce((acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y,
        z: acc.z + point.z
    }), { x: 0, y: 0, z: 0 });
    
    return {
        x: sum.x / points.length,
        y: sum.y / points.length,
        z: sum.z / points.length
    };
}

function calculateAverageDistance(points, centroid) {
    if (points.length === 0) return 1;
    
    const totalDistance = points.reduce((sum, point) => {
        const dx = point.x - centroid.x;
        const dy = point.y - centroid.y;
        const dz = point.z - centroid.z;
        return sum + Math.sqrt(dx * dx + dy * dy + dz * dz);
    }, 0);
    
    return totalDistance / points.length;
}

function transformPoint(point, transform) {
    const translated = {
        x: point.x - transform.sourceCenter.x,
        y: point.y - transform.sourceCenter.y,
        z: point.z - transform.sourceCenter.z
    };
    
    const scaled = {
        x: translated.x * transform.scale,
        y: translated.y * transform.scale,
        z: translated.z * transform.scale
    };
    
    return {
        x: scaled.x + transform.targetCenter.x,
        y: scaled.y + transform.targetCenter.y,
        z: scaled.z + transform.targetCenter.z
    };
}

function calculateAlignment(sourceLandmarks, targetLandmarks) {
    const sourceRefPoints = extractReferencePoints(sourceLandmarks);
    const targetRefPoints = extractReferencePoints(targetLandmarks);
    
    if (sourceRefPoints.length < 2 || targetRefPoints.length < 2) {
        return null;
    }
    
    const matchingPairs = [];
    sourceRefPoints.forEach(sourcePoint => {
        const targetPoint = targetRefPoints.find(tp => tp.index === sourcePoint.index);
        if (targetPoint) {
            matchingPairs.push({ source: sourcePoint, target: targetPoint });
        }
    });
    
    if (matchingPairs.length < 2) {
        return null;
    }
    
    const sourceCentroid = calculateCentroid(matchingPairs.map(pair => pair.source));
    const targetCentroid = calculateCentroid(matchingPairs.map(pair => pair.target));
    
    const sourceAvgDist = calculateAverageDistance(matchingPairs.map(pair => pair.source), sourceCentroid);
    const targetAvgDist = calculateAverageDistance(matchingPairs.map(pair => pair.target), targetCentroid);
    
    const scale = sourceAvgDist > 0 ? targetAvgDist / sourceAvgDist : 1;
    
    return {
        sourceCenter: sourceCentroid,
        targetCenter: targetCentroid,
        scale: scale,
        matchingPoints: matchingPairs.length
    };
}

function alignPoseLandmarks(sourceLandmarks, targetLandmarks) {
    const transform = calculateAlignment(sourceLandmarks, targetLandmarks);
    
    if (!transform) {
        return sourceLandmarks;
    }
    
    const transformedLandmarks = sourceLandmarks.map(landmark => {
        if (!landmark || typeof landmark.x !== 'number') {
            return landmark;
        }
        
        const transformed = transformPoint(landmark, transform);
        
        return {
            ...landmark,
            x: transformed.x,
            y: transformed.y,
            z: transformed.z
        };
    });
    
    return transformedLandmarks;
}

function alignSideToFrontFor3D(frontResults, sideResults) {
    if (!frontResults.landmarks || !sideResults.landmarks ||
        frontResults.landmarks.length === 0 || sideResults.landmarks.length === 0) {
        return sideResults;
    }
    
    const alignedSideLandmarks = alignPoseLandmarks(
        sideResults.landmarks[0],
        frontResults.landmarks[0]
    );
    
    return {
        ...sideResults,
        landmarks: [alignedSideLandmarks, ...sideResults.landmarks.slice(1)]
    };
}

function createCombinedPose(frontResults, alignedSideResults) {
    if (!frontResults.landmarks || !alignedSideResults.landmarks ||
        frontResults.landmarks.length === 0 || alignedSideResults.landmarks.length === 0) {
        return frontResults;
    }
    
    const frontLandmarks = frontResults.landmarks[0];
    const sideLandmarks = alignedSideResults.landmarks[0];
    
    // Create combined landmarks using X,Y from front and Z from aligned side
    const combinedLandmarks = frontLandmarks.map((frontLandmark, index) => {
        const sideLandmark = sideLandmarks[index];
        
        if (!frontLandmark || !sideLandmark) {
            return frontLandmark;
        }
        
        // Use front camera for X,Y positioning and side camera for Z depth
        // Only use side Z if both landmarks are visible
        const useAccurateZ = frontLandmark.visibility > 0.5 && sideLandmark.visibility > 0.5;
        
        return {
            ...frontLandmark,
            x: frontLandmark.x,  // Keep front X
            y: frontLandmark.y,  // Keep front Y
            z: useAccurateZ ? sideLandmark.z : frontLandmark.z,  // Use side Z when both are visible
            visibility: Math.min(frontLandmark.visibility, sideLandmark.visibility) // Use minimum visibility
        };
    });
    
    return {
        ...frontResults,
        landmarks: [combinedLandmarks, ...frontResults.landmarks.slice(1)]
    };
}
// ===== END POSE ALIGNMENT CODE =====

async function askForPermissions() {
    try {
        var constraints = {video: true, audio: false};
        stream = await navigator.mediaDevices.getUserMedia(constraints);  
    } catch (error) {
        console.log(error);
    }

    if (stream){
        stream.getTracks().forEach(track => track.stop());
    }
}

async function getCameraDevices() {
  await askForPermissions();
  var allDevices = await navigator.mediaDevices.enumerateDevices();
  var cameraDevices = [];
  for (var i = 0; i < allDevices.length; i++) {
    var device = allDevices[i];
    if (device.kind == 'videoinput') {
      cameraDevices.push(device);
    }
  }
  return cameraDevices;
}

async function listDevices(){
  devices = await getCameraDevices();

  for (let index = 0; index < devices.length; index++) {
    const device = devices[index];
    camSelect1.appendChild(new Option(device.label ?? "Camera "+index, device.deviceId));
    camSelect2.appendChild(new Option(device.label ?? "Camera "+index, device.deviceId));
  }
  
  camSelect1.selectedIndex = 0;
  camSelect2.selectedIndex = 0;
}

function captureCamera(video, selectedCamera) {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  const videoId = video.id;
  for (let key in intervalIDs) {
    if (intervalIDs[key] && intervalIDs[key].videoId === videoId) {
      clearInterval(intervalIDs[key].intervalId);
      delete intervalIDs[key];
    }
  }

  if (!selectedCamera) {
    return;
  }
  
  var constraints = {
    audio: false,
    video: {
      deviceId: { exact: selectedCamera },
      width: { min: 640, ideal: 1280, max: 1920 }, 
      height: { min: 480, ideal: 720, max: 1080 }, 
      frameRate: { ideal: FPS }
    }
  };

  navigator.mediaDevices.getUserMedia(constraints).then(function(camera) {
    video.srcObject = camera;
    const intervalId = startPoseCapture(video);
    intervalIDs[selectedCamera] = {
      intervalId: intervalId,
      videoId: videoId
    };
  }).catch(function(error) {
    alert('Unable to capture your camera. Please check console logs.');
    console.error(error);
  });
}

function initializeTables() {
  const frontTableBody = document.getElementById('frontTableBody');
  const sideTableBody = document.getElementById('sideTableBody');
  
  frontTableBody.innerHTML = '';
  sideTableBody.innerHTML = '';
  
  for (let i = 0; i < 33; i++) {
    // Front table row
    const frontRow = frontTableBody.insertRow();
    frontRow.insertCell(0).textContent = LANDMARK_NAMES[i];
    frontRow.insertCell(1).textContent = '-';
    frontRow.insertCell(2).textContent = '-';
    frontRow.insertCell(3).textContent = '-';
    frontRow.insertCell(4).textContent = '-';
    
    // Side table row
    const sideRow = sideTableBody.insertRow();
    sideRow.insertCell(0).textContent = LANDMARK_NAMES[i];
    sideRow.insertCell(1).textContent = '-';
    sideRow.insertCell(2).textContent = '-';
    sideRow.insertCell(3).textContent = '-';
    sideRow.insertCell(4).textContent = '-';
  }
}

function updateTableData(tableId, results) {
  const tableBody = document.getElementById(tableId);
  const rows = tableBody.rows;

  if (results && results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];
    for (let i = 0; i < landmarks.length && i < 33; i++) {
      const landmark = landmarks[i];
      if (rows[i]) {
        rows[i].cells[1].textContent = landmark.x.toFixed(2);
        rows[i].cells[2].textContent = landmark.y.toFixed(2);
        rows[i].cells[3].textContent = landmark.z.toFixed(2);
        rows[i].cells[4].textContent = landmark.visibility ? landmark.visibility.toFixed(2) : '-';

        // Highlight row in red if visibility is less than 0.5
        if (landmark.visibility && landmark.visibility < 0.5) {
          rows[i].classList.add('low-visibility');
        } else {
          rows[i].classList.remove('low-visibility');
        }
      }
    }
  } else {
    // Clear data if no landmarks detected
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]) {
        rows[i].cells[1].textContent = '-';
        rows[i].cells[2].textContent = '-';
        rows[i].cells[3].textContent = '-';
        rows[i].cells[4].textContent = '-';
        // Remove highlighting when no data
        rows[i].classList.remove('low-visibility');
      }
    }
  }
}

function startPoseCapture(video) {
    console.log(`Starting pose capture for video: ${video.id}`);
    return setInterval(async () => {
        if (video.srcObject && video.videoWidth > 0 && (poseLandmarkerFront || poseLandmarkerSide)) {
            try {
                const startTimeMs = performance.now();
                const frontOrSide = video.id === 'localVideoFront' ? 'front' : 'side';
                let results = null;
                let alignedResults = null;
                let combinedResults = null;
                let color = null;
                
                switch (frontOrSide) {
                    case 'front':
                        color = 0xff0000;
                        results = await poseLandmarkerFront.detectForVideo(video, startTimeMs);
                        latestFrontResults = results; // Store front results
                        
                        // If we have both front and side, create combined pose
                        if (latestSideResults && results) {
                            // First align side to front
                            const alignedSide = alignSideToFrontFor3D(results, latestSideResults);
                            // Then create combined pose
                            combinedResults = createCombinedPose(results, alignedSide);
                            console.log('Created combined pose with accurate Z values');
                        }
                        break;
                    case 'side':
                        color = 0x0000ff;
                        results = await poseLandmarkerSide.detectForVideo(video, startTimeMs);
                        latestSideResults = results; // Store original side results
                        
                        // Create aligned version for 3D display
                        if (latestFrontResults && results) {
                            alignedResults = alignSideToFrontFor3D(latestFrontResults, results);
                            console.log('Applied pose alignment to side view for 3D');
                            
                            // Also create combined pose when we get new side data
                            combinedResults = createCombinedPose(latestFrontResults, alignedResults);
                        }
                        break;
                }

                // Draw 2D pose landmarks using original coordinates
                drawPoseLandmarks(results, frontOrSide);
                
                // Draw 3D stick figures
                if (frontOrSide === 'front') {
                    // Front view (red)
                    drawStickman3D(results, 0xff0000, 'front');
                    
                    // Combined pose (green) - most accurate with front X,Y and side Z
                    if (combinedResults) {
                        drawStickman3D(combinedResults, 0x00ff00, 'combined');
                    }
                } else {
                    // Side view aligned (blue)
                    const resultsFor3D = alignedResults || results;
                    drawStickman3D(resultsFor3D, 0x0000ff, 'side');
                    
                    // Update combined pose when side data changes
                    if (combinedResults) {
                        drawStickman3D(combinedResults, 0x00ff00, 'combined');
                    }
                }

                // Update table with original coordinates (not aligned)
                const tableId = video.id === 'localVideoFront' ? 'frontTableBody' : 'sideTableBody';
                updateTableData(tableId, results);
            } catch (error) {
                console.error('Error during MediaPipe pose detection:', error);
            }
        }
    }, 1000 / FPS);
}

function initializeThreeJS() {
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

function addLine(startCoords, endCoords, color = 0xff0000, perspective = null) {
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
    line.userData.perspective = perspective;
    
    scene.add(line);

    return line;
}

function clearPoseLines(perspective = null) {
    if (!window.threeJSContext) {
        console.error('Three.js not initialized');
        return;
    }

    const { scene } = window.threeJSContext;

    const linesToRemove = [];
    scene.traverse((child) => {
        if (child instanceof THREE.Line && child.userData.isPoseLine === true) {
            if (perspective === null || child.userData.perspective === perspective) {
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

function drawStickman3D(results, color, frontOrSide) {
    clearPoseLines(frontOrSide);
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
                    addLine(pos1, pos2, color, frontOrSide);
                }
            });
        }
    }
}

camSelect1.addEventListener('change', function() {
  captureCamera(localVideoFront, camSelect1.value);
});

camSelect2.addEventListener('change', function() {
  captureCamera(localVideoSide, camSelect2.value);
});

document.addEventListener('DOMContentLoaded', function() {
    initializeThreeJS();
    initializeTables();
    listDevices();
    initializePoseDetection().then((landmarker) => {
        poseLandmarkerFront = landmarker;
        console.log('BlazePose 1 initialized');
    }).catch((error) => {
        console.error('Error initializing BlazePose 1:', error);
    });

    initializePoseDetection().then((landmarker) => {
        poseLandmarkerSide = landmarker;
        console.log('BlazePose 2 initialized');
    }).catch((error) => {
        console.error('Error initializing BlazePose 2:', error);
    });
});