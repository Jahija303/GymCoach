import { LANDMARK, LandmarkReader } from "../util/landmark_reader.js";

export class Exercise {
    constructor() {
        this.reader = new LandmarkReader();
        this.repCounterElement = document.querySelector("#rep-count span");
        this.bodyDimensions = null;
        this.bodyScaleRef = null;
        this.DEFAULT_BODY_SCALE = 1.0;
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