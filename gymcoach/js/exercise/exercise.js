import { LANDMARK, LandmarkReader } from "../util/landmark_reader.js";

export class Exercise {
    DEFAULT_BODY_SCALE = 0.5;
    SHOULDER_DISTANCE_THRESHOLD = 0.3;
    HIP_DISTANCE_THRESHOLD = 0.18;

    constructor() {
        this.exerciseStatus = document.getElementById('exercise-status');
        this.reader = new LandmarkReader();
        this.poseData = document.getElementById('pose-data');
    }

    // calculateAdvancedBodyScale(landmarks) {
    //     this.reader.setLandmarks(landmarks);
    //     const measurements = {};

    //     const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
    //     const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
    //     const leftHip = this.reader.getLandmark(LANDMARK.LEFT_HIP);
    //     const rightHip = this.reader.getLandmark(LANDMARK.RIGHT_HIP);

    //     // If shoulders are not available, fall back to default scale
    //     if (!leftShoulder || !rightShoulder) {
    //         console.log("Shoulders not detected, using default body scale");
    //         return this.DEFAULT_BODY_SCALE;
    //     }

    //     measurements.shoulderWidth = Math.sqrt(
    //         Math.pow(rightShoulder.x - leftShoulder.x, 2) +
    //         Math.pow(rightShoulder.y - leftShoulder.y, 2) +
    //         Math.pow(rightShoulder.z - leftShoulder.z, 2)
    //     );

    //     const shoulderMid = {
    //         x: (leftShoulder.x + rightShoulder.x) / 2,
    //         y: (leftShoulder.y + rightShoulder.y) / 2,
    //         z: (leftShoulder.z + rightShoulder.z) / 2
    //     };

    //     const hipsAvailable = leftHip && rightHip;
    //     if (hipsAvailable) {
    //         const hipMid = {
    //             x: (leftHip.x + rightHip.x) / 2,
    //             y: (leftHip.y + rightHip.y) / 2,
    //             z: (leftHip.z + rightHip.z) / 2
    //         };

    //         measurements.torsoLength = Math.sqrt(
    //             Math.pow(shoulderMid.x - hipMid.x, 2) +
    //             Math.pow(shoulderMid.y - hipMid.y, 2) +
    //             Math.pow(shoulderMid.z - hipMid.z, 2)
    //         );

    //         measurements.hipWidth = Math.sqrt(
    //             Math.pow(rightHip.x - leftHip.x, 2) +
    //             Math.pow(rightHip.y - leftHip.y, 2) +
    //             Math.pow(rightHip.z - leftHip.z, 2)
    //         );
    //     }

    //     const averageProportions = {
    //         torsoLength: 0.50,    // ~50cm
    //         shoulderWidth: 0.38,   // ~38cm
    //         hipWidth: 0.32        // ~32cm
    //     };

    //     let finalScale;
    //     if (hipsAvailable && measurements.torsoLength > 0 && measurements.hipWidth > 0) {
    //         const scaleFactors = {
    //             fromTorso: averageProportions.torsoLength / measurements.torsoLength,
    //             fromShoulder: averageProportions.shoulderWidth / measurements.shoulderWidth,
    //             fromHip: averageProportions.hipWidth / measurements.hipWidth
    //         };

    //         finalScale = (
    //             scaleFactors.fromTorso * 0.5 +
    //             scaleFactors.fromShoulder * 0.3 +
    //             scaleFactors.fromHip * 0.2
    //         );

    //         console.log(`Full body scale calculation - Torso: ${measurements.torsoLength.toFixed(3)}, Shoulder: ${measurements.shoulderWidth.toFixed(3)}, Hip: ${measurements.hipWidth.toFixed(3)}, Scale: ${finalScale.toFixed(3)}`);
    //     } else {
    //         const shoulderScale = averageProportions.shoulderWidth / measurements.shoulderWidth;

    //         // Estimate torso length from shoulder width (typical ratio is ~1.3)
    //         const estimatedTorsoLength = measurements.shoulderWidth * 1.3;
    //         const torsoScale = averageProportions.torsoLength / estimatedTorsoLength;

    //         // Weighted average favoring shoulder measurement
    //         finalScale = shoulderScale * 0.7 + torsoScale * 0.3;

    //         console.log(`Shoulder-only body scale calculation - Shoulder: ${measurements.shoulderWidth.toFixed(3)}, Estimated torso: ${estimatedTorsoLength.toFixed(3)}, Scale: ${finalScale.toFixed(3)}`);
    //     }

    //     // Ensure the scale is within reasonable bounds
    //     finalScale = Math.max(0.1, Math.min(10.0, finalScale));

    //     return finalScale;
    // }

    calculateBodyScale(landmarks) {
        this.reader.setLandmarks(landmarks);
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

    normalizeKeypoints(results) {
        const normalizedKeypoints = this.normalizeKeypointsZ(results?.landmarks[0]);
        this.reader.setLandmarks(normalizedKeypoints);
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