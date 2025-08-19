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

// function stopCapture() {    
//     if (intervalId) {
//         clearInterval(intervalId);
//         intervalId = null;
//     }
// }

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
                let color = null;
                switch (frontOrSide) {
                    case 'front':
                        color = 0xff0000;
                        results = await poseLandmarkerFront.detectForVideo(video, startTimeMs);
                        break;
                    case 'side':
                        color = 0x0000ff;
                        results = await poseLandmarkerSide.detectForVideo(video, startTimeMs);
                        break;
                }

                drawPoseLandmarks(results, frontOrSide);
                drawStickman3D(results, color, frontOrSide);

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