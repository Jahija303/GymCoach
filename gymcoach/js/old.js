import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const localVideo = document.getElementById('localVideo');
const poseCanvas = document.getElementById('poseCanvas');
const poseCtx = poseCanvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const poseData = document.getElementById('pose-data');
const exerciseSelect = document.getElementById('exerciseSelect');
const squatStatus = document.getElementById('squat-status');

let stream = null;
const FPS = 30;
let intervalId = null;
let poseLandmarker = null;
let isModelLoaded = false;
let webcamRunning = false;
let currentExercise = null;
let currentSquatState = null; // start, apex, end

// 1280 x 720 (16x9 aspect ratio)
poseCanvas.width = 1280;
poseCanvas.height = 720;

async function initializePoseDetection() {
    try {
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
    } catch (error) {
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
    let frameCount = 0;
    
    intervalId = setInterval(async () => {
        if (stream && localVideo.videoWidth > 0 && isModelLoaded && poseLandmarker && webcamRunning) {
            try {
                const startTimeMs = performance.now();
                const results = poseLandmarker.detectForVideo(localVideo, startTimeMs);
                
                drawPoseLandmarks(results);
                
                if (frameCount % 9 === 0) {
                    switch (currentExercise) {
                        case 'squat':
                            validSquat(results);
                            break;
                        case 'pushup':
                            validPushup(results);
                            break;
                        case 'plank':
                            validPlank(results);
                            break;
                    }
                }
                
                frameCount++;
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
    poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
    poseData.textContent = '';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
}

function armAngles(results){
    let leftArmAngle = null;
    let rightArmAngle = null;

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // Left arm angle (shoulder-elbow-wrist)
        const leftShoulder = landmarks[11];
        const leftElbow = landmarks[13];
        const leftWrist = landmarks[15];
        
        // Right arm angle (shoulder-elbow-wrist)
        const rightShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        const rightWrist = landmarks[16];

        // Calculate left arm angle if all points are visible
        if (leftShoulder.visibility > 0.5 && leftElbow.visibility > 0.5 && leftWrist.visibility > 0.5) {
            leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        }
        
        // Calculate right arm angle if all points are visible
        if (rightShoulder.visibility > 0.5 && rightElbow.visibility > 0.5 && rightWrist.visibility > 0.5) {
            rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        }
    }

    return {
        leftArmAngle: leftArmAngle,
        rightArmAngle: rightArmAngle
    };
}

function legAngles(results) {
    let leftLegAngle = null;
    let rightLegAngle = null;

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const leftHip = landmarks[23];
        const leftKnee = landmarks[25];
        const leftAnkle = landmarks[27];
        const rightHip = landmarks[24];
        const rightKnee = landmarks[26];
        const rightAnkle = landmarks[28];
        
        // Calculate left leg angle if all points are visible
        if (leftHip.visibility > 0.5 && leftKnee.visibility > 0.5 && leftAnkle.visibility > 0.5) {
            leftLegAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        }

        // Calculate right leg angle if all points are visible
        if (rightHip.visibility > 0.5 && rightKnee.visibility > 0.5 && rightAnkle.visibility > 0.5) {
            rightLegAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
        }
    }

    return {
        leftLegAngle: leftLegAngle,
        rightLegAngle: rightLegAngle
    };
}

function hipAngles(results) {
    let leftHipAngle = null;
    let rightHipAngle = null;

    if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftKnee = landmarks[25];
        const rightKnee = landmarks[26];

        // Calculate body angle if all points are visible
        // Left side angle (shoulder-hip-knee)
        if (leftShoulder.visibility > 0.5 && leftHip.visibility > 0.5 && leftKnee.visibility > 0.5) {
            leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
        }

        // Right side angle (shoulder-hip-knee)
        if (rightShoulder.visibility > 0.5 && rightHip.visibility > 0.5 && rightKnee.visibility > 0.5) {
            rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
        }
    }

    return {
        leftHipAngle: leftHipAngle,
        rightHipAngle: rightHipAngle
    };
}

function updateSquatState(legAngle, hipAngle) {
    const LEG_SQUAT_THRESHOLD = 120;    // knee angle for squat detection
    const HIP_SQUAT_THRESHOLD = 120;    // hip angle for squat detection
    const LEG_STANDING_THRESHOLD = 160; // knee angle for standing
    const HIP_STANDING_THRESHOLD = 160; // hip angle for standing
    
    const isSquatting = legAngle < LEG_SQUAT_THRESHOLD && hipAngle < HIP_SQUAT_THRESHOLD;
    const isStanding = legAngle > LEG_STANDING_THRESHOLD && hipAngle > HIP_STANDING_THRESHOLD;
    
    if (isSquatting) {
        currentSquatState = 'squat';
        console.log(`Squat detected - Leg: ${legAngle.toFixed(1)}°, Hip: ${hipAngle.toFixed(1)}°`);
        squatStatus.className = 'status squat-status squat';
        squatStatus.textContent = `Squat`;
    } else if (isStanding) {
        currentSquatState = 'standing';
        console.log(`Standing detected - Leg: ${legAngle.toFixed(1)}°, Hip: ${hipAngle.toFixed(1)}°`);
        squatStatus.className = 'status squat-status standing';
        squatStatus.textContent = `Standing`;
    } else {
        squatStatus.className = 'status squat-status transition';
        squatStatus.textContent = `Transition`;
    }
}

function validSquat(results) {
    console.log("exercise: squat");
    if (results.landmarks && results.landmarks.length > 0) {
        const legAnglesResult = legAngles(results);
        const leftLegAngle = legAnglesResult.leftLegAngle;
        const rightLegAngle = legAnglesResult.rightLegAngle;
        const hipAnglesResult = hipAngles(results);
        const leftHipAngle = hipAnglesResult.leftHipAngle;
        const rightHipAngle = hipAnglesResult.rightHipAngle;

        // we need to be confident that at least one side is visible before checking the form correctness
        if (leftLegAngle !== null && leftHipAngle !== null) {
            updateSquatState(leftLegAngle, leftHipAngle);
        }

        // if (rightLegAngle !== null && rightHipAngle !== null) {
        //     updateSquatState(rightLegAngle, rightHipAngle);
        // }
    }
}

function validPushup(results) {
    console.log("pushup")
}
function validPlank(results) {
    console.log("plank")
}

function calculateAngle(point1, vertex, point2) {
    const vector1 = {
        x: point1.x - vertex.x,
        y: point1.y - vertex.y
    };
    const vector2 = {
        x: point2.x - vertex.x,
        y: point2.y - vertex.y
    };

    const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
    const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
    const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
    
    const cosAngle = dotProduct / (magnitude1 * magnitude2);
    const angleRadians = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    const angleDegrees = (angleRadians * 180) / Math.PI;
    
    return angleDegrees;
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

exerciseSelect.addEventListener('change', (event) => {
    currentExercise = event.target.value;
});

document.addEventListener('DOMContentLoaded', () => {
    initializePoseDetection();
});