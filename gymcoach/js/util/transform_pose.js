const REFERENCE_LANDMARKS = {
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_HIP: 23,
    RIGHT_HIP: 24
};

// The goal of this class is to transform one set of cords into another
export class TransformPose {
    constructor() {
        // Get two inputs of cords

        // Theory: Aligning Two Coordinate Setss
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

        // Alternative Simple Approach:
        // Just use translation + scaling without rotation:

        // ✓ Align centroids (translation)
        // ✓ Match average sizes (scaling)
        // ✓ Skip rotation if poses are roughly similar orientation

        // Result: Second coordinate set now positioned/scaled to match first set exactly.
    }

    align(target, source) {
        // Get reference landmarks (shoulders and hips)
        const targetPoints = this.getReferencePoints(target);
        const sourcePoints = this.getReferencePoints(source);
        
        if (targetPoints.length < 4 || sourcePoints.length < 4) {
            return source; // Return original if not enough reference points
        }

        // Calculate centroids (center points)
        const targetCenter = this.getCentroid(targetPoints);
        const sourceCenter = this.getCentroid(sourcePoints);

        // Calculate scale factor
        const targetSize = this.getAverageSize(targetPoints, targetCenter);
        const sourceSize = this.getAverageSize(sourcePoints, sourceCenter);
        const scale = sourceSize > 0 ? targetSize / sourceSize : 1;

        // Calculate rotation angle (using shoulder line)
        const rotation = this.getShoulderRotation(target, source);

        // Transform all source landmarks
        return source.map((point, index) => {
            if (!point || point.x == null || point.y == null) {
                return point; // Keep invalid points as-is
            }

            // 1. Move to origin
            let x = point.x - sourceCenter.x;
            let y = point.y - sourceCenter.y;
            let z = (point.z || 0) - sourceCenter.z;

            // 2. Scale
            x *= scale;
            y *= scale;
            z *= scale;

            // 3. Rotate (around z-axis)
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const rotatedX = x * cos - y * sin;
            const rotatedY = x * sin + y * cos;

            // 4. Move to target position
            const finalX = rotatedX + targetCenter.x;
            const finalY = rotatedY + targetCenter.y;
            const finalZ = z + targetCenter.z;

            return { 
                ...point, 
                x: finalX, 
                y: finalY, 
                ...(point.z != null && { z: finalZ })
            };
        });
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

    // Calculate rotation using shoulder line (more reliable for poses)
    getShoulderRotation(targetLandmarks, sourceLandmarks) {
        const targetLeft = targetLandmarks[REFERENCE_LANDMARKS.LEFT_SHOULDER];
        const targetRight = targetLandmarks[REFERENCE_LANDMARKS.RIGHT_SHOULDER];
        const sourceLeft = sourceLandmarks[REFERENCE_LANDMARKS.LEFT_SHOULDER];
        const sourceRight = sourceLandmarks[REFERENCE_LANDMARKS.RIGHT_SHOULDER];

        // Check if we have valid shoulder landmarks
        if (!targetLeft || !targetRight || !sourceLeft || !sourceRight) {
            return 0;
        }

        // Calculate shoulder line vectors
        const targetVector = {
            x: targetRight.x - targetLeft.x,
            y: targetRight.y - targetLeft.y
        };
        
        const sourceVector = {
            x: sourceRight.x - sourceLeft.x,
            y: sourceRight.y - sourceLeft.y
        };

        // Calculate angle between shoulder lines
        const targetAngle = Math.atan2(targetVector.y, targetVector.x);
        const sourceAngle = Math.atan2(sourceVector.y, sourceVector.x);
        
        return targetAngle - sourceAngle;
    }

    // Calculate rotation angle between two point sets (fallback method)
    getRotationAngle(targetPoints, sourcePoints, targetCenter, sourceCenter) {
        if (targetPoints.length < 2 || sourcePoints.length < 2) {
            return 0; // Need at least 2 points for rotation
        }

        // Use vector from first to second point
        const targetVector = {
            x: targetPoints[1].x - targetPoints[0].x,
            y: targetPoints[1].y - targetPoints[0].y
        };
        
        const sourceVector = {
            x: sourcePoints[1].x - sourcePoints[0].x,
            y: sourcePoints[1].y - sourcePoints[0].y
        };

        // Calculate angle between vectors
        const targetAngle = Math.atan2(targetVector.y, targetVector.x);
        const sourceAngle = Math.atan2(sourceVector.y, sourceVector.x);
        
        return targetAngle - sourceAngle;
    }

}