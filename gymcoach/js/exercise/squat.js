import { Exercise } from './exercise.js';

export class Squat extends Exercise {
    constructor() {
        super();
        this.currentSquatState = null;
        this.LEG_SQUAT_THRESHOLD = 120;    // knee angle for squat detection
        this.HIP_SQUAT_THRESHOLD = 120;    // hip angle for squat detection
        this.LEG_STANDING_THRESHOLD = 160; // knee angle for standing
        this.HIP_STANDING_THRESHOLD = 160; // hip angle for standing
    }

    updateSquatState(legAngle, hipAngle) {
        const isSquatting = legAngle < this.LEG_SQUAT_THRESHOLD && hipAngle < this.HIP_SQUAT_THRESHOLD;
        const isStanding = legAngle > this.LEG_STANDING_THRESHOLD && hipAngle > this.HIP_STANDING_THRESHOLD;

        if (isSquatting) {
            this.currentSquatState = 'squat';
            if (typeof this.exerciseStatus !== 'undefined') {
                this.exerciseStatus.className = 'status exercise-status apex';
                this.exerciseStatus.textContent = `Squat`;
            }
        } else if (isStanding) {
            this.currentSquatState = 'standing';
            if (typeof this.exerciseStatus !== 'undefined') {
                this.exerciseStatus.className = 'status exercise-status start';
                this.exerciseStatus.textContent = `Standing`;
            }
        } else {
            if (typeof this.exerciseStatus !== 'undefined') {
                this.exerciseStatus.className = 'status exercise-status transition';
                this.exerciseStatus.textContent = `Transition`;
            }
        }
    }

    validate(results) {
        if (results.landmarks && results.landmarks.length > 0) {
            const legAnglesResult = this.legAngles(results);
            const leftLegAngle = legAnglesResult.leftLegAngle;
            const rightLegAngle = legAnglesResult.rightLegAngle;
            const hipAnglesResult = this.hipAngles(results);
            const leftHipAngle = hipAnglesResult.leftHipAngle;
            const rightHipAngle = hipAnglesResult.rightHipAngle;

            // we need to be confident that at least one side is visible before checking the form correctness
            if (leftLegAngle !== null && leftHipAngle !== null) {
                this.updateSquatState(leftLegAngle, leftHipAngle);
            }

            // if (rightLegAngle !== null && rightHipAngle !== null) {
            //     this.updateSquatState(rightLegAngle, rightHipAngle);
            // }
        }
    }
}