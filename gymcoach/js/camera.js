const socket = io.connect("http://localhost:3000");
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
let poseDetector = null;
let isModelLoaded = false;

// 1280 x 720 (16x9 aspect ratio)
poseCanvas.width = 1280;
poseCanvas.height = 720;

async function initializePoseDetection() {
    try {
        poseStatus.textContent = 'Loading MoveNet model...';

        const modelType = poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;
        const detectorConfig = {
            modelType: modelType,
            enableSmoothing: true, // Smooth predictions across frames
            enableSegmentation: false, // Set to true if you need segmentation masks
            minPoseScore: 0.25, // Minimum confidence for pose detection
        };

        poseDetector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet, 
            detectorConfig
        );

        isModelLoaded = true;
        poseStatus.textContent = `MoveNet ${modelType} model loaded successfully!`;
    } catch (error) {
        poseStatus.textContent = 'Error loading MoveNet model: ' + error.message;
    }
}

function drawPose(poses) {
    poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
    
    if (poses.length > 0) {
        const pose = poses[0];

        // MoveNet keypoint connections (skeleton)
        const connections = [
            [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], // arms
            [5, 11], [6, 12], [11, 12], // torso
            [11, 13], [13, 15], [12, 14], [14, 16], // legs
            [0, 1], [0, 2], [1, 3], [2, 4] // face
        ];

        // Draw skeleton connections first, behind keypoints
        connections.forEach(([i, j]) => {
            const kp1 = pose.keypoints[i];
            const kp2 = pose.keypoints[j];

            // Only draw if both keypoints are confident
            if (kp1.score > 0.25 && kp2.score > 0.25) {
                poseCtx.beginPath();
                poseCtx.moveTo(kp1.x, kp1.y);
                poseCtx.lineTo(kp2.x, kp2.y);
                poseCtx.strokeStyle = 'rgba(0, 128, 255, 0.8)';
                poseCtx.lineWidth = 3;
                poseCtx.stroke();
            }
        });

        // Draw keypoints on top
        pose.keypoints.forEach((keypoint, index) => {
            if (keypoint.score > 0.25) {
                // Draw keypoint circle
                poseCtx.beginPath();
                poseCtx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);

                if (index < 5) { // Face keypoints
                    poseCtx.fillStyle = 'red';
                } else if (index < 11) { // Upper body
                    poseCtx.fillStyle = 'orange';
                } else { // Lower body
                    poseCtx.fillStyle = 'blue';
                }
                poseCtx.fill();

                poseCtx.fillStyle = 'white';
                poseCtx.font = '12px Arial';
                poseCtx.strokeStyle = 'black';
                poseCtx.lineWidth = 3;
                poseCtx.strokeText(keypoint.name || `KP${index}`, keypoint.x + 8, keypoint.y - 8);
                poseCtx.fillText(keypoint.name || `KP${index}`, keypoint.x + 8, keypoint.y - 8);
            }
        });

        displayPoseData(poses);
    }
}

function displayPoseData(poses) {
    if (poses.length > 0) {
        const pose = poses[0];

        const keypointNames = [
            'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
            'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
            'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
        ];

        let poseInfo = `MoveNet Detection Results:\n`;
        poseInfo += `Overall Pose Score: ${(pose.score * 100).toFixed(1)}%\n\n`;
        poseInfo += `Confident keypoints (>25%):\n`;

        let confidentKeypoints = 0;
        pose.keypoints.forEach((keypoint, index) => {
            if (keypoint.score > 0.25) {
                confidentKeypoints++;
            }
        });

        poseInfo += `\nTotal confident keypoints: ${confidentKeypoints}/17`;
        
        // Add pose quality assessment
        if (confidentKeypoints >= 12) {
            poseInfo += `\n✅ High quality pose detection`;
        } else if (confidentKeypoints >= 8) {
            poseInfo += `\n⚠️ Medium quality pose detection`;
        } else {
            poseInfo += `\n❌ Low quality pose detection`;
        }
        
        poseData.textContent = poseInfo;
    } else {
        poseData.textContent = 'No poses detected by MoveNet';
    }
}

function updatePostureDisplay(posture) {
    const postureDisplay = document.getElementById('posture-display');
    if (postureDisplay) {
        postureDisplay.textContent = posture;
        postureDisplay.className = posture; // Add CSS class for styling
    }
}

function startFrameCapture() {
    intervalId = setInterval(async () => {
        if (stream && localVideo.videoWidth > 0 && isModelLoaded && poseDetector) {
            try {
                // MoveNet works best with the video element directly
                const poses = await poseDetector.estimatePoses(localVideo, {
                    maxPoses: 1, // Single pose detection
                    flipHorizontal: false, // Mirror image
                    scoreThreshold: 0.25 // Minimum keypoint confidence
                });

                drawPose(poses);
            } catch (error) {
                console.error('Error during MoveNet pose detection:', error);
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

        startFrameCapture();

        startBtn.disabled = true;
        stopBtn.disabled = false;
        cameraStatus.textContent = 'Camera started with pose detection';
    } catch (error) {
        cameraStatus.textContent = 'Error accessing camera: ' + error.message;
    }
}

function stopCamera() {
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
    initializePoseDetection();
});