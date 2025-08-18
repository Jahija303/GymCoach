import { drawPoseLandmarks, initializePoseDetection, CANVAS_HEIGHT, CANVAS_WIDTH } from './pose.js';

import { Squat } from './exercise/squat.js';

const localVideoFront = document.getElementById('localVideoFront');
const localVideoSide = document.getElementById('localVideoSide');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const exerciseSelect = document.getElementById('exerciseSelect');
const poseData = document.getElementById('pose-data');

let stream = null;
const FPS = 30;
let intervalId = null;
let webcamRunning = false;
let poseLandmarker = null;
let currentExercise = '';

// export function startFrameCapture() {
//     let frameCount = 0;

//     let intervalId = setInterval(async () => {
//         if (stream && localVideo.videoWidth > 0 && poseLandmarker && webcamRunning) {
//             try {
//                 const startTimeMs = performance.now();
//                 const results = poseLandmarker.detectForVideo(localVideo, startTimeMs);

//                 drawPoseLandmarks(results);

//                 if (frameCount % 9 === 0 && currentExercise) {
//                     currentExercise.validate(results);
//                 }

//                 frameCount++;
//             } catch (error) {
//                 console.error('Error during MediaPipe pose detection:', error);
//             }
//         }
//     }, 1000 / FPS);

//     return intervalId;
// }

async function startCamera() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('Available cameras:', videoDevices);
        
        if (videoDevices.length < 2) {
            console.warn('Only one camera detected. Using single camera mode.');
            const singleStream = await navigator.mediaDevices.getUserMedia({
                video: true, 
                audio: false
            });
            localVideoFront.srcObject = singleStream;
            return;
        }
    
        const frontStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: videoDevices[0].deviceId }, width: { ideal: 768 }, height: { ideal: 432 }, frameRate: { ideal: FPS } },
            audio: false
        });
        
        const sideStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: videoDevices[1].deviceId }, width: { ideal: 768 }, height: { ideal: 432 }, frameRate: { ideal: FPS } },
            audio: false
        });
    
        localVideoFront.srcObject = frontStream;
        localVideoSide.srcObject = sideStream;

        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (error) {
        console.error('Camera error:', error);
    }
}

function stopCamera() {
    webcamRunning = false;
    
    // Stop front camera stream
    if (localVideoFront.srcObject) {
        localVideoFront.srcObject.getTracks().forEach(track => track.stop());
        localVideoFront.srcObject = null;
    }
    
    // Stop side camera stream
    if (localVideoSide.srcObject) {
        localVideoSide.srcObject.getTracks().forEach(track => track.stop());
        localVideoSide.srcObject = null;
    }
    
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }

    // Clear pose canvases
    const poseCanvasFront = document.getElementById('poseCanvasFront');
    const poseCanvasSide = document.getElementById('poseCanvasSide');
    
    if (poseCanvasFront) {
        poseCanvasFront.getContext('2d').clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    if (poseCanvasSide) {
        poseCanvasSide.getContext('2d').clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    if (poseData) {
        poseData.textContent = '';
    }
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

// Exercise selection event listener
// exerciseSelect.addEventListener('change', (event) => {
//     switch (event.target.value) {
//         case 'squat':
//             console.log('Squat selected');
//             currentExercise = new Squat();
//             break;
//         case 'pushup':
//             console.log('Pushup selected');
//             break;
//         case 'plank':
//             console.log('Plank selected');
//             break;
//     }
// });

// document.addEventListener('DOMContentLoaded', () => {
//     initializePoseDetection().then((landmarker) => {
//         poseLandmarker = landmarker;
//         console.log('BlazePose initialized');
//     }).catch((error) => {
//         console.error('Error initializing BlazePose:', error);
//     });
// });