import { LANDMARK, LandmarkReader } from "../util/landmark_reader.js";

export class Exercise {
    constructor() {
        this.exerciseStatus = document.getElementById('exercise-status');
        this.reader = new LandmarkReader();
        this.poseData = document.getElementById('pose-data');
        this.bodyDimensions = null;
        this.shoulderDistanceRef = null;
        this.hipDistanceRef = null;
        this.bodyScaleRef = null;
    }

    calibrateBodyDimensions() {
        // check if all keypoints are visible
        // check if every keypoint has visibility > 0.9
        // if these conditions are met, store the body dimensions
        // otherwise write a message which keypoints are missing
        this.exerciseStatus.textContent = "Calibrating...";
        this.exerciseStatus.className = "status exercise-status calibrating";

        const missingKeypoints = [];
        for (const landmark of Object.values(LANDMARK)) {
            const point = this.reader.getLandmark(landmark);
            if (!point || point.visibility < 0.85) {
                missingKeypoints.push(landmark);
            }
        }

        if (missingKeypoints.length > 0) {
            const missingKeypointNames = missingKeypoints.map(id => 
                Object.keys(LANDMARK).find(key => LANDMARK[key] === id) || `Unknown(${id})`
            );
            console.log("Missing keypoints:", missingKeypointNames);
            return;
        }

        this.calculateBodyScaleRefs();
        this.bodyDimensions = {
            leftLegLength: this.calculateLength(LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE),
            rightLegLength: this.calculateLength(LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE),
            leftThighLength: this.calculateLength(LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE),
            rightThighLength: this.calculateLength(LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE),
            leftTorso: this.calculateLength(LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP),
            rightTorso: this.calculateLength(LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP),
            leftArm: this.calculateLength(LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_ELBOW),
            rightArm: this.calculateLength(LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_ELBOW),
            leftForearm: this.calculateLength(LANDMARK.LEFT_ELBOW, LANDMARK.LEFT_WRIST),
            rightForearm: this.calculateLength(LANDMARK.RIGHT_ELBOW, LANDMARK.RIGHT_WRIST)
        };
    }

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

    calculateBodyScaleRefs() {
        const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
        const leftHip = this.reader.getLandmark(LANDMARK.LEFT_HIP);
        const rightHip = this.reader.getLandmark(LANDMARK.RIGHT_HIP);
        
        this.shoulderDistanceRef = Math.sqrt(
            (rightShoulder.x - leftShoulder.x) ** 2 + 
            (rightShoulder.y - leftShoulder.y) ** 2
        );
        this.hipDistanceRef = Math.sqrt(
            (rightHip.x - leftHip.x) ** 2 + 
            (rightHip.y - leftHip.y) ** 2
        );

        let bodyScale = null;
        if (leftShoulder && leftHip) {
            bodyScale = Math.abs(leftShoulder.y - leftHip.y);
        } else if (rightShoulder && rightHip) {
            bodyScale = Math.abs(rightShoulder.y - rightHip.y);
        }
        this.bodyScaleRef = bodyScale;
    }

    calculate3DBodyRotation() {
        const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
        const leftHip = this.reader.getLandmark(LANDMARK.LEFT_HIP);
        const rightHip = this.reader.getLandmark(LANDMARK.RIGHT_HIP);

        // Check if we have the required shoulder landmarks
        if (!leftShoulder || !rightShoulder) {
            return null;
        }

        // Check if hips are available
        let hipsAvailable = leftHip && rightHip;
        
        // Check visibility threshold for shoulders (always required)
        const shoulderVisibility = (leftShoulder.visibility + rightShoulder.visibility) / 2;
        if (shoulderVisibility < 0.7) {
            return null;
        }

        // Check hip visibility if hips are available
        if (hipsAvailable) {
            const hipVisibility = (leftHip.visibility + rightHip.visibility) / 2;
            if (hipVisibility < 0.7) {
                // Hips not reliable, use shoulders only
                hipsAvailable = false;
            }
        }

        // Ensure we have reference distances from calibration
        if (!this.shoulderDistanceRef || !this.bodyScaleRef) {
            return null; // Need to calibrate first
        }
        
        // If we plan to use hips but don't have hip reference, fall back to shoulders only
        if (hipsAvailable && !this.hipDistanceRef) {
            hipsAvailable = false;
        }

        // Calculate current vertical scale (torso height) for normalization
        let currentBodyScale = null;
        if (leftShoulder && leftHip) {
            currentBodyScale = Math.abs(leftShoulder.y - leftHip.y);
        } else if (rightShoulder && rightHip) {
            currentBodyScale = Math.abs(rightShoulder.y - rightHip.y);
        }
        const scaleRatio = this.bodyScaleRef / currentBodyScale;

        // Calculate shoulder distance
        const shoulderDistance = Math.sqrt(
            (rightShoulder.x - leftShoulder.x) ** 2 + 
            (rightShoulder.y - leftShoulder.y) ** 2
        );

        // Normalize shoulder distance using vertical scale
        const normalizedShoulderDistance = shoulderDistance * scaleRatio;
        const shoulderRatio = Math.min(1, normalizedShoulderDistance / this.shoulderDistanceRef);
        const shoulderAngle = 90 + (shoulderRatio * 90); // Maps 0->90°, 1->180°

        let rotationDegrees;

        if (hipsAvailable) {
            // Calculate hip distance
            const hipDistance = Math.sqrt(
                (rightHip.x - leftHip.x) ** 2 + 
                (rightHip.y - leftHip.y) ** 2
            );

            // Normalize hip distance using vertical scale
            const normalizedHipDistance = hipDistance * scaleRatio;
            const hipRatio = Math.min(1, normalizedHipDistance / this.hipDistanceRef);
            const hipAngle = 90 + (hipRatio * 90); // Maps 0->90°, 1->180°

            // Weighted combination: shoulder distance (0.5) + hip distance (0.4)
            rotationDegrees = (shoulderAngle * 0.5) + (hipAngle * 0.4);
        } else {
            // Use shoulders only
            rotationDegrees = shoulderAngle;
        }

        // Clamp rotation to reasonable range (90-180 degrees)
        rotationDegrees = Math.max(90, Math.min(180, rotationDegrees));

        return Math.round(rotationDegrees * 100) / 100;
    }

    calculateAngle3D(point1, vertex, point2, previousAngle = null) {
        if (!point1 || !vertex || !point2) {
            return null;
        }

        const avgConfidence = (point1.visibility + vertex.visibility + point2.visibility) / 3;
        if (avgConfidence < 0.7) {
            return null;
        }

        const vector1 = {
            x: point1.x - vertex.x,
            y: point1.y - vertex.y,
            z: point1.z - vertex.z
        };

        const vector2 = {
            x: point2.x - vertex.x,
            y: point2.y - vertex.y,
            z: point2.z - vertex.z
        };

        const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z;

        const magnitude1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2 + vector1.z ** 2);
        const magnitude2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2 + vector2.z ** 2);

        if (magnitude1 === 0 || magnitude2 === 0) {
            return null;
        }

        const cosAngle = dotProduct / (magnitude1 * magnitude2);
        const angleRadians = Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp to avoid NaN
        let angleDegrees = angleRadians * (180 / Math.PI);

        if (angleDegrees < 10 || angleDegrees > 180) {
            return null; // Anatomically impossible angle
        }

        // Add temporal smoothing if previous angle is available
        if (previousAngle !== null && Math.abs(angleDegrees - previousAngle) < 45) {
            const smoothingFactor = 0.7;
            angleDegrees = previousAngle * smoothingFactor + angleDegrees * (1 - smoothingFactor);
        }

        return Math.round(angleDegrees * 100) / 100;
    }

    calculateAngle3DAlternative(point1, vertex, point2, limb1Length, limb2Length, bodyRotation) {
        if (!point1 || !vertex || !point2) {
            return null;
        }

        const avgConfidence = (point1.visibility + vertex.visibility + point2.visibility) / 3;
        if (avgConfidence < 0.5) {
            return null;
        }

        // Calculate 2D distance between point1 and point2
        const distance_2d = Math.sqrt(
            (point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2
        );

        // Estimate the actual 3D distance between point1 and point2
        // This requires considering how the body rotation affects the apparent distance
        const rotationFactor = Math.abs(Math.cos(bodyRotation));
        const estimatedDistance3D = distance_2d / Math.max(0.1, rotationFactor);

        // Use law of cosines: c² = a² + b² - 2ab*cos(C)
        // Rearranged: cos(C) = (a² + b² - c²) / (2ab)
        const cosAngle = (limb1Length ** 2 + limb2Length ** 2 - estimatedDistance3D ** 2) / 
                        (2 * limb1Length * limb2Length);

        if (cosAngle < -1 || cosAngle > 1) {
            return null; // Invalid triangle
        }

        const angleRadians = Math.acos(cosAngle);
        let angleDegrees = angleRadians * (180 / Math.PI);

        if (angleDegrees < 10 || angleDegrees > 180) {
            return null; // Anatomically impossible angle
        }

        return Math.round(angleDegrees * 100) / 100;
    }
}