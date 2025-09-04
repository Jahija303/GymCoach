import { Exercise } from './exercise.js';
import { LANDMARK } from '../util/landmark_reader.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../util/pose.js';

const PROPER_SQUAT_FORM_HIP_ANGLES = {
    centerAngle: 110,
    amplitude: 60
}

const PROPER_SQUAT_FORM_KNEE_ANGLES = {
    centerAngle: 120,
    amplitude: 50
};

export class Squat extends Exercise {
    constructor() {
        super();
        this.currentSquatState = null;
        this.squatPhases = [];
        this.repCounter = 0;
        this.angleHistory = {
            leg: [],
            hip: []
        };
        this.startTime = Date.now();
        this.movementStartTime = null;
        this.movementEndTime = null;
        this.isMovementActive = false;
        this.baselineAngles = { hip: null, leg: null };
        this.movementAngleHistory = {
            leg: [],
            hip: []
        };
        this.differenceAreas = {
            leg: [],
            hip: []
        };
        this.currentMovementId = 0;
        this.lastMovementDuration = null;
        this.tempoWarningShown = false;
        this.AREA_DRAWING_DELAY = 500; // Continue drawing area for 0.5 seconds after movement stops
        this.MIN_SQUAT_DURATION = 2000; // Minimum squat duration to count as a rep (2 second)
        this.MAX_SQUAT_DURATION = 4000; // Maximum squat duration to count as a rep (4 seconds)
        this.STANDING_HIP_RANGE = [170, 180];
        this.STANDING_LEG_RANGE = [170, 180];
        this.MOVEMENT_START_THRESHOLD = 10; // degrees below standing position
        this.MOVEMENT_END_THRESHOLD = 10;    // degrees from baseline to consider "returned"
        this.IDEAL_MOVEMENT_DURATION = 3000; // 3 seconds in milliseconds

        this.movementStatusElement = document.getElementById('movement-status');
        this.formScoreElement = document.getElementById('form-score');
        this.tempoStatusElement = document.getElementById('tempo-status');

        this.initializeAngleGraph();
    }

    initializeAngleGraph() {
        this.graphCanvas = document.getElementById('angle-graph-canvas');
        this.graphCanvas.width = CANVAS_WIDTH;
        this.graphCanvas.height = CANVAS_HEIGHT;
        this.graphCtx = this.graphCanvas.getContext('2d');
        this.graphSettings = {
            maxTime: 3000, // 3 seconds
            maxAngle: 180,
            minAngle: 40,
            colors: {
                leg: '#FF6B6B',
                hip: '#4ECDC4'
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
        ctx.fillText('40°', 5, canvas.height - 5);
        ctx.fillText('3s', canvas.width - 30, canvas.height - 5);

        const legend = [
            { name: 'Leg', color: this.graphSettings.colors.leg },
            { name: 'Hip', color: this.graphSettings.colors.hip }
        ];

        legend.forEach((item, index) => {
            const y = 20 + (index * 20);
            ctx.fillStyle = item.color;
            ctx.fillRect(canvas.width - 120, y, 15, 10);
            ctx.fillStyle = '#fff';
            ctx.fillText(item.name, canvas.width - 100, y + 8);
        });
    }

    updateAngleGraph(angles) {
        const currentTime = Date.now() - this.startTime;

        const leftSide = {
            leg: angles.leftLeg,
            hip: angles.leftHip,
            confidence: this.getLeftSideConfidence()
        };

        const rightSide = {
            leg: angles.rightLeg,
            hip: angles.rightHip,
            confidence: this.getRightSideConfidence()
        };

        const selectedSide = leftSide.confidence >= rightSide.confidence ? leftSide : rightSide;
        const currentAngles = {
            hip: selectedSide.hip,
            leg: selectedSide.leg
        };

        this.detectMovementStart(currentAngles);
        this.detectMovementEnd(currentAngles);

        this.angleHistory.leg.push({ time: currentTime, angle: selectedSide.leg });
        this.angleHistory.hip.push({ time: currentTime, angle: selectedSide.hip });

        if (this.isMovementActive) {
            this.movementAngleHistory.leg.push({ time: currentTime, angle: selectedSide.leg });
            this.movementAngleHistory.hip.push({ time: currentTime, angle: selectedSide.hip });
            
            const idealDuration = (this.MIN_SQUAT_DURATION + this.MAX_SQUAT_DURATION) / 2;
            const relativeTime = (currentTime - this.movementStartTime) / 1000;
            
            ['leg', 'hip'].forEach(angleType => {
                const templateAngles = angleType === 'hip' ? 
                    PROPER_SQUAT_FORM_HIP_ANGLES : 
                    PROPER_SQUAT_FORM_KNEE_ANGLES;
                
                const userAngle = angleType === 'hip' ? selectedSide.hip : selectedSide.leg;
                const idealAngle = this.getAngleAsymmetricSin(
                    relativeTime, 
                    idealDuration / 1000, 
                    templateAngles.centerAngle, 
                    templateAngles.amplitude
                );
                
                this.differenceAreas[angleType].push({
                    time: currentTime,
                    userAngle: userAngle,
                    idealAngle: idealAngle,
                    movementId: this.currentMovementId
                });
            });
        }

        Object.keys(this.angleHistory).forEach(key => {
            this.angleHistory[key] = this.angleHistory[key].filter(
                point => currentTime - point.time <= this.graphSettings.maxTime
            );
        });

        Object.keys(this.differenceAreas).forEach(key => {
            this.differenceAreas[key] = this.differenceAreas[key].filter(
                point => currentTime - point.time <= this.graphSettings.maxTime
            );
        });
        
        this.drawGraph();
    }

    getLeftSideConfidence() {
        const leftShoulder = this.reader.getLandmark(LANDMARK.LEFT_SHOULDER);
        const leftHip = this.reader.getLandmark(LANDMARK.LEFT_HIP);
        const leftKnee = this.reader.getLandmark(LANDMARK.LEFT_KNEE);
        const leftAnkle = this.reader.getLandmark(LANDMARK.LEFT_ANKLE);
        
        return (leftShoulder?.visibility + leftHip?.visibility + leftKnee?.visibility + leftAnkle?.visibility) / 4 || 0;
    }

    getRightSideConfidence() {
        const rightShoulder = this.reader.getLandmark(LANDMARK.RIGHT_SHOULDER);
        const rightHip = this.reader.getLandmark(LANDMARK.RIGHT_HIP);
        const rightKnee = this.reader.getLandmark(LANDMARK.RIGHT_KNEE);
        const rightAnkle = this.reader.getLandmark(LANDMARK.RIGHT_ANKLE);
        
        return (rightShoulder?.visibility + rightHip?.visibility + rightKnee?.visibility + rightAnkle?.visibility) / 4 || 0;
    }

    detectMovementStart(currentAngles) {
        if (this.isMovementActive) return false;

        // Set baseline angles if not set (first time or after movement end)
        if (this.baselineAngles.hip === null || this.baselineAngles.leg === null) {
            if (this.isInStandingPosition(currentAngles)) {
                this.baselineAngles.hip = currentAngles.hip;
                this.baselineAngles.leg = currentAngles.leg;
            }
            return false;
        }

        // Check if angles have dropped significantly from baseline (movement started)
        const hipDrop = this.baselineAngles.hip - currentAngles.hip;
        const legDrop = this.baselineAngles.leg - currentAngles.leg;

        if (hipDrop >= this.MOVEMENT_START_THRESHOLD && legDrop >= this.MOVEMENT_START_THRESHOLD) {
            this.movementStartTime = Date.now() - this.startTime; // Use relative time consistent with angle history
            this.isMovementActive = true;
            this.movementAngleHistory = { leg: [], hip: [] };
            this.tempoWarningShown = false;
            this.movementEndTime = null; // Reset when starting new movement
            this.currentMovementId++; // Increment movement ID for new session

            if (this.movementStatusElement) {
                this.movementStatusElement.textContent = "Active";
                this.movementStatusElement.className = "status-value active";
            }
            return true;
        }

        return false;
    }

    detectMovementEnd(currentAngles) {
        if (!this.isMovementActive) return false;

        const hipDiff = Math.abs(this.baselineAngles.hip - currentAngles.hip);
        const legDiff = Math.abs(this.baselineAngles.leg - currentAngles.leg);

        if (hipDiff <= this.MOVEMENT_END_THRESHOLD && legDiff <= this.MOVEMENT_END_THRESHOLD) {
            this.movementEndTime = Date.now() - this.startTime; // Use relative time consistent with angle history
            this.lastMovementDuration = this.movementEndTime - this.movementStartTime;
            this.isMovementActive = false;

            if (this.movementStatusElement) {
                this.movementStatusElement.textContent = "Complete";
                this.movementStatusElement.className = "status-value good";
            }

            // this.validateMovementTempo();
            // this.validateFormScore();

            this.baselineAngles.hip = null;
            this.baselineAngles.leg = null;
            this.movementAngleHistory = { leg: [], hip: [] };

            setTimeout(() => {
                if (this.movementStatusElement) {
                    this.movementStatusElement.textContent = "Ready";
                    this.movementStatusElement.className = "status-value";
                }
            }, 1000);

            return true;
        }

        return false;
    }

    isInStandingPosition(angles) {
        return (angles.hip >= this.STANDING_HIP_RANGE[0] && angles.hip <= this.STANDING_HIP_RANGE[1] &&
                angles.leg >= this.STANDING_LEG_RANGE[0] && angles.leg <= this.STANDING_LEG_RANGE[1]);
    }

    validateMovementTempo() {
        const seconds = (this.lastMovementDuration / 1000).toFixed(1);

        if (this.tempoStatusElement) {
            if (this.lastMovementDuration > this.IDEAL_MOVEMENT_DURATION) {
                this.tempoStatusElement.textContent = `${seconds}s (too slow)`;
                this.tempoStatusElement.className = "status-value warning";
            } else if (this.lastMovementDuration < this.IDEAL_MOVEMENT_DURATION * 0.8) {
                this.tempoStatusElement.textContent = `${seconds}s (too fast)`;
                this.tempoStatusElement.className = "status-value warning";
            } else {
                this.tempoStatusElement.textContent = `${seconds}s (good)`;
                this.tempoStatusElement.className = "status-value good";
            }
        }
    }

    // validateFormScore() {
    //     if (!this.movementAngleHistory.hip.length || !this.movementAngleHistory.leg.length) {
    //         return;
    //     }

    //     let totalHipError = 0;
    //     let totalLegError = 0;
    //     let hipSampleCount = 0;
    //     let legSampleCount = 0;

    //     // Calculate average error for hip angles
    //     this.movementAngleHistory.hip.forEach(point => {
    //         const relativeTime = (point.time - this.movementStartTime) / 1000; // Convert to seconds
    //         if (relativeTime >= 0 && relativeTime <= 3) { // Only within 3-second exercise window
    //             const idealHipAngle = this.interpolateTemplateAngle(PROPER_SQUAT_FORM_HIP_ANGLES, relativeTime);
    //             const error = Math.abs(point.angle - idealHipAngle);
    //             totalHipError += error;
    //             hipSampleCount++;
    //         }
    //     });

    //     // Calculate average error for leg angles
    //     this.movementAngleHistory.leg.forEach(point => {
    //         const relativeTime = (point.time - this.movementStartTime) / 1000; // Convert to seconds
    //         if (relativeTime >= 0 && relativeTime <= 3) { // Only within 3-second exercise window
    //             const idealLegAngle = this.interpolateTemplateAngle(PROPER_SQUAT_FORM_KNEE_ANGLES, relativeTime);
    //             const error = Math.abs(point.angle - idealLegAngle);
    //             totalLegError += error;
    //             legSampleCount++;
    //         }
    //     });

    //     if (hipSampleCount === 0 || legSampleCount === 0) {
    //         return;
    //     }

    //     // Calculate average errors
    //     const avgHipError = totalHipError / hipSampleCount;
    //     const avgLegError = totalLegError / legSampleCount;
    //     const avgTotalError = (avgHipError + avgLegError) / 2;

    //     // Convert error to score (0-100 scale, where lower error = higher score)
    //     // Assuming max reasonable error is 30 degrees
    //     const maxError = 30;
    //     const score = Math.max(0, Math.round(100 - (avgTotalError / maxError) * 100));

    //     // Update form score display
    //     if (this.formScoreElement) {
    //         this.formScoreElement.textContent = `${score}%`;
    //         if (score >= 80) {
    //             this.formScoreElement.className = "status-value good";
    //         } else if (score >= 60) {
    //             this.formScoreElement.className = "status-value warning";
    //         } else {
    //             this.formScoreElement.className = "status-value error";
    //         }
    //     }
    // }

    drawGraph() {
        this.drawGraphBackground();
        this.drawUserAngleLines();
        this.drawProgressiveIdealLines();
        this.drawDifferenceArea();
    }

    drawUserAngleLines() {
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

    drawProgressiveIdealLines() {
        if (!this.movementStartTime) return;

        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        const currentTime = Date.now() - this.startTime;
        const idealDuration = (this.MIN_SQUAT_DURATION + this.MAX_SQUAT_DURATION) / 2;

        // Only draw during movement or keep existing line after movement
        const endTime = this.movementEndTime || currentTime;
        const elapsedTime = Math.min(endTime - this.movementStartTime, idealDuration);
        
        ['hip', 'leg'].forEach(angleType => {
            const templateAngles = angleType === 'hip' ? 
                PROPER_SQUAT_FORM_HIP_ANGLES : 
                PROPER_SQUAT_FORM_KNEE_ANGLES;
            
            ctx.strokeStyle = this.graphSettings.colors[angleType];
            ctx.globalAlpha = 0.6; // Slight transparency
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // Dashed line
            ctx.beginPath();
            
            // Draw ideal line from movement start to current elapsed time
            for (let t = 0; t <= elapsedTime; t += 50) {
                const relativeTime = t / 1000; // Convert to seconds
                const idealAngle = this.getAngleAsymmetricSin(
                    relativeTime, 
                    idealDuration / 1000, 
                    templateAngles.centerAngle, 
                    templateAngles.amplitude
                );
                
                const timeFromStart = this.movementStartTime + t;
                const x = ((currentTime - timeFromStart) / this.graphSettings.maxTime) * canvas.width;
                const y = canvas.height - ((idealAngle - this.graphSettings.minAngle) / 
                        (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;
                
                const adjustedX = canvas.width - x; // Reverse x to show newest data on right
                
                if (t === 0) {
                    ctx.moveTo(adjustedX, y);
                } else {
                    ctx.lineTo(adjustedX, y);
                }
            }
            
            ctx.stroke();
            ctx.setLineDash([]); // Reset to solid line
            ctx.globalAlpha = 1.0; // Reset transparency
        });
    }

    drawDifferenceArea() {
        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        const currentTime = Date.now() - this.startTime;

        ['hip', 'leg'].forEach(angleType => {
            const data = this.differenceAreas[angleType];
            if (data.length < 2) return;

            // Group data points by movement ID to draw separate areas
            const movementGroups = {};
            data.forEach(point => {
                if (!movementGroups[point.movementId]) {
                    movementGroups[point.movementId] = [];
                }
                movementGroups[point.movementId].push(point);
            });

            // Draw each movement session as a separate area
            Object.keys(movementGroups).forEach(movementId => {
                const groupData = movementGroups[movementId];
                if (groupData.length < 2) return;

                ctx.fillStyle = this.graphSettings.colors[angleType];
                ctx.globalAlpha = 0.2; // Semi-transparent
                ctx.beginPath();

                // Draw the filled area between user line and ideal line for this movement
                groupData.forEach((point, index) => {
                    const x = ((currentTime - point.time) / this.graphSettings.maxTime) * canvas.width;
                    const adjustedX = canvas.width - x; // Reverse x to show newest data on right
                    
                    const userY = canvas.height - ((point.userAngle - this.graphSettings.minAngle) / 
                            (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;

                    if (index === 0) {
                        ctx.moveTo(adjustedX, userY);
                    } else {
                        ctx.lineTo(adjustedX, userY);
                    }
                });

                // Close the path by drawing back along the ideal line
                for (let i = groupData.length - 1; i >= 0; i--) {
                    const point = groupData[i];
                    const x = ((currentTime - point.time) / this.graphSettings.maxTime) * canvas.width;
                    const adjustedX = canvas.width - x;
                    const idealY = canvas.height - ((point.idealAngle - this.graphSettings.minAngle) / 
                            (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;
                    
                    ctx.lineTo(adjustedX, idealY);
                }

                ctx.closePath();
                ctx.fill();
            });

            ctx.globalAlpha = 1.0; // Reset transparency
        });
    }

    // interpolateTemplateAngle(templateAngles, targetTime) {
    //     const squatDuration = 3.0; // 3 seconds
        
    //     // Clamp targetTime to valid range
    //     const clampedTime = Math.max(0, Math.min(targetTime, squatDuration));
        
    //     // Use the asymmetric sin function to get the angle at the target time
    //     return this.getAngleAsymmetricSin(clampedTime, squatDuration, templateAngles.centerAngle, templateAngles.amplitude);
    // }

    validate(results) {
        if (results.landmarks && results.landmarks.length > 0) {
            const normalizedKeypoints = this.normalizeKeypointsZ(results?.landmarks[0]);
            this.reader.setLandmarks(normalizedKeypoints);
        } else {
            return;
        }

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
        
        const currentAngles = {
            leftLeg: leftLegAngle || 0,
            rightLeg: rightLegAngle || 0,
            leftHip: leftHipAngle || 0,
            rightHip: rightHipAngle || 0
        };

        // Skip processing if all angles are invalid (0)
        const hasValidLeftSide = currentAngles.leftLeg > 0 && currentAngles.leftHip > 0;
        const hasValidRightSide = currentAngles.rightLeg > 0 && currentAngles.rightHip > 0;
        
        if (!hasValidLeftSide && !hasValidRightSide) {
            return false;
        }

        this.updateAngleGraph(currentAngles);
    }
}