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

            console.log(this.userDirection(results));

            // we need to be confident that at least one side is visible before checking the form correctness
            switch (this.userDirection(results)) {
            case 'left-side':
                console.log('Left side view detected');
                //this.validateSideSquat(leftLegAngle, leftHipAngle);
                break;
            case 'right-side':
                console.log('Right side view detected');
                //this.validateSideSquat(rightLegAngle, rightHipAngle);
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

    validateSideSquat(legAngle, hipAngle) {
        this.updateSquatState(legAngle, hipAngle);
        
        // Validate squat form from side view
        let formFeedback = [];
        
        // Check if angles are valid (not null)
        if (legAngle === null || hipAngle === null) {
            console.log('Cannot validate squat - insufficient pose data');
            return;
        }
        
        // Form validation based on current squat state
        if (this.currentSquatState === 'squat') {
            // In squat position - check for proper depth and form
            
            // Check squat depth - knee angle should be well below threshold
            if (legAngle > this.LEG_SQUAT_THRESHOLD + 10) {
                formFeedback.push('Go deeper - squat not low enough');
            } else if (legAngle <= this.LEG_SQUAT_THRESHOLD) {
                formFeedback.push('Good squat depth!');
            }
            
            // Check hip hinge - hip angle should be appropriately flexed
            if (hipAngle > this.HIP_SQUAT_THRESHOLD + 15) {
                formFeedback.push('Bend more at the hips - push hips back');
            } else if (hipAngle <= this.HIP_SQUAT_THRESHOLD) {
                formFeedback.push('Good hip position!');
            }
            
            // Check for knee-hip coordination (both should be bent)
            if (Math.abs(legAngle - hipAngle) > 30) {
                formFeedback.push('Try to coordinate knee and hip movement');
            }
            
        } else if (this.currentSquatState === 'standing') {
            // In standing position - check for full extension
            
            if (legAngle < this.LEG_STANDING_THRESHOLD - 10) {
                formFeedback.push('Straighten your legs completely');
            } else if (legAngle >= this.LEG_STANDING_THRESHOLD) {
                formFeedback.push('Good standing position!');
            }
            
            if (hipAngle < this.HIP_STANDING_THRESHOLD - 10) {
                formFeedback.push('Stand up tall - extend hips fully');
            } else if (hipAngle >= this.HIP_STANDING_THRESHOLD) {
                formFeedback.push('Good upright posture!');
            }
            
        } else {
            // In transition - provide guidance
            if (legAngle > this.LEG_STANDING_THRESHOLD && hipAngle > this.HIP_STANDING_THRESHOLD) {
                formFeedback.push('Ready to squat - bend knees and hips');
            } else if (legAngle < this.LEG_SQUAT_THRESHOLD && hipAngle < this.HIP_SQUAT_THRESHOLD) {
                formFeedback.push('Ready to stand - push through heels');
            } else {
                formFeedback.push('Keep moving smoothly');
            }
        }
        
        // Log feedback for debugging
        if (formFeedback.length > 0) {
            console.log('Squat form feedback:', formFeedback.join(', '));
        }

        // You could also update UI elements here if needed
        // For example, display form feedback on screen
    }
    validateFrontSquat(){

    }
}