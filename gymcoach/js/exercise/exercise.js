import { LANDMARK } from "../util/landmark_reader.js";

export class Exercise {
    DEFAULT_BODY_SCALE = 1.0;
    SHOULDER_DISTANCE_THRESHOLD = 0.3;
    HIP_DISTANCE_THRESHOLD = 0.18;

    constructor() {
        this.exerciseStatus = document.getElementById('exercise-status');
    }

    calculateBodyScale(reader) {
        const leftShoulder = reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const rightShoulder = reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
        const leftHip = reader.getLandmark(LANDMARK.LEFT_HIP);
        const rightHip = reader.getLandmark(LANDMARK.RIGHT_HIP);

        let bodyScale = this.DEFAULT_BODY_SCALE;

        if (leftShoulder && leftHip) {
            bodyScale = Math.abs(leftShoulder.y - leftHip.y);
        } else if (rightShoulder && rightHip) {
            bodyScale = Math.abs(rightShoulder.y - rightHip.y);
        }

        return Math.max(bodyScale, 0.1);
    }

    calculate3DBodyRotation(reader) {
        const leftShoulder = reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const rightShoulder = reader.getLandmark(LANDMARK.RIGHT_SHOULDER);

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