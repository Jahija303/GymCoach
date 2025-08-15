import { LANDMARK, LandmarkReader } from "../util/landmark_reader.js";

export class Exercise {
    constructor() {
        this.exerciseStatus = document.getElementById('exercise-status');
        this.reader = new LandmarkReader();
        this.poseData = document.getElementById('pose-data');
        this.bodyDimensions = null;
        this.bodyScaleRef = null;
        this.DEFAULT_BODY_SCALE = 1.0;
    }

    // calibrateBodyDimensions() {
    //     // check if all keypoints are visible
    //     // check if every keypoint has visibility > 0.9
    //     // if these conditions are met, store the body dimensions
    //     // otherwise write a message which keypoints are missing
    //     this.exerciseStatus.textContent = "Calibrating...";
    //     this.exerciseStatus.className = "status exercise-status calibrating";

    //     const missingKeypoints = [];
    //     const coreBodyLandmarks = [
    //         LANDMARK.LEFT_SHOULDER,
    //         LANDMARK.RIGHT_SHOULDER,
    //         LANDMARK.LEFT_ELBOW,
    //         LANDMARK.RIGHT_ELBOW,
    //         LANDMARK.LEFT_WRIST,
    //         LANDMARK.RIGHT_WRIST,
    //         LANDMARK.LEFT_HIP,
    //         LANDMARK.RIGHT_HIP,
    //         LANDMARK.LEFT_KNEE,
    //         LANDMARK.RIGHT_KNEE,
    //         LANDMARK.LEFT_ANKLE,
    //         LANDMARK.RIGHT_ANKLE
    //     ];

    //     for (const landmark of coreBodyLandmarks) {
    //         const point = this.reader.getLandmark(landmark);
    //         if (!point || point.visibility < 0.85) {
    //             missingKeypoints.push(landmark);
    //         }
    //     }

    //     if (missingKeypoints.length > 0) {
    //         const missingKeypointNames = missingKeypoints.map(id => 
    //             Object.keys(LANDMARK).find(key => LANDMARK[key] === id) || `Unknown(${id})`
    //         );
    //         console.log("Missing keypoints:", missingKeypointNames);
    //         return;
    //     }

    //     this.bodyScaleRef = this.calculateBodyScale();
    //     this.bodyDimensions = {
    //         leftLegLength: this.calculateLength(LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE),
    //         rightLegLength: this.calculateLength(LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE),
    //         leftThighLength: this.calculateLength(LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE),
    //         rightThighLength: this.calculateLength(LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE),
    //         leftTorso: this.calculateLength(LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP),
    //         rightTorso: this.calculateLength(LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP),
    //         leftArm: this.calculateLength(LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_ELBOW),
    //         rightArm: this.calculateLength(LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_ELBOW),
    //         leftForearm: this.calculateLength(LANDMARK.LEFT_ELBOW, LANDMARK.LEFT_WRIST),
    //         rightForearm: this.calculateLength(LANDMARK.RIGHT_ELBOW, LANDMARK.RIGHT_WRIST)
    //     };
    // }

    calculateLength(point1, point2) {
        const startPoint = this.reader.getLandmark(point1);
        const endPoint = this.reader.getLandmark(point2);

        if (!startPoint || !endPoint) {
            return 0;
        }

        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    normalizeKeypointsZ(landmarks) {
        const scaleZ = this.calculateBodyScale(landmarks);
        const normalizedKeypoints = [...landmarks];

        const referenceZ = landmarks[0].z;

        normalizedKeypoints.forEach(point => {
            if (point.z !== undefined) {
                point.z = (point.z - referenceZ) * scaleZ;
            }
        });
        
        return normalizedKeypoints;
    }

    calculateBodyScale() {
        const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
        const leftHip = this.reader.getLandmark(LANDMARK.LEFT_HIP);
        const rightHip = this.reader.getLandmark(LANDMARK.RIGHT_HIP);

        let bodyScale = this.DEFAULT_BODY_SCALE;

        if (leftShoulder && leftHip) {
            bodyScale = Math.abs(leftShoulder.y - leftHip.y);
        } else if (rightShoulder && rightHip) {
            bodyScale = Math.abs(rightShoulder.y - rightHip.y);
        }

        return Math.max(bodyScale, 0.1);
    }

    calculate3DBodyRotation() {
        const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);

        if (!leftShoulder || !rightShoulder) {
            return null;
        }

        const shoulderVector = {
            x: rightShoulder.x - leftShoulder.x,
            y: rightShoulder.y - leftShoulder.y,
            z: rightShoulder.z - leftShoulder.z
        };

        const rotation = Math.atan2(shoulderVector.z, shoulderVector.x) * (180 / Math.PI);
        const tilt = Math.atan2(shoulderVector.y, shoulderVector.x) * (180 / Math.PI);

        return { rotation: rotation, tilt: tilt };
    }

    calculateAngle2D(point1, vertex, point2, previousAngle = null) {
        if (!point1 || !vertex || !point2) {
            return null;
        }

        const vector1 = {
            x: point1.x - vertex.x,
            y: point1.y - vertex.y
        };

        const vector2 = {
            x: point2.x - vertex.x,
            y: point2.y - vertex.y
        };

        const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
        const magnitude1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2);
        const magnitude2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2);

        if (magnitude1 === 0 || magnitude2 === 0) {
            return null;
        }

        const cosAngle = dotProduct / (magnitude1 * magnitude2);
        const angleRadians = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
        let angleDegrees = angleRadians * (180 / Math.PI);

        if (angleDegrees < 10 || angleDegrees > 180) {
            return null;
        }

        if (previousAngle !== null && Math.abs(angleDegrees - previousAngle) < 45) {
            const smoothingFactor = 0.7;
            angleDegrees = previousAngle * smoothingFactor + angleDegrees * (1 - smoothingFactor);
        }

        return Math.round(angleDegrees * 100) / 100;
    }
}