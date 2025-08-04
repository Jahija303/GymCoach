import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const socket = window.io.connect("http://localhost:3000");
const localVideo = document.getElementById('localVideo');
const poseCanvas = document.getElementById('poseCanvas');
const poseCtx = poseCanvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const cameraStatus = document.getElementById('status');
const poseStatus = document.getElementById('pose-status');
const poseData = document.getElementById('pose-data');

let stream = null;
const FPS = 30;
let intervalId = null;
let poseLandmarker = null;
let isModelLoaded = false;
let webcamRunning = false;

// 1280 x 720 (16x9 aspect ratio)
poseCanvas.width = 1280;
poseCanvas.height = 720;

async function initializePoseDetection() {
    try {
        poseStatus.textContent = 'Loading MediaPipe Pose Landmarker model...';

        const vision = await FilesetResolver.forVisionTasks(
            "/node_modules/@mediapipe/tasks-vision/wasm"
        );

        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        isModelLoaded = true;
        poseStatus.textContent = 'MediaPipe Pose Landmarker model loaded successfully!';
    } catch (error) {
        poseStatus.textContent = 'Error loading MediaPipe Pose Landmarker model: ' + error.message;
        console.error('Error:', error);
    }
}

function drawPoseLandmarks(results) {
    poseCtx.save();
    poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
    
    if (results.landmarks && results.landmarks.length > 0) {
        for (const landmarks of results.landmarks) {
            drawConnectors(poseCtx, landmarks, {
                color: "#00FF00",
                lineWidth: 4,
            });
            drawLandmarks(poseCtx, landmarks, {
                color: "#FF0000", 
                lineWidth: 2,
                radius: 6,
            });
        }
        displayPoseData(results);
    }
    poseCtx.restore();
}

function drawConnectors(ctx, landmarks, style) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    
    // Define pose connections based on MediaPipe pose model
    const poseConnections = [
        [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], // Left arm
        [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], // Right arm
        [11, 23], [12, 24], [23, 24], // Torso
        [23, 25], [25, 27], [27, 29], [27, 31], [29, 31], // Left leg
        [24, 26], [26, 28], [28, 30], [28, 32], [30, 32], // Right leg
        [0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], // Face
        [0, 7], [0, 8], [9, 10] // Face connections
    ];
    
    poseConnections.forEach(([i, j]) => {
        const landmark1 = landmarks[i];
        const landmark2 = landmarks[j];
        
        if (landmark1 && landmark2 && landmark1.visibility > 0.5 && landmark2.visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(landmark1.x * poseCanvas.width, landmark1.y * poseCanvas.height);
            ctx.lineTo(landmark2.x * poseCanvas.width, landmark2.y * poseCanvas.height);
            ctx.stroke();
        }
    });
}

function drawLandmarks(ctx, landmarks, style) {
    ctx.fillStyle = style.color;

    landmarks.forEach((landmark, index) => {
        if (landmark.visibility > 0.5) {
            ctx.beginPath();
            ctx.arc(
                landmark.x * poseCanvas.width, 
                landmark.y * poseCanvas.height, 
                style.radius, 
                0, 
                2 * Math.PI
            );
            ctx.fill();
        }
    });
}

function displayPoseData(results) {
    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const landmarkNames = [
            'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner',
            'right_eye', 'right_eye_outer', 'left_ear', 'right_ear', 'mouth_left',
            'mouth_right', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky', 'left_index',
            'right_index', 'left_thumb', 'right_thumb', 'left_hip', 'right_hip',
            'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_heel',
            'right_heel', 'left_foot_index', 'right_foot_index'
        ];

        let poseInfo = `MediaPipe Pose Landmarker Detection Results:\n`;
        let visibleLandmarks = 0;
        landmarks.forEach(landmark => {
            if (landmark.visibility > 0.5) {
                visibleLandmarks++;
            }
        });

        poseInfo += `Visible landmarks (>50%): ${visibleLandmarks}/${landmarks.length}\n\n`;
        if (visibleLandmarks >= 25) {
            poseInfo += `✅ High quality pose detection`;
        } else if (visibleLandmarks >= 20) {
            poseInfo += `⚠️ Medium quality pose detection`;
        } else {
            poseInfo += `❌ Low quality pose detection`;
        }

        poseData.textContent = poseInfo;
    } else {
        poseData.textContent = 'No poses detected by MediaPipe Pose Landmarker';
    }
}

function startFrameCapture() {
    intervalId = setInterval(async () => {
        if (stream && localVideo.videoWidth > 0 && isModelLoaded && poseLandmarker && webcamRunning) {
            try {
                const startTimeMs = performance.now();
                
                const results = poseLandmarker.detectForVideo(localVideo, startTimeMs);
                
                drawPoseLandmarks(results);
            } catch (error) {
                console.error('Error during MediaPipe pose detection:', error);
            }
        }
    }, 1000 / FPS);
}

async function startCamera() {
    try {
        if (!isModelLoaded) {
            await initializePoseDetection();
        }
        
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
            startFrameCapture();
        });

        startBtn.disabled = true;
        stopBtn.disabled = false;
        cameraStatus.textContent = 'Camera started with pose detection';
    } catch (error) {
        cameraStatus.textContent = 'Error accessing camera: ' + error.message;
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
    poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
    poseData.textContent = '';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    cameraStatus.textContent = 'Camera stopped';
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

socket.on('connect', () => {
    console.log('Connected to server');
    cameraStatus.textContent = 'Connected to server';
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    cameraStatus.textContent = 'Disconnected from server';
});

document.addEventListener('DOMContentLoaded', () => {
    poseStatus.textContent = 'Initializing MediaPipe Pose Landmarker...';
    console.log('DOM loaded, initializing MediaPipe...');

    initializePoseDetection();
});