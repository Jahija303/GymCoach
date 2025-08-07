import { LandmarkReader, LANDMARK } from '../util/landmark_reader.js';

DEFAULT_BODY_SCALE = 1.0;
SHOULDER_DISTANCE_THRESHOLD = 0.3;
HIP_DISTANCE_THRESHOLD = 0.18;

export class Exercise {
    constructor() {
        this.exerciseStatus = document.getElementById('exercise-status');
    }

    calculateAngle(point1, vertex, point2) {
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

    armAngles(results) {
        let leftArmAngle = null;
        let rightArmAngle = null;

        if (results.landmarks && results.landmarks.length > 0) {
            const reader = new LandmarkReader(results);
            
            // Left arm angle (shoulder-elbow-wrist)
            const leftShoulder = reader.getLandmark(LANDMARK.LEFT_SHOULDER);
            const leftElbow = reader.getLandmark(LANDMARK.LEFT_ELBOW);
            const leftWrist = reader.getLandmark(LANDMARK.LEFT_WRIST);
            
            // Right arm angle (shoulder-elbow-wrist)
            const rightShoulder = reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
            const rightElbow = reader.getLandmark(LANDMARK.RIGHT_ELBOW);
            const rightWrist = reader.getLandmark(LANDMARK.RIGHT_WRIST);

            // Calculate left arm angle if all points are visible
            if (leftShoulder && leftElbow && leftWrist) {
                leftArmAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
            }
            
            // Calculate right arm angle if all points are visible
            if (rightShoulder && rightElbow && rightWrist) {
                rightArmAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);
            }
        }

        return {
            leftArmAngle: leftArmAngle,
            rightArmAngle: rightArmAngle
        };
    }

    legAngles(results) {
        let leftLegAngle = null;
        let rightLegAngle = null;

        if (results.landmarks && results.landmarks.length > 0) {
            const reader = new LandmarkReader(results);
            const leftHip = reader.getLandmark(LANDMARK.LEFT_HIP);
            const leftKnee = reader.getLandmark(LANDMARK.LEFT_KNEE);
            const leftAnkle = reader.getLandmark(LANDMARK.LEFT_ANKLE);
            const rightHip = reader.getLandmark(LANDMARK.RIGHT_HIP);
            const rightKnee = reader.getLandmark(LANDMARK.RIGHT_KNEE);
            const rightAnkle = reader.getLandmark(LANDMARK.RIGHT_ANKLE);
            
            // Calculate left leg angle if all points are visible
            if (leftHip && leftKnee && leftAnkle) {
                leftLegAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle);
            }

            // Calculate right leg angle if all points are visible
            if (rightHip && rightKnee && rightAnkle) {
                rightLegAngle = this.calculateAngle(rightHip, rightKnee, rightAnkle);
            }
        }

        return {
            leftLegAngle: leftLegAngle,
            rightLegAngle: rightLegAngle
        };
    }

    hipAngles(results) {
        let leftHipAngle = null;
        let rightHipAngle = null;

        if (results.landmarks && results.landmarks.length > 0) {
            const reader = new LandmarkReader(results);
            const leftShoulder = reader.getLandmark(LANDMARK.LEFT_SHOULDER);
            const rightShoulder = reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
            const leftHip = reader.getLandmark(LANDMARK.LEFT_HIP);
            const rightHip = reader.getLandmark(LANDMARK.RIGHT_HIP);
            const leftKnee = reader.getLandmark(LANDMARK.LEFT_KNEE);
            const rightKnee = reader.getLandmark(LANDMARK.RIGHT_KNEE);

            // Calculate body angle if all points are visible
            // Left side angle (shoulder-hip-knee)
            if (leftShoulder && leftHip && leftKnee) {
                leftHipAngle = this.calculateAngle(leftShoulder, leftHip, leftKnee);
            }

            // Right side angle (shoulder-hip-knee)
            if (rightShoulder && rightHip && rightKnee) {
                rightHipAngle = this.calculateAngle(rightShoulder, rightHip, rightKnee);
            }
        }

        return {
            leftHipAngle: leftHipAngle,
            rightHipAngle: rightHipAngle
        };
    }

    calculateBodyScale(reader) {
        const leftShoulder = reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const rightShoulder = reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
        const leftHip = reader.getLandmark(LANDMARK.LEFT_HIP);
        const rightHip = reader.getLandmark(LANDMARK.RIGHT_HIP);

        let bodyScale = DEFAULT_BODY_SCALE;

        if (leftShoulder && leftHip) {
            bodyScale = Math.abs(leftShoulder.y - leftHip.y);
        } else if (rightShoulder && rightHip) {
            bodyScale = Math.abs(rightShoulder.y - rightHip.y);
        }

        return Math.max(bodyScale, 0.1);
    }

    userDirection(results) {
        if (!results.landmarks || results.landmarks.length === 0) {
            return 'unknown';
        }

        const reader = new LandmarkReader(results);
        let frontIndicators = 0;
        let leftSideIndicators = 0;
        let rightSideIndicators = 0;
        let relativeShoulderDistance = 0;
        let relativeHipDistance = 0;

        const bodyScale = this.calculateBodyScale(reader);
        const leftShoulder = reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const rightShoulder = reader.getLandmark(LANDMARK.RIGHT_SHOULDER);

        if (leftShoulder && rightShoulder) {
            const shoulderDistance = Math.abs(leftShoulder.x - rightShoulder.x);
            relativeShoulderDistance = shoulderDistance / bodyScale;

            if (relativeShoulderDistance < SHOULDER_DISTANCE_THRESHOLD) {
                if (leftShoulder.visibility > rightShoulder.visibility) {
                    leftSideIndicators += 2;
                } else if (rightShoulder.visibility > leftShoulder.visibility) {
                    rightSideIndicators += 2;
                } else {
                    if (leftShoulder.x < rightShoulder.x) {
                        leftSideIndicators += 2;
                    } else {
                        rightSideIndicators += 2;
                    }
                }
            } else if (relativeShoulderDistance > SHOULDER_DISTANCE_THRESHOLD) {
                frontIndicators += 2;
            }
        } else if (leftShoulder) {
            leftSideIndicators += 1;
        } else if (rightShoulder) {
            rightSideIndicators += 1;
        }

        const leftHip = reader.getLandmark(LANDMARK.LEFT_HIP);
        const rightHip = reader.getLandmark(LANDMARK.RIGHT_HIP);

        if (leftHip && rightHip) {
            const hipDistance = Math.abs(leftHip.x - rightHip.x);
            relativeHipDistance = hipDistance / bodyScale;

            if (relativeHipDistance < HIP_DISTANCE_THRESHOLD) {
                if (leftHip.visibility > rightHip.visibility) {
                    leftSideIndicators += 1;
                } else if (rightHip.visibility > leftHip.visibility) {
                    rightSideIndicators += 1;
                } else {
                    if (leftHip.x < rightHip.x) {
                        leftSideIndicators += 1;
                    } else {
                        rightSideIndicators += 1;
                    }
                }
            } else if (relativeHipDistance > HIP_DISTANCE_THRESHOLD) {
                frontIndicators += 1;
            }
        } else if (leftHip) {
            leftSideIndicators += 1;
        } else if (rightHip) {
            rightSideIndicators += 1;
        }

        let direction = '';
        const totalSideIndicators = leftSideIndicators + rightSideIndicators;
        if (totalSideIndicators + frontIndicators === 0) {
            direction = 'unknown';
        }

        if (totalSideIndicators > frontIndicators) {
            if (leftSideIndicators > rightSideIndicators) {
                direction = 'left-side';
            } else if (rightSideIndicators > leftSideIndicators) {
                direction = 'right-side';
            } else {
                direction = 'unknown';
            }
        } else if (frontIndicators > totalSideIndicators) {
            direction = 'front';
        } else {
            direction = 'unknown';
        }

        const poseData = document.getElementById('pose-data');
        poseData.textContent = "Direction: " + direction + ` (Shoulder: ${relativeShoulderDistance.toFixed(2)}, Hip: ${relativeHipDistance.toFixed(2)})` + ` (Body Scale: ${bodyScale.toFixed(2)})`;
    }
}