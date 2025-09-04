import { Camera } from './util/camera.js';
// import { Three } from './util/three.js';
import { Pose } from './util/pose.js';
import { Squat } from './exercise/squat.js';

let three;
let cameraHelper;
let pose;
let intervalIDs = {};
let frameCount = 0;
let currentExercises = {};
const FPS = 30;

// Capture the camera stream and start pose detection
function captureCamera(video, specifiedCamera, index) {
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

  if (!specifiedCamera) {
    return;
  }

  // Define which camera to use
  var constraints = {
    audio: false,
    video: {
      deviceId: { exact: specifiedCamera.deviceId },
      width: { min: 640, ideal: 1280, max: 1920 }, 
      height: { min: 480, ideal: 720, max: 1080 }, 
      frameRate: { ideal: FPS }
    }
  };

  createAngleGraphForCamera(specifiedCamera, index);
  
  // Initialize exercise for this camera if not already done
  if (!currentExercises[index]) {
    currentExercises[index] = new Squat(index);
  }

  // Get the camera stream and start the pose capture
  navigator.mediaDevices.getUserMedia(constraints).then(function(camera) {
    video.srcObject = camera;
    const intervalId = startPoseCapture(video, specifiedCamera, index);
    intervalIDs[specifiedCamera.deviceId] = {
      intervalId: intervalId,
      videoId: videoId
    };
  }).catch(function(error) {
    alert('Unable to capture your camera. Please check console logs.');
    console.error(error);
  });
}

// Capture the pose for the selected camera stream
// Render everything on the screen (2d video streams, 3d render, keypoint data)
function startPoseCapture(video, camera, index) {
    frameCount++;
    console.log(`Starting pose capture for video: ${video.id}`);
    return setInterval(async () => {
        if (video.srcObject && video.videoWidth > 0) {
            try {
                const startTimeMs = performance.now();
                let results = null;

                results = await pose.poseLandmarkers[index].detectForVideo(video, startTimeMs);
                pose.drawPoseLandmarks(results, index);
                // three.drawStickman3D(results?.landmarks[0], camera.color, index);

                if (currentExercises[index]) {
                    currentExercises[index].validate(results, camera);
                }

                frameCount++;
                // const tableId = camera.label
                // cameraHelper.updateTableData(tableId, results);
            } catch (error) {
                console.error('Error during pose detection:', error);
            }
        }
    }, 1000 / FPS);
}

function createAngleGraphForCamera(specifiedCamera, index) {
  // Create angle graph container for this specific camera
  const videoContainer = document.getElementById('video-container');
  
  // Check if angle graph wrapper for this camera already exists
  const existingWrapper = document.getElementById(`angle-graph-wrapper-${index}`);
  if (!existingWrapper) {
    const angleWrapper = document.createElement('div');
    angleWrapper.className = 'wrapper';
    angleWrapper.id = `angle-graph-wrapper-${index}`;
    
    const label = document.createElement('label');
    label.textContent = `Angle Graph - ${specifiedCamera.label || `Camera ${index}`}`;
    
    const angleContainer = document.createElement('div');
    angleContainer.id = `angle-graph-container-${index}`;
    angleContainer.className = 'angle-graph-container';
    
    const angleCanvas = document.createElement('canvas');
    angleCanvas.id = `angle-graph-canvas-${index}`;
    angleCanvas.className = 'angle-graph-canvas';
    
    angleWrapper.appendChild(label);
    angleWrapper.appendChild(angleContainer);
    angleWrapper.appendChild(angleCanvas);
    
    // Find the first existing angle graph wrapper to insert before it (reverse order)
    const firstAngleWrapper = videoContainer.querySelector('[id^="angle-graph-wrapper-"]');
    if (firstAngleWrapper) {
      videoContainer.insertBefore(angleWrapper, firstAngleWrapper);
    } else {
      videoContainer.appendChild(angleWrapper);
    }
  }
}

// When the page loads, initialize the 3D scene and camera
// Initialize the camera and get all available devices in an array (ask for permissions as well)
// Initialize the blazePose model for each device and store the landmarker in an array
document.addEventListener('DOMContentLoaded', async function() {
    // three = new Three();

    cameraHelper = new Camera();
    await cameraHelper.initializeDevices();

    pose = new Pose(cameraHelper);
    await pose.initializePoseLandmarkers();

    // For each camera device, start capturing video and rendering the data from blazePose
    cameraHelper.devices.forEach((device, index) => {
        const localVideo = document.getElementById(`localVideo${index}`);
        captureCamera(localVideo, device, index);
    });
});

// Add an event listener for exercise selection
document.getElementById('exercise-select').addEventListener('change', (event) => {
    switch (event.target.value) {
        case 'squat':
            console.log('Squat selected');
            cameraHelper.devices.forEach((device, index) => {
                currentExercises[index] = new Squat(index);
            });
            break;
    }
});