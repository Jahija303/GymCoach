import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export const CANVAS_WIDTH = 768;
export const CANVAS_HEIGHT = 432;
export const POSE_CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], // Left arm
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], // Right arm
    [11, 23], [12, 24], [23, 24], // Torso
    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31], // Left leg
    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32], // Right leg
    [0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], // Face
    [0, 7], [0, 8], [9, 10] // Face connections
];
export const LANDMARK_NAMES = [
    'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner',
    'right_eye', 'right_eye_outer', 'left_ear', 'right_ear', 'mouth_left',
    'mouth_right', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky', 'left_index',
    'right_index', 'left_thumb', 'right_thumb', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_heel',
    'right_heel', 'left_foot_index', 'right_foot_index'
];

// This class handles all blazePose related functionality
export class Pose {
    constructor(cameraHelper) {
        this.cameraHelper = cameraHelper;
        this.poseLandmarkers = [];
    }

    // For each camera initialize a blazepose landmarker
    async initializePoseLandmarkers() {
        this.cameraHelper.devices.forEach(async (device, index) => {
            this.poseLandmarkers[index] = await this.initializePoseDetection();
        });
    }

    // Load the blazePose model and initialize it with default options, return it as a result
    async initializePoseDetection() {
        const vision = await FilesetResolver.forVisionTasks(
                "/node_modules/@mediapipe/tasks-vision/wasm"
            );

        let poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                // modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
                // modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_full.task",
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        return poseLandmarker;
    }

    // Draw the 2D pose landmarks on the canvas, which is on top of the camera video stream inside the video wrapper
    drawPoseLandmarks(results, cameraID) {
        const color = `#${this.cameraHelper.devices[cameraID].color.toString(16).padStart(6, '0')}`
        const poseCanvas = document.getElementById(`poseCanvas${cameraID}`);
        const poseCtx = poseCanvas.getContext('2d');
        poseCanvas.width = CANVAS_WIDTH;
        poseCanvas.height = CANVAS_HEIGHT;

        poseCtx.save();
        poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
        
        if (results.landmarks && results.landmarks.length > 0) {
            for (const landmarks of results.landmarks) {
                this.drawConnectors(poseCtx, poseCanvas, landmarks, {
                    color: color,
                    lineWidth: 2,
                });
                this.drawLandmarks(poseCtx, poseCanvas, landmarks, {
                    color: "#ffffffff", 
                    lineWidth: 2,
                    radius: 3,
                });
            }
        }
        poseCtx.restore();
    }

    // Draw connectors between landmarks
    drawConnectors(ctx, poseCanvas, landmarks, style) {
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.lineWidth;

        POSE_CONNECTIONS.forEach(([i, j]) => {
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

    // Draw the landmarks (keypoints)
    drawLandmarks(ctx, poseCanvas, landmarks, style) {
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
}