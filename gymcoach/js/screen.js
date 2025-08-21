import { Camera } from './util/camera.js';
import { Three } from './util/three.js';
import { Pose } from './util/pose.js';

let three;
let cameraHelper;
let pose;
let intervalIDs = {};
const FPS = 30;

// Capture the camera stream and start pose detection
function captureCamera(video, specifiedCamera) {
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

  // Get the camera stream and start the pose capture
  navigator.mediaDevices.getUserMedia(constraints).then(function(camera) {
    video.srcObject = camera;
    const intervalId = startPoseCapture(video, specifiedCamera);
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
function startPoseCapture(video, camera) {
    console.log(`Starting pose capture for video: ${video.id}`);
    return setInterval(async () => {
        if (video.srcObject && video.videoWidth > 0) {
            try {
                const startTimeMs = performance.now();
                const cameraId = camera.deviceId
                let results = null;

                results = await pose.poseLandmarkers[cameraId].detectForVideo(video, startTimeMs);

                pose.drawPoseLandmarks(results, cameraId);
                three.drawStickman3D(results, camera.color, cameraId);

                const tableId = camera.label
                cameraHelper.updateTableData(tableId, results);
            } catch (error) {
                console.error('Error during MediaPipe pose detection:', error);
            }
        }
    }, 1000 / FPS);
}

// When the page loads, initialize the 3D scene and camera
// Initialize the camera and get all available devices in an array (ask for permissions as well)
// Initialize the blazePose model for each device and store the landmarker in an array
document.addEventListener('DOMContentLoaded', async function() {
    three = new Three();

    cameraHelper = new Camera();
    await cameraHelper.initializeDevices();

    pose = new Pose(cameraHelper);
    await pose.initializePoseLandmarkers();

    // For each camera device, start capturing video and rendering the data from blazePose
    cameraHelper.devices.forEach((device) => {
        const localVideo = document.getElementById(`localVideo${device.deviceId}`);
        captureCamera(localVideo, device);
    });
});