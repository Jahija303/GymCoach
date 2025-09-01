import { Exercise } from './exercise.js';
import { LANDMARK } from '../util/landmark_reader.js';

const VALID_HIP_ANGLES_SIDE = {
    standing: [165, 180],       // Nearly straight hip (slight forward lean is normal)
    quarterSquat: [140, 165],   // Slight hip hinge, minimal flexion
    halfSquat: [110, 140],      // Moderate hip flexion, thighs approaching parallel
    deepSquat: [85, 110],       // Significant hip flexion, below parallel
    bottomPosition: [70, 85]    // Deep squat bottom, maximum hip flexion
};

const VALID_LEG_ANGLES_SIDE = {
    standing: [170, 180],       // Nearly straight legs
    quarterSquat: [145, 170],   // Slight knee bend
    halfSquat: [120, 145],      // Moderate knee flexion, thighs parallel to ground
    deepSquat: [90, 120],       // Significant knee bend, below parallel
    bottomPosition: [70, 90]    // Maximum knee flexion at bottom
};
export class Squat extends Exercise {
    constructor() {
        super();
        this.currentSquatState = null;
        this.squatPhases = [];
        this.repCounter = 0;
        this.angleHistory = {
            leftLeg: [],
            rightLeg: [],
            leftHip: [],
            rightHip: []
        };
        this.startTime = Date.now();
        this.initializeAngleGraph();
    }

    initializeAngleGraph() {
        // Create the graph container
        const graphContainer = document.getElementById('angle-graph-container');

        // Create canvas for the graph
        this.graphCanvas = document.getElementById('angle-graph-canvas');
        this.graphCanvas.width = 768;  // Match CSS video width
        this.graphCanvas.height = 432; // Match CSS video height
        this.graphCtx = this.graphCanvas.getContext('2d');
        this.graphSettings = {
            maxTime: 30000, // 30 seconds
            maxAngle: 180,
            minAngle: 70,
            colors: {
                leftLeg: '#FF6B6B',
                rightLeg: '#4ECDC4',
                leftHip: '#45B7D1',
                rightHip: '#96CEB4'
            }
        };

        this.drawGraphBackground();
    }

    drawGraphBackground() {
        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;

        // Vertical lines (time)
        for (let i = 0; i <= 10; i++) {
            const x = (i / 10) * canvas.width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        // Horizontal lines (angles)
        for (let i = 0; i <= 10; i++) {
            const y = (i / 10) * canvas.height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText('180°', 5, 15);
        ctx.fillText('70°', 5, canvas.height - 5);
        ctx.fillText('30s', canvas.width - 30, canvas.height - 5);
        
        // Draw legend
        const legend = [
            { name: 'L Leg', color: this.graphSettings.colors.leftLeg },
            { name: 'R Leg', color: this.graphSettings.colors.rightLeg },
            { name: 'L Hip', color: this.graphSettings.colors.leftHip },
            { name: 'R Hip', color: this.graphSettings.colors.rightHip }
        ];
        
        legend.forEach((item, index) => {
            const y = 20 + (index * 20);
            ctx.fillStyle = item.color;
            ctx.fillRect(canvas.width - 80, y, 15, 10);
            ctx.fillStyle = '#fff';
            ctx.fillText(item.name, canvas.width - 60, y + 8);
        });
    }

    updateAngleGraph(angles) {
        const currentTime = Date.now() - this.startTime;
        
        // Add new data points
        this.angleHistory.leftLeg.push({ time: currentTime, angle: angles.leftLeg });
        this.angleHistory.rightLeg.push({ time: currentTime, angle: angles.rightLeg });
        this.angleHistory.leftHip.push({ time: currentTime, angle: angles.leftHip });
        this.angleHistory.rightHip.push({ time: currentTime, angle: angles.rightHip });
        
        // Remove old data points (keep last 30 seconds)
        Object.keys(this.angleHistory).forEach(key => {
            this.angleHistory[key] = this.angleHistory[key].filter(
                point => currentTime - point.time <= this.graphSettings.maxTime
            );
        });
        
        this.drawGraph();
    }

    drawGraph() {
        this.drawGraphBackground();
        
        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        const currentTime = Date.now() - this.startTime;
        
        Object.keys(this.angleHistory).forEach(angleType => {
            const data = this.angleHistory[angleType];
            if (data.length < 2) return;
            
            ctx.strokeStyle = this.graphSettings.colors[angleType];
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            data.forEach((point, index) => {
                const x = ((currentTime - point.time) / this.graphSettings.maxTime) * canvas.width;
                const y = canvas.height - ((point.angle - this.graphSettings.minAngle) / 
                         (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;
                
                const adjustedX = canvas.width - x; // Reverse x to show newest data on right
                
                if (index === 0) {
                    ctx.moveTo(adjustedX, y);
                } else {
                    ctx.lineTo(adjustedX, y);
                }
            });
            
            ctx.stroke();
        });
    }

    validate(results) {
        if (results.landmarks && results.landmarks.length > 0) {
            const normalizedKeypoints = this.normalizeKeypointsZ(results?.landmarks[0]);
            this.reader.setLandmarks(normalizedKeypoints);
        } else {
            return;
        }

        // if (this.bodyDimensions == null){
        //     super.calibrateBodyDimensions();
        //     return;
        // }

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

        // Output current joint angles
        const currentAngles = {
            leftLeg: leftLegAngle || 0,
            rightLeg: rightLegAngle || 0,
            leftHip: leftHipAngle || 0,
            rightHip: rightHipAngle || 0
        };

        // Update the graph with current angles
        this.updateAngleGraph(currentAngles);

        // Display angles in the exercise status
        this.exerciseStatus.textContent = `L Leg: ${currentAngles.leftLeg.toFixed(1)}° | R Leg: ${currentAngles.rightLeg.toFixed(1)}° | L Hip: ${currentAngles.leftHip.toFixed(1)}° | R Hip: ${currentAngles.rightHip.toFixed(1)}°`;
        this.exerciseStatus.className = "status exercise-status";

        // Keep the existing rotation detection for different exercise modes
        const rotation = Math.abs(this.calculate3DBodyRotation().rotation);
        if (rotation >= 130 && rotation <= 185) {
            this.validateFrontSquatForm(leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle);
        } else if (rotation >= 75 && rotation <= 110) {
            this.validateSideSquatForm(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle);
        }
    }

    validateSideSquatForm(leftLegAngle, leftHipAngle, rightLegAngle, rightHipAngle) {
        if (leftLegAngle && leftHipAngle) {
            this.sideSquatStatus(leftLegAngle, leftHipAngle);
        } else if (rightLegAngle && rightHipAngle) {
            this.sideSquatStatus(rightLegAngle, rightHipAngle);
        } else {
            // console.log("Insufficient data to validate side squat form.");
            return;
        }

        const leftKnee = this.reader.getLandmark(LANDMARK.LEFT_KNEE);
        const leftAnkle = this.reader.getLandmark(LANDMARK.LEFT_ANKLE);
        const rightKnee = this.reader.getLandmark(LANDMARK.RIGHT_KNEE);
        const rightAnkle = this.reader.getLandmark(LANDMARK.RIGHT_ANKLE);

        const minConfidence = 0.6;
        if ((leftKnee.visibility < minConfidence || leftAnkle.visibility < minConfidence) && (rightKnee.visibility < minConfidence || rightAnkle.visibility < minConfidence)) {
            return;
        }

        const issues = [];
        const forwardThreshold = 0.07;
        
        const leftKneeForward = Math.abs(leftKnee.x - leftAnkle.x);
        const rightKneeForward = Math.abs(rightKnee.x - rightAnkle.x);
        
        if (leftKneeForward > forwardThreshold) {
            issues.push("Left knee too far forward");
        }
        
        if (rightKneeForward > forwardThreshold) {
            issues.push("Right knee too far forward");
        }

        if (issues.length > 0) {
            const updatedStatus = issues.length === 1 ? issues[0] : "Knees too far forward";
            
            this.exerciseStatus.textContent = updatedStatus;
            this.exerciseStatus.className = "status exercise-status warning";
        }
    }

    determineAngleState(angle, validAngles) {
        for (const [stateName, range] of Object.entries(validAngles)) {
            if (angle >= range[0] && angle <= range[1]) {
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

        if (this.currentSquatState == "standing" || this.currentSquatState == "bottomPosition") {
            // console.log("standing or bottomPosition");
            if (this.squatPhases.length > 1) {
                // console.log("squat phases length > 1")
                if(this.squatPhases[0] === "standing" && this.squatPhases[1] === "bottomPosition" && this.currentSquatState == this.squatPhases[0]) {
                    // console.log("Rep completed");
                    this.repCounter+=1;
                    this.repCounterElement.textContent = this.repCounter;
                }
            }
            if (this.squatPhases[this.squatPhases.length - 1] !== this.currentSquatState) {
                this.squatPhases.push(this.currentSquatState);
            }

            // console.log("squat phases" + this.squatPhases);
            if (this.squatPhases.length > 2) {
                this.squatPhases.shift(); // Keep only the last 2 states
                // console.log("Keep only last two " + this.squatPhases);
            }
        }
    }

    validateFrontSquatForm(leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle) {
        const leftLegAngle = this.calculateAngle2D(leftHip, leftKnee, leftAnkle);
        const rightLegAngle = this.calculateAngle2D(rightHip, rightKnee, rightAnkle);

        if (leftLegAngle > 165 && rightLegAngle > 165) {
            this.exerciseStatus.textContent = "Standing";
            this.exerciseStatus.className = "status exercise-status standing";
            return;
        } 

        const minConfidence = 0.6;
        const joints = [leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle];
        const validPose = joints.every(joint => joint && joint.visibility > minConfidence);
        
        if (!validPose) {
            this.poseData.textContent = "Unable to analyze - adjust camera position";
            return;
        }

        const issues = [];
        const leftKneeX = leftKnee.x;
        const leftHipX = leftHip.x;
        const leftAnkleX = leftAnkle.x;
        const rightKneeX = rightKnee.x;
        const rightHipX = rightHip.x;
        const rightAnkleX = rightAnkle.x;
        
        const leftMidpointX = (leftHipX + leftAnkleX) / 2;
        const rightMidpointX = (rightHipX + rightAnkleX) / 2;
        const leftKneeDeviation = Math.abs((leftKneeX - leftMidpointX).toFixed(3));
        const rightKneeDeviation = Math.abs((rightKneeX - rightMidpointX).toFixed(3));

        const inwardThreshold = 0.015;
        const outwardThreshold = 0.045;

        if (leftKneeDeviation < inwardThreshold) {
            issues.push("Left knee caving inward");
        } else if (leftKneeDeviation > outwardThreshold) {
            issues.push("Left knee caving outward");
        }

        if (rightKneeDeviation < inwardThreshold) {
            issues.push("Right knee caving inward");
        } else if (rightKneeDeviation > outwardThreshold) {
            issues.push("Right knee caving outward");
        }

        const kneeAsymmetry = Math.abs(leftKneeDeviation - rightKneeDeviation);
        const symmetryThreshold = 0.015;
        if (kneeAsymmetry > symmetryThreshold) {
            issues.push("Uneven knee positioning");
        }

        const leftDepthGood = leftHip.y > leftKnee.y;
        const rightDepthGood = rightHip.y > rightKnee.y;
        
        if (!leftDepthGood || !rightDepthGood) {
            issues.push("Squat deeper - hips should go below knees");
        }
        
        let overallStatus, statusClass;
        
        if (issues.length === 0) {
            overallStatus = "Excellent squat form!";
            statusClass = "good";
        } else if (issues.length <= 2) {
            overallStatus = `Bad form: ${issues.join(", ")}`;
            statusClass = "warning";
        } else {
            overallStatus = `Form needs work: ${issues.slice(0, 2).join(", ")}`;
            statusClass = "error";
        }

        // DEBUG
        this.poseData.textContent = `L Knee Dev: ${leftKneeDeviation.toFixed(3)} | R Knee Dev: ${rightKneeDeviation.toFixed(3)}`;

        // Display info in the UI
        this.exerciseStatus.className = `status exercise-status ${statusClass}`;
        this.exerciseStatus.textContent = overallStatus;
    }
}