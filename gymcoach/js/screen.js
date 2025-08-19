import { initializePoseDetection, CANVAS_HEIGHT, CANVAS_WIDTH, drawPoseLandmarks } from './pose.js';

let stream = null;
let intervalIDs = {};
const FPS = 30;
let poseLandmarker = null;
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

  if (!selectedCamera) {
    return;
  }
  
  var constraints = {
    audio: false,
    video: {
      deviceId: { exact: selectedCamera },
      width: { ideal: 768 }, 
      height: { ideal: 432 }, 
      frameRate: { ideal: FPS }
    }
  };

  navigator.mediaDevices.getUserMedia(constraints).then(function(camera) {
    video.srcObject = camera;
    intervalIDs[selectedCamera] = startPoseCapture(video);
  }).catch(function(error) {
    alert('Unable to capture your camera. Please check console logs.');
    console.error(error);
  });
}

function startPoseCapture(video) {
    return setInterval(async () => {
        if (stream && video.videoWidth > 0 && poseLandmarker) {
            try {
                const startTimeMs = performance.now();
                const results = poseLandmarker.detectForVideo(video, startTimeMs);

                let frontOrSide = video.id === 'localVideoFront' ? 'front' : 'side';
                drawPoseLandmarks(results, frontOrSide)
            } catch (error) {
                console.error('Error during MediaPipe pose detection:', error);
            }
        }
    }, 1000 / FPS);
}

camSelect1.addEventListener('change', function() {
  captureCamera(localVideoFront, camSelect1.value);
});

camSelect2.addEventListener('change', function() {
  captureCamera(localVideoSide, camSelect2.value);
});

document.addEventListener('DOMContentLoaded', function() {
  listDevices();
  initializePoseDetection().then((landmarker) => {
        poseLandmarker = landmarker;
        console.log('BlazePose initialized');
    }).catch((error) => {
        console.error('Error initializing BlazePose:', error);
    });
});