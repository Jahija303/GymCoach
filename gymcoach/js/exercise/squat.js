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
            super.normalizeKeypoints(results); // Instantiate a reader with normalized keypoints

            const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
            const leftHip = this.reader.getLandmark(LANDMARK.LEFT_HIP);
            const leftKnee = this.reader.getLandmark(LANDMARK.LEFT_KNEE);
            const leftAnkle = this.reader.getLandmark(LANDMARK.LEFT_ANKLE);
            
            const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
            const rightHip = this.reader.getLandmark(LANDMARK.RIGHT_HIP);
            const rightKnee = this.reader.getLandmark(LANDMARK.RIGHT_KNEE);
            const rightAnkle = this.reader.getLandmark(LANDMARK.RIGHT_ANKLE);

            const leftLegAngle = this.calculateAngle3D(leftHip, leftKnee, leftAnkle);
            const rightLegAngle = this.calculateAngle3D(rightHip, rightKnee, rightAnkle);
            const leftHipAngle = this.calculateAngle3D(leftShoulder, leftHip, leftKnee);
            const rightHipAngle = this.calculateAngle3D(rightShoulder, rightHip, rightKnee);
    
            // validate front squat and side squat
            // when do we have front squat?
            const rotation = Math.abs(this.calculate3DBodyRotation(this.reader).rotation);
            if (rotation >= 130 && rotation <= 185) {
                console.log("Front squat detected");
                this.validateFrontSquatForm(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle);
            } else if (rotation >= 75 && rotation <= 110) {
                console.log("Side squat detected");
                this.validateSideSquatForm(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle);
            }
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
        console.log("new squat state " + newSquatState);
        
        this.currentSquatState = newSquatState;
        
        if (typeof this.exerciseStatus !== 'undefined') {
            this.exerciseStatus.className = `status exercise-status ${this.currentSquatState}`;
            this.exerciseStatus.textContent = this.currentSquatState;
        }   
    }
    
    validateFrontSquatForm(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle) {
        this.poseData.textContent = `Left Leg: ${leftLegAngle?.toFixed(2)}, Left Hip: ${leftHipAngle?.toFixed(2)}, Right Leg: ${rightLegAngle?.toFixed(2)}, Right Hip: ${rightHipAngle?.toFixed(2)}`;
    }
}