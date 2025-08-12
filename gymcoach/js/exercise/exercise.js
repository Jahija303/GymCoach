import { LANDMARK, LandmarkReader } from "../util/landmark_reader.js";

export class Exercise {
    DEFAULT_BODY_SCALE = 0.5;
    SHOULDER_DISTANCE_THRESHOLD = 0.3;
    HIP_DISTANCE_THRESHOLD = 0.18;

    constructor() {
        this.exerciseStatus = document.getElementById('exercise-status');
        this.reader = new LandmarkReader();
        this.poseData = document.getElementById('pose-data');
        this.bodyDimensions = {};
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
        console.log("Body scale: " + Math.max(bodyScale, 0.1));
        return Math.max(bodyScale, 0.1);
    }

    calibrateBodyDimensions() {
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

    calculate3DBodyRotation() {
        // TODO
        // Calculate the body rotation based on the body scale 
        // and the shoulder and hip distance
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