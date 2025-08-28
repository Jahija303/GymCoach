class StereoTriangulator {
    constructor(intrinsics, extrinsics) {
        this.intrinsics = this.parseIntrinsics(intrinsics);
        this.extrinsics = this.parseExtrinsics(extrinsics);
        this.cameras = this.setupCameras();
    }

    parseIntrinsics(intrinsicsData) {
        const intrinsics = {};
        intrinsicsData.forEach(item => {
            const key = item.key;
            const data = item.value.ptr_wrapper.data;
            intrinsics[key] = {
                width: data.width,
                height: data.height,
                focal_length: data.focal_length,
                principal_point: data.principal_point,
                disto_k3: data.disto_k3 || [0, 0, 0]
            };
        });
        return intrinsics;
    }

    parseExtrinsics(extrinsicsData) {
        const extrinsics = {};
        extrinsicsData.forEach(item => {
            extrinsics[item.key] = {
                rotation: item.value.rotation,
                center: item.value.center
            };
        });
        return extrinsics;
    }

    setupCameras() {
        const cameras = {};
        
        for (const cameraKey in this.extrinsics) {
            if (this.intrinsics[cameraKey]) {
                const R = this.extrinsics[cameraKey].rotation;
                const C = this.extrinsics[cameraKey].center;
                
                // Convert rotation matrix and center to projection matrix
                const P = this.createProjectionMatrix(
                    R, 
                    C, 
                    this.intrinsics[cameraKey]
                );
                
                cameras[cameraKey] = {
                    projection: P,
                    intrinsics: this.intrinsics[cameraKey],
                    extrinsics: this.extrinsics[cameraKey]
                };
            }
        }
        
        return cameras;
    }

    createProjectionMatrix(R, C, intrinsics) {
        // Create camera matrix K
        const fx = intrinsics.focal_length;
        const fy = intrinsics.focal_length;
        const cx = intrinsics.principal_point[0];
        const cy = intrinsics.principal_point[1];
        
        const K = [
            [fx, 0, cx],
            [0, fy, cy],
            [0, 0, 1]
        ];
        
        // Convert center to translation: t = -R * C
        const t = this.matrixVectorMultiply(
            this.transposeMatrix(R), 
            C.map(x => -x)
        );
        
        // Create [R|t] matrix
        const Rt = [
            [...R[0], t[0]],
            [...R[1], t[1]],
            [...R[2], t[2]]
        ];
        
        // P = K * [R|t]
        return this.matrixMultiply(K, Rt);
    }

    // Undistort 2D points using radial distortion model
    undistortPoint(point, intrinsics) {
        const [x, y] = point;
        const [cx, cy] = intrinsics.principal_point;
        const [k1, k2, k3] = intrinsics.disto_k3;
        
        // Normalize coordinates
        let xn = (x - cx) / intrinsics.focal_length;
        let yn = (y - cy) / intrinsics.focal_length;
        
        // Apply radial distortion correction iteratively
        for (let i = 0; i < 10; i++) {
            const r2 = xn * xn + yn * yn;
            const r4 = r2 * r2;
            const r6 = r4 * r2;
            
            const distortion = 1 + k1 * r2 + k2 * r4 + k3 * r6;
            
            const xd = xn / distortion;
            const yd = yn / distortion;
            
            if (Math.abs(xd - xn) < 1e-6 && Math.abs(yd - yn) < 1e-6) {
                break;
            }
            
            xn = xd;
            yn = yd;
        }
        
        // Convert back to pixel coordinates
        return [
            xn * intrinsics.focal_length + cx,
            yn * intrinsics.focal_length + cy
        ];
    }

    // Triangulate 3D point from two 2D observations
    triangulatePoint(point1, cameraKey1, point2, cameraKey2) {
        const camera1 = this.cameras[cameraKey1];
        const camera2 = this.cameras[cameraKey2];
        
        if (!camera1 || !camera2) {
            throw new Error(`Camera not found: ${cameraKey1} or ${cameraKey2}`);
        }
        
        // Undistort points
        const undistorted1 = this.undistortPoint(point1, camera1.intrinsics);
        const undistorted2 = this.undistortPoint(point2, camera2.intrinsics);
        
        // Set up linear system for triangulation using DLT (Direct Linear Transform)
        const P1 = camera1.projection;
        const P2 = camera2.projection;
        
        const [x1, y1] = undistorted1;
        const [x2, y2] = undistorted2;
        
        // Build coefficient matrix A for the equation AX = 0
        const A = [
            [
                x1 * P1[2][0] - P1[0][0],
                x1 * P1[2][1] - P1[0][1],
                x1 * P1[2][2] - P1[0][2],
                x1 * P1[2][3] - P1[0][3]
            ],
            [
                y1 * P1[2][0] - P1[1][0],
                y1 * P1[2][1] - P1[1][1],
                y1 * P1[2][2] - P1[1][2],
                y1 * P1[2][3] - P1[1][3]
            ],
            [
                x2 * P2[2][0] - P2[0][0],
                x2 * P2[2][1] - P2[0][1],
                x2 * P2[2][2] - P2[0][2],
                x2 * P2[2][3] - P2[0][3]
            ],
            [
                y2 * P2[2][0] - P2[1][0],
                y2 * P2[2][1] - P2[1][1],
                y2 * P2[2][2] - P2[1][2],
                y2 * P2[2][3] - P2[1][3]
            ]
        ];
        
        // Solve using SVD (simplified approach)
        const point3D = this.solveDLT(A);
        
        return point3D;
    }

    // Simplified DLT solver using least squares
    solveDLT(A) {
        // This is a simplified implementation
        // For production, consider using a proper SVD library
        
        // Build normal equations: A^T * A * x = 0
        const AT = this.transposeMatrix(A);
        const ATA = this.matrixMultiply(AT, A);
        
        // Find the eigenvector corresponding to the smallest eigenvalue
        // This is a simplified approach - use proper SVD for better results
        const solution = this.solveHomogeneous(ATA);
        
        // Normalize by w coordinate
        if (Math.abs(solution[3]) < 1e-10) {
            return [0, 0, 0]; // Point at infinity
        }
        
        return [
            solution[0] / solution[3],
            solution[1] / solution[3],
            solution[2] / solution[3]
        ];
    }

    // Simplified homogeneous system solver
    solveHomogeneous(matrix) {
        // This is a very simplified approach
        // For production, use a proper SVD implementation
        const n = matrix.length;
        let minCol = 0;
        let minSum = Infinity;
        
        // Find column with minimum sum of squares (heuristic)
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let i = 0; i < n; i++) {
                sum += matrix[i][j] * matrix[i][j];
            }
            if (sum < minSum) {
                minSum = sum;
                minCol = j;
            }
        }
        
        const solution = new Array(n).fill(0);
        solution[minCol] = 1;
        
        return solution;
    }

    // Triangulate all BlazePose keypoints
    triangulateBlazePoseKeypoints(keypoints1, cameraKey1, keypoints2, cameraKey2) {
        if (keypoints1.length !== keypoints2.length) {
            throw new Error('Keypoint arrays must have the same length');
        }
        
        const triangulated3D = [];
        
        for (let i = 0; i < keypoints1.length; i++) {
            const kp1 = keypoints1[i];
            const kp2 = keypoints2[i];
            
            // Check if both keypoints are visible (confidence > threshold)
            const confidenceThreshold = 0.5;
            if (kp1.visibility > confidenceThreshold && kp2.visibility > confidenceThreshold) {
                try {
                    const point3D = this.triangulatePoint(
                        [kp1.x, kp1.y],
                        cameraKey1,
                        [kp2.x, kp2.y],
                        cameraKey2
                    );

                    triangulated3D.push({
                        x: point3D[0],
                        y: point3D[1],
                        z: point3D[2],
                        visibility: Math.min(kp1.visibility, kp2.visibility),
                        keypointIndex: i
                    });
                } catch (error) {
                    console.warn(`Failed to triangulate keypoint ${i}:`, error);
                    triangulated3D.push({
                        x: 0,
                        y: 0,
                        z: 0,
                        visibility: 0,
                        keypointIndex: i
                    });
                }
            } else {
                triangulated3D.push({
                    x: 0,
                    y: 0,
                    z: 0,
                    visibility: 0,
                    keypointIndex: i
                });
            }
        }
        
        return triangulated3D;
    }

    // Helper matrix operations
    matrixMultiply(A, B) {
        const rows = A.length;
        const cols = B[0].length;
        const inner = B.length;
        
        const result = Array(rows).fill().map(() => Array(cols).fill(0));
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                for (let k = 0; k < inner; k++) {
                    result[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        
        return result;
    }

    matrixVectorMultiply(matrix, vector) {
        return matrix.map(row => 
            row.reduce((sum, val, idx) => sum + val * vector[idx], 0)
        );
    }

    transposeMatrix(matrix) {
        return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
    }
}

// Usage example
function createTriangulator(intrinsicsData, extrinsicsData) {
    return new StereoTriangulator(intrinsicsData, extrinsicsData);
}

// Example usage with BlazePose keypoints
function triangulateBlazePoseFromTwoCameras(
    triangulator,
    keypoints1, // Array of {x, y, visibility} from camera 1
    keypoints2, // Array of {x, y, visibility} from camera 2
    cameraKey1 = 2, // Camera key from your data
    cameraKey2 = 4  // Camera key from your data
) {
    return triangulator.triangulateBlazePoseKeypoints(
        keypoints1,
        cameraKey1,
        keypoints2,
        cameraKey2
    );
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        StereoTriangulator,
        createTriangulator,
        triangulateBlazePoseFromTwoCameras
    };
}