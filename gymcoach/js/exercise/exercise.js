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
                leftArmAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
            }
            
            // Calculate right arm angle if all points are visible
            if (rightShoulder.visibility > 0.5 && rightElbow.visibility > 0.5 && rightWrist.visibility > 0.5) {
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
            const landmarks = results.landmarks[0];
            const leftHip = landmarks[23];
            const leftKnee = landmarks[25];
            const leftAnkle = landmarks[27];
            const rightHip = landmarks[24];
            const rightKnee = landmarks[26];
            const rightAnkle = landmarks[28];
            
            // Calculate left leg angle if all points are visible
            if (leftHip.visibility > 0.5 && leftKnee.visibility > 0.5 && leftAnkle.visibility > 0.5) {
                leftLegAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle);
            }

            // Calculate right leg angle if all points are visible
            if (rightHip.visibility > 0.5 && rightKnee.visibility > 0.5 && rightAnkle.visibility > 0.5) {
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
                leftHipAngle = this.calculateAngle(leftShoulder, leftHip, leftKnee);
            }

            // Right side angle (shoulder-hip-knee)
            if (rightShoulder.visibility > 0.5 && rightHip.visibility > 0.5 && rightKnee.visibility > 0.5) {
                rightHipAngle = this.calculateAngle(rightShoulder, rightHip, rightKnee);
            }
        }

        return {
            leftHipAngle: leftHipAngle,
            rightHipAngle: rightHipAngle
        };
    }

    userDirection(results) {
        if (!results.landmarks || results.landmarks.length === 0) {
            return 'unknown';
        }

        const landmarks = results.landmarks[0];
        let frontIndicators = 0;
        let leftSideIndicators = 0;
        let rightSideIndicators = 0;

        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        
        if (leftShoulder?.visibility > 0.5 && rightShoulder?.visibility > 0.5) {
            const shoulderDistance = Math.abs(leftShoulder.x - rightShoulder.x);
            if (shoulderDistance < 0.08) {
                if (leftShoulder.visibility > rightShoulder.visibility) {
                    leftSideIndicators += 2;
                } else if (rightShoulder.visibility > leftShoulder.visibility) {
                    rightSideIndicators += 2;
                } else {
                    // If visibility is equal, use x position (left shoulder should be on left side of screen for left side view)
                    if (leftShoulder.x < rightShoulder.x) {
                        leftSideIndicators += 2;
                    } else {
                        rightSideIndicators += 2;
                    }
                }
            } else if (shoulderDistance > 0.18) {
                frontIndicators += 2;
            }
        } else if (leftShoulder?.visibility > 0.5) {
            leftSideIndicators += 1;
        } else if (rightShoulder?.visibility > 0.5) {
            rightSideIndicators += 1;
        }

        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        
        if (leftHip?.visibility > 0.5 && rightHip?.visibility > 0.5) {
            const hipDistance = Math.abs(leftHip.x - rightHip.x);
            if (hipDistance < 0.06) {
                // Determine which side based on visibility and position
                if (leftHip.visibility > rightHip.visibility) {
                    leftSideIndicators += 1;
                } else if (rightHip.visibility > leftHip.visibility) {
                    rightSideIndicators += 1;
                } else {
                    // If visibility is equal, use x position
                    if (leftHip.x < rightHip.x) {
                        leftSideIndicators += 1;
                    } else {
                        rightSideIndicators += 1;
                    }
                }
            } else if (hipDistance > 0.15) {
                frontIndicators += 1;
            }
        } else if (leftHip?.visibility > 0.5) {
            leftSideIndicators += 1;
        } else if (rightHip?.visibility > 0.5) {
            rightSideIndicators += 1;
        }

        const totalSideIndicators = leftSideIndicators + rightSideIndicators;
        console.log("total side indicators: " + totalSideIndicators);
        console.log("front indicators: " + frontIndicators);
        if (totalSideIndicators + frontIndicators === 0) {
            return 'unknown';
        }
        
        if (totalSideIndicators > frontIndicators) {
            // Determine if it's left side or right side
            if (leftSideIndicators > rightSideIndicators) {
                return 'left-side';
            } else if (rightSideIndicators > leftSideIndicators) {
                return 'right-side';
            } else {
                return 'unknown';
            }
        } else if (frontIndicators > totalSideIndicators) {
            return 'front';
        } else {
            return 'unclear';
        }
    }
}