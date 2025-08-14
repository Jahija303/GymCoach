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

        const shoulderMidpointX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderMidpointY = (leftShoulder.y + rightShoulder.y) / 2;
        const hipMidpointX = (leftHip.x + rightHip.x) / 2;
        const hipMidpointY = (leftHip.y + rightHip.y) / 2;
        
        this.bodyScaleRef = Math.sqrt(
            (shoulderMidpointX - hipMidpointX) ** 2 + 
            (shoulderMidpointY - hipMidpointY) ** 2
        );
    }

    calculate3DBodyRotation() {
        if (!this.shoulderDistanceRef || !this.hipDistanceRef || !this.bodyScaleRef) {
                return 0; // No reference data available
            }

            // Get current landmark positions
            const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
            const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
            const leftHip = this.reader.getLandmark(LANDMARK.LEFT_HIP);
            const rightHip = this.reader.getLandmark(LANDMARK.RIGHT_HIP);
                
            if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
                return 0; // Missing landmarks
            }

            // Calculate current distances
            const currentShoulderDistance = Math.sqrt(
                (rightShoulder.x - leftShoulder.x) ** 2 + 
                (rightShoulder.y - leftShoulder.y) ** 2
            );
            const currentHipDistance = Math.sqrt(
                (rightHip.x - leftHip.x) ** 2 + 
                (rightHip.y - leftHip.y) ** 2
            );

            // Calculate body scale (distance between midpoints)
            const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
            const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
            const hipMidX = (leftHip.x + rightHip.x) / 2;
            const hipMidY = (leftHip.y + rightHip.y) / 2;
            
            const currentBodyScale = Math.sqrt(
                (shoulderMidX - hipMidX) ** 2 + 
                (shoulderMidY - hipMidY) ** 2
            );

            // SCALE NORMALIZATION: Adjust distances based on body scale change
            const scaleRatio = currentBodyScale / this.bodyScaleRef;
            
            // What the shoulder/hip distances SHOULD be if only scale changed (no rotation)
            const expectedShoulderDistance = this.shoulderDistanceRef * scaleRatio;
            const expectedHipDistance = this.hipDistanceRef * scaleRatio;
            
            // Calculate compression ratios AFTER removing scale effects
            const shoulderCompressionRatio = currentShoulderDistance / expectedShoulderDistance;
            const hipCompressionRatio = currentHipDistance / expectedHipDistance;
            
            // Use the average of both ratios for stability, but weight shoulders more
            const avgCompressionRatio = (shoulderCompressionRatio * 0.6 + hipCompressionRatio * 0.4);
            
            // Clamp to valid range for acos (allow for measurement noise)
            const clampedRatio = Math.max(0.05, Math.min(1.0, avgCompressionRatio));
            
            // Convert to rotation angle
            const rotationRadians = Math.acos(clampedRatio);
            let rotationDegrees = rotationRadians * (180 / Math.PI);
            
            // IMPROVED LEFT/RIGHT DIRECTION DETECTION
            // Method: Use the body axis orientation
            
            // Calculate body axis vector (from hip midpoint to shoulder midpoint)
            const bodyAxisX = shoulderMidX - hipMidX;
            const bodyAxisY = shoulderMidY - hipMidY;
            
            // Calculate shoulder vector (from left to right shoulder)
            const shoulderVectorX = rightShoulder.x - leftShoulder.x;
            const shoulderVectorY = rightShoulder.y - leftShoulder.y;
            
            // Calculate hip vector (from left to right hip)
            const hipVectorX = rightHip.x - leftHip.x;
            const hipVectorY = rightHip.y - leftHip.y;
            
            // Cross product to determine orientation (2D cross product = z component of 3D cross)
            // Positive = counter-clockwise rotation = left turn
            // Negative = clockwise rotation = right turn
            const shoulderCross = bodyAxisX * shoulderVectorY - bodyAxisY * shoulderVectorX;
            const hipCross = bodyAxisX * hipVectorY - bodyAxisY * hipVectorX;
            
            // Average the cross products for stability
            const avgCross = (shoulderCross + hipCross) / 2;
            
            // Determine rotation direction
            // If body is rotated, the cross product will deviate from the reference
            let rotationSign = 1;
            
            // Only apply rotation if there's significant compression (avoid noise when facing camera)
            if (avgCompressionRatio < 0.95) {  // Only when there's actual rotation
                // Additional method: Check relative positions
                // When turning right: left landmarks move toward center more than right landmarks
                // When turning left: right landmarks move toward center more than left landmarks
                
                const leftShoulderRelX = leftShoulder.x - shoulderMidX;
                const rightShoulderRelX = rightShoulder.x - shoulderMidX;
                const leftHipRelX = leftHip.x - hipMidX;
                const rightHipRelX = rightHip.x - hipMidX;
                
                // Calculate how much each side has moved toward the center
                const leftSideCompression = Math.abs(leftShoulderRelX) + Math.abs(leftHipRelX);
                const rightSideCompression = Math.abs(rightShoulderRelX) + Math.abs(rightHipRelX);
                
                // If left side is more compressed, person is turning right (left side goes toward back)
                // If right side is more compressed, person is turning left (right side goes toward back)
                const compressionDiff = leftSideCompression - rightSideCompression;
                
                if (Math.abs(compressionDiff) > 0.01) {  // Threshold to avoid noise
                    rotationSign = compressionDiff < 0 ? 1 : -1;  // Left compressed = right turn (+)
                }
            } else {
                // If facing camera (little compression), return near zero
                rotationDegrees *= avgCompressionRatio;  // Scale down the angle
            }
            
            const finalRotation = rotationDegrees * rotationSign;
            
            return Math.round(finalRotation * 100) / 100;
    }


    calculateAngle3D(point1, vertex, point2, limb1Length, limb2Length, bodyRotation) {
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