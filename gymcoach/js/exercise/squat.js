import { Exercise } from './exercise.js';
import { LANDMARK } from '../util/landmark_reader.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../util/pose.js';

const PROPER_SQUAT_FORM_HIP_ANGLES_IN_TIME = [
    { time: 0.0, angle: 178 },    // Standing position (165-180 range)
    { time: 0.2, angle: 172 },    // Start of descent
    { time: 0.4, angle: 160 },    // Early descent (quarterSquat: 140-165)
    { time: 0.6, angle: 150 },    // Quarter squat
    { time: 0.8, angle: 130 },    // Half squat (110-140 range)
    { time: 1.0, angle: 110 },    // Entering deep squat
    { time: 1.2, angle: 90 },     // Deep squat (85-110 range)
    { time: 1.4, angle: 75 },     // Bottom position (70-85 range)
    { time: 1.6, angle: 90 },     // Start ascent
    { time: 1.8, angle: 110 },    // Early ascent
    { time: 2.0, angle: 130 },    // Half way up
    { time: 2.2, angle: 150 },    // Quarter position
    { time: 2.4, angle: 160 },    // Near top
    { time: 2.6, angle: 172 },    // Almost standing
    { time: 2.8, angle: 178 },    // Return to standing
    { time: 3.0, angle: 178 }     // Standing position
];

const PROPER_SQUAT_FORM_KNEE_ANGLES_IN_TIME = [
    { time: 0.0, angle: 178 },    // Standing position (170-180 range)
    { time: 0.2, angle: 172 },    // Start of descent
    { time: 0.4, angle: 165 },    // Early descent (quarterSquat: 145-170)
    { time: 0.6, angle: 155 },    // Quarter squat
    { time: 0.8, angle: 140 },    // Half squat (120-145 range)
    { time: 1.0, angle: 125 },    // Entering deep squat
    { time: 1.2, angle: 105 },    // Deep squat (90-120 range)
    { time: 1.4, angle: 80 },     // Bottom position (70-90 range)
    { time: 1.6, angle: 105 },    // Start ascent
    { time: 1.8, angle: 125 },    // Early ascent
    { time: 2.0, angle: 140 },    // Half way up
    { time: 2.2, angle: 155 },    // Quarter position
    { time: 2.4, angle: 165 },    // Near top
    { time: 2.6, angle: 172 },    // Almost standing
    { time: 2.8, angle: 178 },    // Return to standing
    { time: 3.0, angle: 178 }     // Standing position
];

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
        this.lastMovementDuration = null;
        this.tempoWarningShown = false;
        this.templatePauseDuration = 2000; // 2 seconds pause between template cycles

        this.STANDING_HIP_RANGE = [165, 180];
        this.STANDING_LEG_RANGE = [165, 180];
        this.MOVEMENT_START_THRESHOLD = 15; // degrees below standing position
        this.MOVEMENT_END_THRESHOLD = 15;    // degrees from baseline to consider "returned"
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
            minAngle: 70,
            colors: {
                leg: '#FF6B6B',
                hip: '#4ECDC4',
                templateLeg: '#FFA500',
                templateHip: '#9370DB'
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
        ctx.fillText('3s', canvas.width - 30, canvas.height - 5);

        // Draw legend
        const legend = [
            { name: 'Leg', color: this.graphSettings.colors.leg },
            { name: 'Hip', color: this.graphSettings.colors.hip },
            { name: 'Template Leg', color: this.graphSettings.colors.templateLeg },
            { name: 'Template Hip', color: this.graphSettings.colors.templateHip }
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

        // If movement is active, also track in movement-specific history
        if (this.isMovementActive) {
            this.movementAngleHistory.leg.push({ time: currentTime, angle: selectedSide.leg });
            this.movementAngleHistory.hip.push({ time: currentTime, angle: selectedSide.hip });
        }

        // Remove old data points (keep last 3 seconds)
        Object.keys(this.angleHistory).forEach(key => {
            this.angleHistory[key] = this.angleHistory[key].filter(
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
            this.movementStartTime = Date.now();
            this.isMovementActive = true;
            this.movementAngleHistory = { leg: [], hip: [] };
            this.tempoWarningShown = false;

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

        // Check if user has returned close to baseline angles
        const hipDiff = Math.abs(this.baselineAngles.hip - currentAngles.hip);
        const legDiff = Math.abs(this.baselineAngles.leg - currentAngles.leg);

        if (hipDiff <= this.MOVEMENT_END_THRESHOLD && legDiff <= this.MOVEMENT_END_THRESHOLD) {
            this.movementEndTime = Date.now();
            this.lastMovementDuration = this.movementEndTime - this.movementStartTime;
            this.isMovementActive = false;
            
            if (this.movementStatusElement) {
                this.movementStatusElement.textContent = "Complete";
                this.movementStatusElement.className = "status-value good";
            }
            
            this.validateMovementTempo();
            this.analyzeMovementForm();
            
            this.baselineAngles.hip = null;
            this.baselineAngles.leg = null;

            setTimeout(() => {
                if (this.movementStatusElement) {
                    this.movementStatusElement.textContent = "Ready";
                    this.movementStatusElement.className = "status-value";
                }
            }, 2000);
            
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

    analyzeMovementForm() {
        if (this.movementAngleHistory.hip.length < 5 || this.movementAngleHistory.leg.length < 5) {
            if (this.formScoreElement) {
                this.formScoreElement.textContent = "Insufficient data";
                this.formScoreElement.className = "status-value warning";
            }
            return;
        }

        const scaleFactor = this.lastMovementDuration / this.IDEAL_MOVEMENT_DURATION;
        this.compareWithTemplate(scaleFactor);
    }

    compareWithTemplate(scaleFactor) {
        const scaledHipTemplate = PROPER_SQUAT_FORM_HIP_ANGLES_IN_TIME.map(point => ({
            time: point.time * scaleFactor * 1000, // Convert to milliseconds
            angle: point.angle
        }));

        const scaledLegTemplate = PROPER_SQUAT_FORM_KNEE_ANGLES_IN_TIME.map(point => ({
            time: point.time * scaleFactor * 1000,
            angle: point.angle
        }));

        // Compare user movement with scaled template
        let hipFormScore = 0;
        let legFormScore = 0;
        let totalComparisons = 0;

        const sampleInterval = this.lastMovementDuration / 10; // 10 sample points
        
        for (let i = 0; i <= 10; i++) {
            const sampleTime = i * sampleInterval;
            const userHipAngle = this.interpolateAngleAtTime(this.movementAngleHistory.hip, sampleTime);
            const userLegAngle = this.interpolateAngleAtTime(this.movementAngleHistory.leg, sampleTime);
            
            const templateHipAngle = this.interpolateTemplateAngleAtTime(scaledHipTemplate, sampleTime);
            const templateLegAngle = this.interpolateTemplateAngleAtTime(scaledLegTemplate, sampleTime);

            if (userHipAngle !== null && templateHipAngle !== null) {
                const hipDiff = Math.abs(userHipAngle - templateHipAngle);
                hipFormScore += Math.max(0, 20 - hipDiff); // Max 20 points per sample, decreasing with difference
                totalComparisons++;
            }

            if (userLegAngle !== null && templateLegAngle !== null) {
                const legDiff = Math.abs(userLegAngle - templateLegAngle);
                legFormScore += Math.max(0, 20 - legDiff);
            }
        }

        const avgHipScore = totalComparisons > 0 ? hipFormScore / totalComparisons : 0;
        const avgLegScore = totalComparisons > 0 ? legFormScore / totalComparisons : 0;
        const overallScore = (avgHipScore + avgLegScore) / 2;

        if (this.formScoreElement) {
            const scorePercentage = Math.round((overallScore / 20) * 100);
            this.formScoreElement.textContent = `${scorePercentage}%`;
            
            if (overallScore >= 15) {
                this.formScoreElement.className = "status-value good";
            } else if (overallScore >= 10) {
                this.formScoreElement.className = "status-value warning";
            } else {
                this.formScoreElement.className = "status-value error";
            }
        }
    }

    interpolateAngleAtTime(angleHistory, targetTime) {
        if (angleHistory.length === 0) return null;

        // Find the two points that bracket the target time
        let before = null, after = null;
        
        for (let i = 0; i < angleHistory.length; i++) {
            const point = angleHistory[i];
            const relativeTime = point.time - this.movementStartTime;
            
            if (relativeTime <= targetTime) {
                before = { ...point, relativeTime };
            } else {
                after = { ...point, relativeTime };
                break;
            }
        }

        if (!before) return after ? after.angle : null;
        if (!after) return before.angle;

        // Linear interpolation
        const timeDiff = after.relativeTime - before.relativeTime;
        const angleDiff = after.angle - before.angle;
        const timeRatio = (targetTime - before.relativeTime) / timeDiff;
        
        return before.angle + (angleDiff * timeRatio);
    }

    interpolateTemplateAngleAtTime(template, targetTime) {
        // Find the two template points that bracket the target time
        let before = null, after = null;
        
        for (let i = 0; i < template.length; i++) {
            if (template[i].time <= targetTime) {
                before = template[i];
            } else {
                after = template[i];
                break;
            }
        }

        if (!before) return after ? after.angle : null;
        if (!after) return before.angle;

        // Linear interpolation
        const timeDiff = after.time - before.time;
        const angleDiff = after.angle - before.angle;
        const timeRatio = (targetTime - before.time) / timeDiff;
        
        return before.angle + (angleDiff * timeRatio);
    }

    resetMovementTracking() {
        this.movementStartTime = null;
        this.movementEndTime = null;
        this.isMovementActive = false;
        this.baselineAngles = { hip: null, leg: null };
        this.movementAngleHistory = { leg: [], hip: [] };
        this.lastMovementDuration = null;
        this.tempoWarningShown = false;
        
        // Reset UI elements
        if (this.movementStatusElement) {
            this.movementStatusElement.textContent = "Ready";
            this.movementStatusElement.className = "status-value";
        }
        if (this.formScoreElement) {
            this.formScoreElement.textContent = "-";
            this.formScoreElement.className = "status-value";
        }
        if (this.tempoStatusElement) {
            this.tempoStatusElement.textContent = "-";
            this.tempoStatusElement.className = "status-value";
        }
    }

    getMovementStatus() {
        return {
            isActive: this.isMovementActive,
            startTime: this.movementStartTime,
            endTime: this.movementEndTime,
            duration: this.lastMovementDuration,
            baseline: this.baselineAngles,
            hasData: this.movementAngleHistory.hip.length > 0
        };
    }

    drawGraph() {
        this.drawGraphBackground();

        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        const currentTime = Date.now() - this.startTime;
        
        this.drawTemplateLine(ctx, canvas, PROPER_SQUAT_FORM_HIP_ANGLES_IN_TIME, this.graphSettings.colors.templateHip);
        this.drawTemplateLine(ctx, canvas, PROPER_SQUAT_FORM_KNEE_ANGLES_IN_TIME, this.graphSettings.colors.templateLeg);

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

    drawTemplateLine(ctx, canvas, templateData, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // Dashed line for template
        ctx.beginPath();
        
        const currentTime = Date.now() - this.startTime;
        const templateCycleDuration = 3000; // 3 seconds in milliseconds
        const totalCycleDuration = templateCycleDuration + this.templatePauseDuration; // Include pause
        
        // Calculate how many cycles we need to cover the visible time window
        const visibleTimeStart = currentTime - this.graphSettings.maxTime;
        const visibleTimeEnd = currentTime;
        
        // Find the first cycle that could be visible
        const firstCycle = Math.floor(visibleTimeStart / totalCycleDuration);
        const lastCycle = Math.ceil(visibleTimeEnd / totalCycleDuration) + 1;
        
        let firstPoint = true;
        
        for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
            const cycleStartTime = cycle * totalCycleDuration;
            const cycleEndTime = cycleStartTime + templateCycleDuration;
            
            templateData.forEach((point, index) => {
                // Calculate the absolute time for this point in this cycle
                const absoluteTime = cycleStartTime + (point.time * 1000);
                
                // Only draw if we're within the active part of the cycle (not during pause)
                if (absoluteTime >= cycleStartTime && absoluteTime <= cycleEndTime) {
                    // Convert to canvas x position (same logic as user data)
                    const x = ((currentTime - absoluteTime) / this.graphSettings.maxTime) * canvas.width;
                    const adjustedX = canvas.width - x; // Reverse x to show newest data on right
                    
                    // Only draw if the point is within the visible time window
                    if (adjustedX >= -10 && adjustedX <= canvas.width + 10) { // Small buffer for smooth transitions
                        const y = canvas.height - ((point.angle - this.graphSettings.minAngle) / 
                                 (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;
                        
                        if (firstPoint) {
                            ctx.moveTo(adjustedX, y);
                            firstPoint = false;
                        } else {
                            ctx.lineTo(adjustedX, y);
                        }
                    }
                }
            });
        }
        
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid line for subsequent drawings
    }

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

        this.updateAngleGraph(currentAngles);
    }
}