import { Exercise } from './exercise.js';
import { LANDMARK } from '../util/landmark_reader.js';

const VALID_HIP_ANGLES_SIDE = {
    standing: {
        start: 165,
        end: 180       // Nearly straight hip (slight forward lean is normal)
    },
    quarterSquat: {
        start: 140,
        end: 165       // Slight hip hinge, minimal flexion
    },
    halfSquat: {
        start: 110,
        end: 140       // Moderate hip flexion, thighs approaching parallel
    },
    deepSquat: {
        start: 85,
        end: 110       // Significant hip flexion, below parallel
    },
    bottomPosition: {
        start: 70,
        end: 85        // Deep squat bottom, maximum hip flexion
    }
};

const VALID_LEG_ANGLES_SIDE = {
    standing: {
        start: 170,
        end: 180       // Nearly straight legs
    },
    quarterSquat: {
        start: 145,
        end: 170       // Slight knee bend
    },
    halfSquat: {
        start: 120,
        end: 145       // Moderate knee flexion, thighs parallel to ground
    },
    deepSquat: {
        start: 90,
        end: 120       // Significant knee bend, below parallel
    },
    bottomPosition: {
        start: 70,
        end: 90        // Maximum knee flexion at bottom
    }
};
export class Squat extends Exercise {
    constructor() {
        super();
        this.currentSquatState = null;
    }

    validate(results) {
        if (results.landmarks && results.landmarks.length > 0) {
            const normalizedKeypoints = this.normalizeKeypointsZ(results?.landmarks[0]);
            this.reader.setLandmarks(normalizedKeypoints);
        } else {
            console.log("No landmarks detected");
            return;
        }

        if (this.bodyDimensions == null){
            super.calibrateBodyDimensions();
            return;
        }

        this.exerciseStatus.textContent = "Validating squat form...";
        this.exerciseStatus.className = "status exercise-status";

        const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const leftHip = this.reader.getLandmark(LANDMARK.LEFT_HIP);
        const leftKnee = this.reader.getLandmark(LANDMARK.LEFT_KNEE);
        const leftAnkle = this.reader.getLandmark(LANDMARK.LEFT_ANKLE);

        const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
        const rightHip = this.reader.getLandmark(LANDMARK.RIGHT_HIP);
        const rightKnee = this.reader.getLandmark(LANDMARK.RIGHT_KNEE);
        const rightAnkle = this.reader.getLandmark(LANDMARK.RIGHT_ANKLE);

        const leftLegAngle = this.calculateAngle2D(leftHip, leftKnee, leftAnkle);
        const rightLegAngle = this.calculateAngle2D(rightHip, rightKnee, rightAnkle);
        const leftHipAngle = this.calculateAngle2D(leftShoulder, leftHip, leftKnee);
        const rightHipAngle = this.calculateAngle2D(rightShoulder, rightHip, rightKnee);

        const rotation = Math.abs(this.calculate3DBodyRotation().rotation);
        if (rotation >= 130 && rotation <= 185) {
            console.log("Front squat detected");
            this.validateFrontSquatForm(leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle);
        } else if (rotation >= 75 && rotation <= 110) {
            console.log("Side squat detected");
            this.validateSideSquatForm(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle);
        }
    }

    validateSideSquatForm(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle) {
        if (leftLegAngle && leftHipAngle) {
            this.sideSquatStatus(leftLegAngle, leftHipAngle);
        } else if (rightLegAngle && rightHipAngle) {
            this.sideSquatStatus(rightLegAngle, rightHipAngle);
        } else {
            console.log("Insufficient data to validate side squat form.");
            return;
        }

        // what else do we want to validate?
        // is the person going too fast?
        // what should happen if the exercise status is unknown? does that mean that the person has incorrect form?
    }

    determineAngleState(angle, validAngles) {
        for (const [stateName, range] of Object.entries(validAngles)) {
            if (angle >= range.start && angle <= range.end) {
                return stateName;
            }
        }
        return 'unknown';
    }

    sideSquatStatus(legAngle, hipAngle) {
        const legState = this.determineAngleState(legAngle, VALID_LEG_ANGLES_SIDE);
        const hipState = this.determineAngleState(hipAngle, VALID_HIP_ANGLES_SIDE);

        const newSquatState = legState === hipState ? legState : 'transition';

        this.currentSquatState = newSquatState;
        
        if (typeof this.exerciseStatus !== 'undefined') {
            this.exerciseStatus.className = `status exercise-status ${this.currentSquatState}`;
            this.exerciseStatus.textContent = this.currentSquatState;
        }
    }

    validateFrontSquatForm(leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle) {
        // Confidence check for BlazePose keypoints
        const minConfidence = 0.6; // BlazePose typically has lower confidence scores
        const joints = [leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle];
        const validPose = joints.every(joint => joint && joint.visibility > minConfidence);
        
        if (!validPose) {
            console.log("Unable to analyze - adjust camera position", "warning");
            return;
        }

        const issues = [];
        
        // === IMPROVED KNEE ALIGNMENT ANALYSIS ===
        
        const leftKneeX = leftKnee.x;
        const leftHipX = leftHip.x;
        const leftAnkleX = leftAnkle.x;
        const rightKneeX = rightKnee.x;
        const rightHipX = rightHip.x;
        const rightAnkleX = rightAnkle.x;
        
        // Calculate knee deviation from ankle (more accurate than hip-ankle midpoint)
        const leftKneeDeviation = leftKneeX - leftAnkleX;
        const rightKneeDeviation = rightKneeX - rightAnkleX;
        
        // Dynamic threshold based on hip width (more reliable than shoulder width)
        const hipWidth = Math.abs(leftHipX - rightHipX);
        const deviationThreshold = Math.max(
            hipWidth * 0.2,  // 20% of hip width
            0.05  // Minimum threshold for narrow builds
        );
        
        // Check individual knee positions
        let kneeStatus = "Good knee alignment";
        
        if (Math.abs(leftKneeDeviation) > deviationThreshold) {
            if (leftKneeDeviation > deviationThreshold) {
                issues.push("Left knee caving inward");
            } else {
                issues.push("Left knee too far outward");
            }
        }
        
        if (Math.abs(rightKneeDeviation) > deviationThreshold) {
            if (rightKneeDeviation > deviationThreshold) {
                issues.push("Right knee caving inward");
            } else {
                issues.push("Right knee too far outward");
            }
        }
        
        // Check knee symmetry
        const kneeAsymmetry = Math.abs(leftKneeDeviation - rightKneeDeviation);
        const symmetryThreshold = deviationThreshold * 0.9;
        
        // if (kneeAsymmetry > symmetryThreshold) {
        //     issues.push("Uneven knee positioning");
        // }
        
        // === SQUAT DEPTH CHECK ===
        
        // Check if hips are below knees (proper squat depth)
        // const leftDepthGood = leftHip.y > leftKnee.y;
        // const rightDepthGood = rightHip.y > rightKnee.y;
        
        // if (!leftDepthGood || !rightDepthGood) {
        //     issues.push("Squat deeper - hips should go below knees");
        // }
        
        // === FORWARD LEAN CHECK ===
        
        // Check if knees are too far forward (knee should track over ankle)
        // const leftForwardLean = (leftKneeX - leftAnkleX) / hipWidth;
        // const rightForwardLean = (rightKneeX - rightAnkleX) / hipWidth;
        // const forwardLeanThreshold = 0.3; // 30% of hip width forward is acceptable
        
        // if (Math.abs(leftForwardLean) > forwardLeanThreshold || Math.abs(rightForwardLean) > forwardLeanThreshold) {
        //     if (leftForwardLean > forwardLeanThreshold || rightForwardLean > forwardLeanThreshold) {
        //         issues.push("Knees tracking too far forward");
        //     }
        // }
        
        // === DETERMINE OVERALL STATUS ===
        
        let overallStatus, statusClass;
        
        if (issues.length === 0) {
            overallStatus = "Excellent squat form!";
            statusClass = "good";
        } else if (issues.length <= 2) {
            overallStatus = `Good form: ${issues.join(", ")}`;
            statusClass = "warning";
        } else {
            overallStatus = `Form needs work: ${issues.slice(0, 2).join(", ")}`;
            statusClass = "error";
        }
        
        // === UPDATE UI ===
        
        // Enhanced debug information
        if (this.poseData) {
            this.poseData.textContent = `L Knee Dev: ${leftKneeDeviation.toFixed(3)} | R Knee Dev: ${rightKneeDeviation.toFixed(3)} | Asymmetry: ${kneeAsymmetry.toFixed(3)}`;
        }
        
        // Update exercise status with enhanced logic
        if (this.exerciseStatus) {
            this.exerciseStatus.className = `status exercise-status ${statusClass}`;
            this.exerciseStatus.textContent = overallStatus;
        }
    }

    // validateFrontSquatForm(leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle) {
    //     // Check knee positioning relative to hips and feet
    //     const leftKneeX = parseFloat(leftKnee.x.toFixed(2));
    //     const leftHipX = parseFloat(leftHip.x.toFixed(2));
    //     const leftAnkleX = parseFloat(leftAnkle.x.toFixed(2));

    //     const rightKneeX = parseFloat(rightKnee.x.toFixed(2));
    //     const rightHipX = parseFloat(rightHip.x.toFixed(2));
    //     const rightAnkleX = parseFloat(rightAnkle.x.toFixed(2));

    //     // Calculate how much the knee deviates from the line between hip and ankle
    //     const leftKneeDeviation = parseFloat((leftKneeX - ((leftHipX + leftAnkleX) / 2)).toFixed(2));
    //     const rightKneeDeviation = parseFloat((rightKneeX - ((rightHipX + rightAnkleX) / 2)).toFixed(2));

    //     this.poseData.textContent = `Left Knee X: ${leftKneeX}, Left Ankle X: ${leftAnkleX}, Left Knee Deviation: ${leftKneeDeviation}`;
    //     // Use body dimensions to normalize the deviation threshold
    //     const deviationThreshold = this.bodyDimensions.shoulderWidth * 0.1; // 10% of shoulder width

    //     let kneeStatus = "Good knee alignment";

    //     if (Math.abs(leftKneeDeviation) > deviationThreshold || Math.abs(rightKneeDeviation) > deviationThreshold) {
    //         if (leftKneeDeviation > deviationThreshold || rightKneeDeviation > deviationThreshold) {
    //             kneeStatus = "Knees too far inward";
    //         } else if (leftKneeDeviation < -deviationThreshold || rightKneeDeviation < -deviationThreshold) {
    //             kneeStatus = "Knees too far outward";
    //         }
    //     }

    //     // Update exercise status
    //     if (typeof this.exerciseStatus !== 'undefined') {
    //         if (kneeStatus === "Good knee alignment") {
    //             this.exerciseStatus.className = "status exercise-status good";
    //             this.exerciseStatus.textContent = kneeStatus;
    //         } else {
    //             this.exerciseStatus.className = "status exercise-status warning";
    //             this.exerciseStatus.textContent = kneeStatus;
    //         }
    //     }
    // }
}