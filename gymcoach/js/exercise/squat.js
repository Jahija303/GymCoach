import { Exercise } from './exercise.js';

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
            const legAnglesResult = this.legAngles(results);
            const leftLegAngle = legAnglesResult.leftLegAngle;
            const rightLegAngle = legAnglesResult.rightLegAngle;
            const hipAnglesResult = this.hipAngles(results);
            const leftHipAngle = hipAnglesResult.leftHipAngle;
            const rightHipAngle = hipAnglesResult.rightHipAngle;

            switch (this.userDirection(results)) {
            case 'left-side':
                console.log('Left side view detected');
                this.validateSideSquatForm(leftLegAngle, leftHipAngle);
                break;
            case 'right-side':
                console.log('Right side view detected');
                this.validateSideSquatForm(rightLegAngle, rightHipAngle);
                break;
            case 'front':
                console.log('Front view detected');
                this.validateFrontSquat(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle);
                break;
            case 'unknown':
                console.log('Unknown view detected');
            }
        }
    }

    validateSideSquatForm(legAngle, hipAngle) {
        const legState = this.determineAngleState(legAngle, VALID_LEG_ANGLES_SIDE);
        const hipState = this.determineAngleState(hipAngle, VALID_HIP_ANGLES_SIDE);

        console.log("======")
        console.log(legState, hipState);
        this.currentSquatState = legState === hipState ? legState : 'transition';
        if (typeof this.exerciseStatus !== 'undefined') {
            this.exerciseStatus.className = `status exercise-status ${this.currentSquatState}`;
            this.exerciseStatus.textContent = this.currentSquatState.charAt(0).toUpperCase() + this.currentSquatState.slice(1);
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

    validateFrontSquat(){
        // TODO
    }
}