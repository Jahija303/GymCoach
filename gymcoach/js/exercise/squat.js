import { Exercise } from './exercise.js';
import { LANDMARK } from '../util/landmark_reader.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../util/pose.js';

const PROPER_SQUAT_FORM_HIP_ANGLES_IN_TIME = [
    { time: 0.0, angle: 175 },    // Standing position - nearly straight trunk
    { time: 0.2, angle: 170 },    // Start of descent - slight forward lean
    { time: 0.4, angle: 155 },    // Early descent - trunk begins forward lean
    { time: 0.6, angle: 135 },    // Quarter squat - moderate forward lean
    { time: 0.8, angle: 110 },    // Half squat - increased trunk flexion
    { time: 1.0, angle: 85 },     // Deep squat approach
    { time: 1.2, angle: 65 },     // Near bottom - significant trunk lean
    { time: 1.4, angle: 55 },     // Bottom position - max trunk flexion (45-60° range)
    { time: 1.5, angle: 65 },     // Start ascent - quick transition
    { time: 1.7, angle: 85 },     // Early ascent - faster than descent
    { time: 1.9, angle: 110 },    // Mid ascent
    { time: 2.1, angle: 135 },    // Quarter up
    { time: 2.3, angle: 155 },    // Near top
    { time: 2.5, angle: 170 },    // Almost standing
    { time: 2.7, angle: 175 },    // Return to standing
    { time: 3.0, angle: 175 }     // Standing position
];

const PROPER_SQUAT_FORM_KNEE_ANGLES_IN_TIME = [
    { time: 0.0, angle: 175 },    // Standing position - nearly straight legs
    { time: 0.2, angle: 170 },    // Start of descent - slight knee bend
    { time: 0.4, angle: 155 },    // Early descent - moderate knee flexion
    { time: 0.6, angle: 135 },    // Quarter squat - 45° knee bend
    { time: 0.8, angle: 115 },    // Half squat - significant flexion
    { time: 1.0, angle: 95 },     // Deep squat approach
    { time: 1.2, angle: 85 },     // Near bottom - deep knee bend
    { time: 1.4, angle: 75 },     // Bottom position - max knee flexion (70-80° range)
    { time: 1.5, angle: 85 },     // Start ascent - quick transition
    { time: 1.7, angle: 95 },     // Early ascent - faster than descent
    { time: 1.9, angle: 115 },    // Mid ascent
    { time: 2.1, angle: 135 },    // Quarter up
    { time: 2.3, angle: 155 },    // Near top
    { time: 2.5, angle: 170 },    // Almost standing
    { time: 2.7, angle: 175 },    // Return to standing
    { time: 3.0, angle: 175 }     // Standing position
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
        this.drawnTemplateLines = {
            hip: [],
            leg: []
        };
        this.templateProgress = {
            hip: 0,
            leg: 0
        };
        this.storedFormDifferenceAreas = {
            hip: [],
            leg: []
        };
        this.movementEndTime = null;
        this.AREA_DRAWING_DELAY = 500; // Continue drawing area for 0.5 seconds after movement stops

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
        }

        // Continue updating form difference area for a delay period after movement stops
        const shouldUpdateArea = this.isMovementActive || 
            (this.movementEndTime && (currentTime - this.movementEndTime) < this.AREA_DRAWING_DELAY);

        if (shouldUpdateArea) {
            this.updateStoredFormDifferenceArea(currentTime, selectedSide.leg, 'leg');
            this.updateStoredFormDifferenceArea(currentTime, selectedSide.hip, 'hip');
        }

        Object.keys(this.angleHistory).forEach(key => {
            this.angleHistory[key] = this.angleHistory[key].filter(
                point => currentTime - point.time <= this.graphSettings.maxTime
            );
        });

        Object.keys(this.drawnTemplateLines).forEach(key => {
            this.drawnTemplateLines[key] = this.drawnTemplateLines[key].filter(
                point => currentTime - point.time <= this.graphSettings.maxTime
            );
        });

        Object.keys(this.storedFormDifferenceAreas).forEach(key => {
            this.storedFormDifferenceAreas[key] = this.storedFormDifferenceAreas[key].filter(
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

    updateStoredFormDifferenceArea(currentTime, userAngle, angleType) {
        const templateData = angleType === 'hip' ? PROPER_SQUAT_FORM_HIP_ANGLES_IN_TIME : PROPER_SQUAT_FORM_KNEE_ANGLES_IN_TIME;
        const relativeTime = (currentTime - this.movementStartTime) / 1000; // Convert to seconds
        
        if (relativeTime >= 0) {
            const templateAngle = this.interpolateTemplateAngle(templateData, relativeTime);
            
            this.storedFormDifferenceAreas[angleType].push({
                time: currentTime,
                userAngle: userAngle,
                templateAngle: templateAngle
            });
        }
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
            this.drawnTemplateLines = {
                hip: [],
                leg: []
            };
            this.templateProgress = {
                hip: 0,
                leg: 0
            };
            this.storedFormDifferenceAreas = {
                hip: [],
                leg: []
            };
            this.movementEndTime = null; // Reset when starting new movement

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

    validateFormScore() {
        if (!this.movementAngleHistory.hip.length || !this.movementAngleHistory.leg.length) {
            return;
        }

        let totalHipError = 0;
        let totalLegError = 0;
        let hipSampleCount = 0;
        let legSampleCount = 0;

        // Calculate average error for hip angles
        this.movementAngleHistory.hip.forEach(point => {
            const relativeTime = (point.time - this.movementStartTime) / 1000; // Convert to seconds
            if (relativeTime >= 0 && relativeTime <= 3) { // Only within 3-second exercise window
                const idealHipAngle = this.interpolateTemplateAngle(PROPER_SQUAT_FORM_HIP_ANGLES_IN_TIME, relativeTime);
                const error = Math.abs(point.angle - idealHipAngle);
                totalHipError += error;
                hipSampleCount++;
            }
        });

        // Calculate average error for leg angles
        this.movementAngleHistory.leg.forEach(point => {
            const relativeTime = (point.time - this.movementStartTime) / 1000; // Convert to seconds
            if (relativeTime >= 0 && relativeTime <= 3) { // Only within 3-second exercise window
                const idealLegAngle = this.interpolateTemplateAngle(PROPER_SQUAT_FORM_KNEE_ANGLES_IN_TIME, relativeTime);
                const error = Math.abs(point.angle - idealLegAngle);
                totalLegError += error;
                legSampleCount++;
            }
        });

        if (hipSampleCount === 0 || legSampleCount === 0) {
            return;
        }

        // Calculate average errors
        const avgHipError = totalHipError / hipSampleCount;
        const avgLegError = totalLegError / legSampleCount;
        const avgTotalError = (avgHipError + avgLegError) / 2;

        // Convert error to score (0-100 scale, where lower error = higher score)
        // Assuming max reasonable error is 30 degrees
        const maxError = 30;
        const score = Math.max(0, Math.round(100 - (avgTotalError / maxError) * 100));

        // Update form score display
        if (this.formScoreElement) {
            this.formScoreElement.textContent = `${score}%`;
            if (score >= 80) {
                this.formScoreElement.className = "status-value good";
            } else if (score >= 60) {
                this.formScoreElement.className = "status-value warning";
            } else {
                this.formScoreElement.className = "status-value error";
            }
        }
    }

    drawGraph() {
        this.drawGraphBackground();

        const ctx = this.graphCtx;
        const canvas = this.graphCanvas;
        const currentTime = Date.now() - this.startTime;

        this.drawStoredFormDifferenceArea(ctx, canvas, currentTime, 'hip');
        this.drawStoredFormDifferenceArea(ctx, canvas, currentTime, 'leg');

        // Draw template lines progressively when movement is active
        if (this.isMovementActive) {
            this.drawProgressiveTemplateLine(PROPER_SQUAT_FORM_KNEE_ANGLES_IN_TIME, 'leg');
            this.drawProgressiveTemplateLine(PROPER_SQUAT_FORM_HIP_ANGLES_IN_TIME, 'hip');
        }

        this.drawStoredTemplateLines(ctx, canvas);

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

    drawStoredFormDifferenceArea(ctx, canvas, currentTime, angleType) {
        const data = this.storedFormDifferenceAreas[angleType];
        if (data.length < 2) return;

        const color = this.graphSettings.colors[angleType];
        
        // Set up fill style with transparency
        ctx.fillStyle = color + '40'; // Add alpha channel for transparency
        ctx.beginPath();

        // Create arrays to store the path points
        const userPoints = [];
        const templatePoints = [];

        // Calculate points for stored data
        data.forEach(point => {
            const x = ((currentTime - point.time) / this.graphSettings.maxTime) * canvas.width;
            const adjustedX = canvas.width - x;
            
            if (adjustedX >= 0 && adjustedX <= canvas.width) {
                const userY = canvas.height - ((point.userAngle - this.graphSettings.minAngle) / 
                             (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;
                const templateY = canvas.height - ((point.templateAngle - this.graphSettings.minAngle) / 
                                 (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;
                
                userPoints.push({ x: adjustedX, y: userY });
                templatePoints.push({ x: adjustedX, y: templateY });
            }
        });

        // Draw the filled area between user and template lines
        if (userPoints.length > 1 && templatePoints.length > 1) {
            ctx.beginPath();
            
            // Start with the first user point
            ctx.moveTo(userPoints[0].x, userPoints[0].y);
            
            // Draw along user line
            for (let i = 1; i < userPoints.length; i++) {
                ctx.lineTo(userPoints[i].x, userPoints[i].y);
            }
            
            // Draw back along template line (in reverse)
            for (let i = templatePoints.length - 1; i >= 0; i--) {
                ctx.lineTo(templatePoints[i].x, templatePoints[i].y);
            }
            
            // Close the path
            ctx.closePath();
            ctx.fill();
        }
    }

    drawProgressiveTemplateLine(templateData, angleType) {
        const currentProgress = this.templateProgress[angleType];
        const maxPoints = templateData.length;
        
        // Add one more point if we haven't drawn all points yet
        if (currentProgress < maxPoints) {
            const nextPoint = templateData[currentProgress];
            const pointTime = this.movementStartTime + (nextPoint.time * 1000); // Convert template time to absolute time
            
            this.drawnTemplateLines[angleType].push({ time: pointTime, angle: nextPoint.angle });
            this.templateProgress[angleType]++;
        }
    }

    drawStoredTemplateLines(ctx, canvas) {
        const currentTime = Date.now() - this.startTime;

        if (this.drawnTemplateLines.hip.length > 0) {
            this.drawStoredTemplateLine(ctx, canvas, this.drawnTemplateLines.hip, this.graphSettings.colors.hip, currentTime);
        }

        if (this.drawnTemplateLines.leg.length > 0) {
            this.drawStoredTemplateLine(ctx, canvas, this.drawnTemplateLines.leg, this.graphSettings.colors.leg, currentTime);
        }
    }

    drawStoredTemplateLine(ctx, canvas, points, color, currentTime) {
        if (points.length < 1) return;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // Dashed line for template
        ctx.beginPath();

        let firstPoint = true;
        points.forEach(point => {
            const x = ((currentTime - point.time) / this.graphSettings.maxTime) * canvas.width;
            const adjustedX = canvas.width - x; // Reverse x to show newest data on right
            const y = canvas.height - ((point.angle - this.graphSettings.minAngle) / 
                     (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;

            // Only draw points within canvas bounds
            if (adjustedX >= 0 && adjustedX <= canvas.width) {
                if (firstPoint) {
                    ctx.moveTo(adjustedX, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(adjustedX, y);
                }
            }
        });

        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid line for subsequent drawings
    }

    drawTemplateLine(ctx, canvas, templateData, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // Dashed line for template
        ctx.beginPath();
        
        const currentTime = Date.now() - this.startTime;
        const templateCycleDuration = 3000; // 3 seconds for template pattern
        const totalCycleDuration = templateCycleDuration;

        // Calculate visible time window
        const visibleTimeStart = Math.max(0, currentTime - this.graphSettings.maxTime);
        const visibleTimeEnd = currentTime;
        // Generate continuous points for the visible time window
        const points = [];
        const sampleInterval = 50; // Sample every 50ms for smooth line
        
        for (let time = visibleTimeStart; time <= visibleTimeEnd; time += sampleInterval) {
            const cyclePosition = time % totalCycleDuration;
            let angle;
            
            if (cyclePosition <= templateCycleDuration) {
                // During template pattern (0-3000ms): interpolate from template data
                const normalizedTime = cyclePosition / 1000; // Convert to seconds (0-3)
                angle = this.interpolateTemplateAngle(templateData, normalizedTime);
            } else {
                angle = 175;
            }
            
            points.push({ time, angle });
        }
        
        // Draw the continuous line
        let firstPoint = true;
        points.forEach(point => {
            const x = ((currentTime - point.time) / this.graphSettings.maxTime) * canvas.width;
            const adjustedX = canvas.width - x; // Reverse x to show newest data on right
            const y = canvas.height - ((point.angle - this.graphSettings.minAngle) / 
                     (this.graphSettings.maxAngle - this.graphSettings.minAngle)) * canvas.height;
            
            // Only draw points within canvas bounds
            if (adjustedX >= 0 && adjustedX <= canvas.width) {
                if (firstPoint) {
                    ctx.moveTo(adjustedX, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(adjustedX, y);
                }
            }
        });
        
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid line for subsequent drawings
    }

    interpolateTemplateAngle(templateData, targetTime) {
        if (templateData.length === 0) return 180;
        if (templateData.length === 1) return templateData[0].angle;

        // Handle edge cases
        if (targetTime <= templateData[0].time) return templateData[0].angle;
        if (targetTime >= templateData[templateData.length - 1].time) return templateData[templateData.length - 1].angle;

        // Find bracketing points
        let before = null;
        let after = null;

        for (let i = 0; i < templateData.length - 1; i++) {
            if (templateData[i].time <= targetTime && templateData[i + 1].time >= targetTime) {
                before = templateData[i];
                after = templateData[i + 1];
                break;
            }
        }

        if (!before || !after) return 180;

        // Linear interpolation
        const timeDiff = after.time - before.time;
        if (timeDiff === 0) return before.angle;

        const progress = (targetTime - before.time) / timeDiff;
        return before.angle + (after.angle - before.angle) * progress;
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

        // Skip processing if all angles are invalid (0)
        const hasValidLeftSide = currentAngles.leftLeg > 0 && currentAngles.leftHip > 0;
        const hasValidRightSide = currentAngles.rightLeg > 0 && currentAngles.rightHip > 0;
        
        if (!hasValidLeftSide && !hasValidRightSide) {
            return false;
        }

        this.updateAngleGraph(currentAngles);
    }
}