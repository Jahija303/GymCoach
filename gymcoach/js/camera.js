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
const FPS = 15;
let intervalId = null;
let poseDetector = null;
let isModelLoaded = false;

// 1280 x 720
poseCanvas.width = 1280;
poseCanvas.height = 720;

// Initialize pose detection model
async function initializePoseDetection() {
    try {
        poseStatus.textContent = 'Loading pose detection model...';
        
        // Create a detector with MoveNet Lightning model
        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        };
        
        poseDetector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet, 
            detectorConfig
        );
        
        isModelLoaded = true;
        poseStatus.textContent = 'Pose detection model loaded successfully!';
        console.log('Pose detection model loaded');
    } catch (error) {
        console.error('Error loading pose detection model:', error);
        poseStatus.textContent = 'Error loading pose detection model: ' + error.message;
    }
}

// Draw pose keypoints and skeleton
function drawPose(poses) {
    // Clear canvas
    poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
    
    if (poses.length > 0) {
        const pose = poses[0]; // Get first detected pose
        
        // Draw keypoints
        pose.keypoints.forEach((keypoint) => {
            if (keypoint.score > 0.3) { // Only draw confident keypoints
                poseCtx.beginPath();
                poseCtx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
                poseCtx.fillStyle = 'red';
                poseCtx.fill();
                
                // Draw keypoint label
                poseCtx.fillStyle = 'white';
                poseCtx.font = '10px Arial';
                poseCtx.fillText(keypoint.name, keypoint.x + 6, keypoint.y - 6);
            }
        });
        
        // Draw skeleton connections
        const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
        adjacentKeyPoints.forEach(([i, j]) => {
            const kp1 = pose.keypoints[i];
            const kp2 = pose.keypoints[j];
            
            // Only draw if both keypoints are confident
            if (kp1.score > 0.3 && kp2.score > 0.3) {
                poseCtx.beginPath();
                poseCtx.moveTo(kp1.x, kp1.y);
                poseCtx.lineTo(kp2.x, kp2.y);
                poseCtx.strokeStyle = 'blue';
                poseCtx.lineWidth = 2;
                poseCtx.stroke();
            }
        });
        
        // Display pose data
        displayPoseData(poses);
    }
}

// Display pose information
function displayPoseData(poses) {
    if (poses.length > 0) {
        const pose = poses[0];
        let poseInfo = `Detected ${poses.length} pose(s)\n\nConfident keypoints:\n`;
        
        pose.keypoints.forEach((keypoint, index) => {
            if (keypoint.score > 0.3) {
                poseInfo += `${keypoint.name}: (${Math.round(keypoint.x)}, ${Math.round(keypoint.y)}) - ${Math.round(keypoint.score * 100)}%\n`;
            }
        });
        
        poseData.textContent = poseInfo;
    } else {
        poseData.textContent = 'No poses detected';
    }
}

async function startCamera() {
    try {
        // Initialize pose detection if not already done
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
        console.error('Error accessing camera:', error);
        cameraStatus.textContent = 'Error accessing camera: ' + error.message;
    }
}

function startFrameCapture() {
    intervalId = setInterval(async () => {
        if (stream && localVideo.videoWidth > 0) {
            
            // Perform pose detection if model is loaded
            if (isModelLoaded && poseDetector) {
                try {
                    const poses = await poseDetector.estimatePoses(localVideo);
                    drawPose(poses);
                } catch (error) {
                    console.error('Error during pose detection:', error);
                }
            }
        }
    }, 1000 / FPS);
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

// Initialize pose detection when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializePoseDetection();
});