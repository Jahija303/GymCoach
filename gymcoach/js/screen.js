import { drawPoseLandmarks, initializePoseDetection, CANVAS_HEIGHT, CANVAS_WIDTH } from './pose.js';

import { Squat } from './exercise/squat.js';

const localVideo = document.getElementById('localVideo');
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

export function startFrameCapture() {
    let frameCount = 0;
    
    let intervalId = setInterval(async () => {
        if (stream && localVideo.videoWidth > 0 && poseLandmarker && webcamRunning) {
            try {
                const startTimeMs = performance.now();
                const results = poseLandmarker.detectForVideo(localVideo, startTimeMs);

                drawPoseLandmarks(results);

                if (frameCount % 9 === 0 && currentExercise) {
                    currentExercise.validate(results);
                }

                frameCount++;
            } catch (error) {
                console.error('Error during MediaPipe pose detection:', error);
            }
        }
    }, 1000 / FPS);

    return intervalId;
}

async function startCamera() {
    try {
        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: FPS }
            },
            audio: false
        });

        localVideo.srcObject = stream;

        // Wait for video to be ready
        localVideo.addEventListener('loadeddata', () => {
            webcamRunning = true;
            intervalId = startFrameCapture();
        });

        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (error) {
        console.error('Camera error:', error);
    }
}

function stopCamera() {
    webcamRunning = false;
    
    if (stream) {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    
    localVideo.srcObject = null;
    
    // Clear pose canvas
    document.getElementById('poseCanvas').getContext('2d').clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    poseData.textContent = '';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

// Exercise selection event listener
exerciseSelect.addEventListener('change', (event) => {
    switch (event.target.value) {
        case 'squat':
            console.log('Squat selected');
            currentExercise = new Squat();
            break;
        case 'pushup':
            console.log('Pushup selected');
            break;
        case 'plank':
            console.log('Plank selected');
            break;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initializePoseDetection().then((landmarker) => {
        poseLandmarker = landmarker;
        console.log('BlazePose initialized');
    }).catch((error) => {
        console.error('Error initializing BlazePose:', error);
    });
});