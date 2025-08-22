import { Camera } from './util/camera.js';
import { Three } from './util/three.js';
import { Pose } from './util/pose.js';
import { TransformPose } from './util/transform_pose.js';

let three;
let cameraHelper;
let pose;
let transformer;
let intervalIDs = {};
let cameraKeypoints = {};
let lastTransformedAt = null;
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

function renderTransformedPose() {
  // todo
  // render the transformed pose in the 3d scene
  // when was the last time it was run ? check that it does not run twice for the same frame X
  // get the first two devices and their camera keypoints
  // pass the two keypoints to the transformer to align the second to the first
  // draw a 3d stickman with the combined pose
  let currentTime = performance.now();

  // If the last transformation was recent, skip this frame
  if (lastTransformedAt && currentTime - lastTransformedAt < 1000 / FPS) {
    return;
  } else {
    lastTransformedAt = performance.now();
  }

  const deviceIds = cameraHelper.devices.map((device) => device.deviceId);
  const [firstDeviceId, secondDeviceId] = deviceIds;
  
  if (firstDeviceId && secondDeviceId) {
    const firstKeypoints = cameraKeypoints[firstDeviceId];
    const secondKeypoints = cameraKeypoints[secondDeviceId];

    if (firstKeypoints && secondKeypoints) {
      const transformedResults = transformer.align(firstKeypoints.landmarks[0], secondKeypoints.landmarks[0]);
      three.drawStickman3D({landmarks: [transformedResults]}, cameraHelper.COLORS[3], 'combined');
    }
  }

}

// Capture the pose for the selected camera stream
// Render everything on the screen (2d video streams, 3d render, keypoint data)
function startPoseCapture(video, camera, index) {
    console.log(`Starting pose capture for video: ${video.id}`);
    return setInterval(async () => {
        if (video.srcObject && video.videoWidth > 0) {
            try {
                const startTimeMs = performance.now();
                let results = null;

                results = await pose.poseLandmarkers[index].detectForVideo(video, startTimeMs);
                cameraKeypoints[camera.deviceId] = results;
                pose.drawPoseLandmarks(results, index);
                three.drawStickman3D(results, camera.color, index);

                renderTransformedPose()

                const tableId = camera.label
                cameraHelper.updateTableData(tableId, results);
            } catch (error) {
                console.error('Error during pose detection:', error);
            }
        }
    }, 1000 / FPS);
}

// When the page loads, initialize the 3D scene and camera
// Initialize the camera and get all available devices in an array (ask for permissions as well)
// Initialize the blazePose model for each device and store the landmarker in an array
document.addEventListener('DOMContentLoaded', async function() {
    transformer = new TransformPose();
    three = new Three();

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