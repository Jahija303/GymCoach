import { Exercise } from './exercise.js';
import { LandmarkReader, LANDMARK } from '../util/landmark_reader.js';

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

const VALID_HIP_ANGLES_FRONT = {
    standing: {
        start: 175,
        end: 180       // Nearly straight, minimal forward lean visible from front
    },
    quarterSquat: {
        start: 160,
        end: 175       // Slight hip hinge, less pronounced from front view
    },
    halfSquat: {
        start: 145,
        end: 160       // Moderate hip flexion, visible torso lean forward
    },
    deepSquat: {
        start: 125,
        end: 145       // Significant hip flexion, noticeable forward lean
    },
    bottomPosition: {
        start: 110,
        end: 125       // Maximum hip flexion, pronounced forward torso angle
    }
};

const VALID_LEG_ANGLES_FRONT = {
    standing: {
        start: 175,
        end: 180       // Nearly straight legs from frontal view
    },
    quarterSquat: {
        start: 155,
        end: 175       // Slight knee bend, less visible from front
    },
    halfSquat: {
        start: 135,
        end: 155       // Moderate knee flexion, thighs approaching parallel
    },
    deepSquat: {
        start: 110,
        end: 135       // Significant knee bend, below parallel
    },
    bottomPosition: {
        start: 90,
        end: 110       // Maximum knee flexion, deep squat position
    }
};

export class Squat extends Exercise {
    constructor() {
        super();
        this.currentSquatState = null;
    }

    validate(results) {
        if (results.landmarks && results.landmarks.length > 0) {
            const reader = new LandmarkReader(results);

            const leftHip = reader.getLandmark(LANDMARK.LEFT_HIP);
            const leftKnee = reader.getLandmark(LANDMARK.LEFT_KNEE);
            const leftAnkle = reader.getLandmark(LANDMARK.LEFT_ANKLE);
            const leftShoulder = reader.getLandmark(LANDMARK.LEFT_SHOULDER);

            const rightHip = reader.getLandmark(LANDMARK.RIGHT_HIP);
            const rightKnee = reader.getLandmark(LANDMARK.RIGHT_KNEE);
            const rightAnkle = reader.getLandmark(LANDMARK.RIGHT_ANKLE);
            const rightShoulder = reader.getLandmark(LANDMARK.RIGHT_SHOULDER);

            const leftLegAngle = this.calculateAngle3D(leftHip, leftKnee, leftAnkle);
            const rightLegAngle = this.calculateAngle3D(rightHip, rightKnee, rightAnkle);
            const leftHipAngle = this.calculateAngle3D(leftShoulder, leftHip, leftKnee);
            const rightHipAngle = this.calculateAngle3D(rightShoulder, rightHip, rightKnee);

            const poseData = document.getElementById('pose-data');
            poseData.textContent = `Left Leg: ${leftLegAngle}, Right Leg: ${rightLegAngle}, Left Hip: ${leftHipAngle}, Right Hip: ${rightHipAngle}`;
            console.log("body rotation " + this.calculate3DBodyRotation(reader).rotation);

            // this.validateSideSquatForm(leftLegAngle, leftHipAngle);
        }
    }

    determineAngleState(angle, validAngles) {
        for (const [stateName, range] of Object.entries(validAngles)) {
            if (angle >= range.start && angle <= range.end) {
                return stateName;
            }
        }
        return 'unknown';
    }

    validateSideSquatForm(legAngle, hipAngle) {
        const legState = this.determineAngleState(legAngle, VALID_LEG_ANGLES_SIDE);
        const hipState = this.determineAngleState(hipAngle, VALID_HIP_ANGLES_SIDE);

        this.currentSquatState = legState === hipState ? legState : 'transition';
        if (typeof this.exerciseStatus !== 'undefined') {
            this.exerciseStatus.className = `status exercise-status ${this.currentSquatState}`;
            this.exerciseStatus.textContent = this.currentSquatState;
        }
    }

    validateFrontSquatForm(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle) {
        // TODO
    }
}