const REFERENCE_LANDMARKS = {
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_HIP: 23,
    RIGHT_HIP: 24
};

// The goal of this class is to transform one set of coords into another
export class TransformPose {
    constructor() {
        // Get two inputs of cords

        // Theory: Aligning Two Coordinate Sets
        // Core Problem:
        // Transform coordinate set B to match the position, scale, and orientation of coordinate set A.
        // Key Steps (in order):
        // 1. Find Corresponding Points

        // ✓ Match landmarks between both sets (nose↔nose, shoulder↔shoulder, etc.)
        // ✓ Only use points visible in both sets (visibility > threshold)
        // ✓ Need minimum 3-4 good matches for reliable alignment

        // 2. Calculate Translation

        // ✓ Find centroid (center point) of each set
        // ✓ Translation = Target_centroid - Source_centroid
        // ✓ This moves one set to roughly overlay the other

        // 3. Calculate Scale Factor

        // ✓ Measure average distance from centroid to all points in each set
        // ✓ Scale = Target_average_distance / Source_average_distance
        // ✓ This resizes the source to match target size

        // 4. Calculate Rotation (optional but recommended)

        // ✓ Find orientation difference using shoulder line or hip line
        // ✓ Calculate angle between corresponding vectors
        // ✓ Usually just need Y-axis rotation for pose alignment

        // 5. Apply Transformation (in order)

        // ✓ Step 1: Translate source to origin (subtract source centroid)
        // ✓ Step 2: Apply scale factor (multiply by scale)
        // ✓ Step 3: Apply rotation (rotate around axis)
        // ✓ Step 4: Translate to target position (add target centroid)

        // Result: Reference landmarks are exactly identical between target and source.
    }

    align(target, source) {
        // Get reference landmarks (shoulders and hips)
        const targetPoints = this.getReferencePoints(target);
        const sourcePoints = this.getReferencePoints(source);
        
        if (targetPoints.length < 4 || sourcePoints.length < 4) {
            return source; // Return original if not enough reference points
        }

        // Use all 4 reference landmarks with priority weighting
        // This ensures better alignment of all shoulder and hip points
        const transform = this.calculateOptimalTransform(sourcePoints, targetPoints);

        // Apply transformation to all source landmarks
        return source.map((point, index) => {
            if (!point || point.x == null || point.y == null) {
                return point;
            }

            return this.applyTransform(point, transform);
        });
    }

    // Calculate optimal transformation using all 4 reference landmarks
    calculateOptimalTransform(sourcePoints, targetPoints) {
        // Use least squares approach to fit all 4 points as closely as possible
        // This gives better overall alignment than just using 2 points
        
        // Calculate centroids
        const sourceCentroid = this.getCentroid(sourcePoints);
        const targetCentroid = this.getCentroid(targetPoints);

        // Center the points
        const centeredSource = sourcePoints.map(p => ({
            x: p.x - sourceCentroid.x,
            y: p.y - sourceCentroid.y,
            z: (p.z || 0) - sourceCentroid.z
        }));

        const centeredTarget = targetPoints.map(p => ({
            x: p.x - targetCentroid.x,
            y: p.y - targetCentroid.y,
            z: (p.z || 0) - targetCentroid.z
        }));

        // Calculate scale using all points
        const sourceScale = this.getAverageSize(sourcePoints, sourceCentroid);
        const targetScale = this.getAverageSize(targetPoints, targetCentroid);
        const scale = sourceScale > 0 ? targetScale / sourceScale : 1;

        // Calculate rotation using shoulder line (most reliable)
        const rotation = this.calculateBestRotation(centeredSource, centeredTarget);

        return {
            translation: {
                x: targetCentroid.x - sourceCentroid.x,
                y: targetCentroid.y - sourceCentroid.y,
                z: targetCentroid.z - sourceCentroid.z
            },
            scale,
            rotation,
            origin: sourceCentroid
        };
    }

    // Calculate best rotation using multiple reference vectors
    calculateBestRotation(centeredSource, centeredTarget) {
        // Use shoulder line and hip line for better rotation estimate
        let totalRotation = 0;
        let validRotations = 0;

        // Try different point pairs for rotation calculation
        for (let i = 0; i < centeredSource.length - 1; i++) {
            for (let j = i + 1; j < centeredSource.length; j++) {
                const sourceVec = {
                    x: centeredSource[j].x - centeredSource[i].x,
                    y: centeredSource[j].y - centeredSource[i].y
                };

                const targetVec = {
                    x: centeredTarget[j].x - centeredTarget[i].x,
                    y: centeredTarget[j].y - centeredTarget[i].y
                };

                // Skip if vectors are too small
                const sourceMag = Math.sqrt(sourceVec.x ** 2 + sourceVec.y ** 2);
                const targetMag = Math.sqrt(targetVec.x ** 2 + targetVec.y ** 2);
                
                if (sourceMag > 0.001 && targetMag > 0.001) {
                    const sourceAngle = Math.atan2(sourceVec.y, sourceVec.x);
                    const targetAngle = Math.atan2(targetVec.y, targetVec.x);
                    totalRotation += targetAngle - sourceAngle;
                    validRotations++;
                }
            }
        }

        return validRotations > 0 ? totalRotation / validRotations : 0;
    }

    // Get center point of coordinates
    getCentroid(points) {
        const sum = points.reduce((acc, p) => ({ 
            x: acc.x + p.x, 
            y: acc.y + p.y,
            z: acc.z + (p.z || 0)
        }), { x: 0, y: 0, z: 0 });
        
        return {
            x: sum.x / points.length,
            y: sum.y / points.length,
            z: sum.z / points.length
        };
    }

    // Get average distance from center
    getAverageSize(points, center) {
        const totalDistance = points.reduce((sum, p) => {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const dz = (p.z || 0) - center.z;
            return sum + Math.sqrt(dx * dx + dy * dy + dz * dz);
        }, 0);
        
        return totalDistance / points.length;
    }

    // Apply transformation (optimized for all 4 reference points)
    applyTransform(point, transform) {
        // 1. Translate to origin (relative to centroid)
        let x = point.x - transform.origin.x;
        let y = point.y - transform.origin.y;
        let z = (point.z || 0) - transform.origin.z;

        // 2. Scale (applies to X, Y, and Z)
        x *= transform.scale;
        y *= transform.scale;
        z *= transform.scale;

        // 3. Rotate (2D rotation in XY plane, Z stays scaled)
        const cos = Math.cos(transform.rotation);
        const sin = Math.sin(transform.rotation);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;

        // 4. Translate to final position
        return {
            ...point,
            x: rotatedX + transform.origin.x + transform.translation.x,
            y: rotatedY + transform.origin.y + transform.translation.y,
            z: z + transform.origin.z + transform.translation.z
        };
    }

    // Get reference landmarks for alignment
    getReferencePoints(landmarks) {
        const points = [];
        
        for (const [name, index] of Object.entries(REFERENCE_LANDMARKS)) {
            const landmark = landmarks[index];
            if (landmark && landmark.x != null && landmark.y != null) {
                // Check visibility if it exists (BlazePose includes visibility score)
                if (!landmark.visibility || landmark.visibility > 0.5) {
                    points.push(landmark);
                }
            }
        }
        
        return points;
    }
}

// Usage with BlazePose landmarks:
/*
const transformer = new TransformPose();

// Align source to exactly match target reference landmarks
const aligned = transformer.align(targetLandmarks, sourceLandmarks);

// Verify exact alignment of reference landmarks:
const checkAlignment = (target, aligned) => {
    const landmarks = Object.entries(REFERENCE_LANDMARKS);
    
    for (const [name, index] of landmarks) {
        const t = target[index];
        const a = aligned[index];
        
        if (t && a) {
            const diff = Math.sqrt(
                (t.x - a.x)**2 + 
                (t.y - a.y)**2 + 
                ((t.z||0) - (a.z||0))**2
            );
            console.log(`${name}: distance = ${diff.toFixed(6)}`);
        }
    }
};

checkAlignment(targetLandmarks, aligned);
*/