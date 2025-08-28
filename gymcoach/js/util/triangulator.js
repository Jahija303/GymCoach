const extrinsicsData = [
        {
            "key": 0,
            "device_name": "laptop_cam",
            "device_id": "c6c59a2602f6a2217eb8caf898bd3451511bad37efdbd43904f505675e7b4e53",
            "value": {
                "rotation": [
                    [
                        0.9994263985769297,
                        -0.0033905065861522299,
                        0.03369537494430535
                    ],
                    [
                        0.004279933294603813,
                        0.9996433755483238,
                        -0.026359133015834318
                    ],
                    [
                        -0.03359398753559637,
                        0.026488227336723823,
                        0.9990844898275703
                    ]
                ],
                "center": [
                    -0.039157284812806638,
                    0.09134569728949421,
                    -0.2497508521039661
                ]
            }
        },
        {
            "key": 1,
            "device_name": "external_cam",
            "device_id": "5c85779bcf48c9ce2daed6c2b8d866addb63cb8cc791ff057c644d7968351ebe",
            "value": {
                "rotation": [
                    [
                        0.7975303128668473,
                        0.0626394695598846,
                        0.6000180804873841
                    ],
                    [
                        -0.02945414114062568,
                        0.9974517685343063,
                        -0.06498017403372238
                    ],
                    [
                        -0.6025594191680824,
                        0.034150641297654087,
                        0.7973430128061462
                    ]
                ],
                "center": [
                    1.0978753524509717,
                    0.26713902963526806,
                    0.24711853543123198
                ]
            }
        },
];

const intrinsicsData = [
    {
            "key": 0,
            "device_name": "laptop_cam",
            "device_id": "c6c59a2602f6a2217eb8caf898bd3451511bad37efdbd43904f505675e7b4e53",
            "value": {
                "polymorphic_id": 2147483649,
                "polymorphic_name": "pinhole_radial_k3",
                "ptr_wrapper": {
                    "id": 2147483652,
                    "data": {
                        "width": 1600,
                        "height": 1200,
                        "focal_length": 925.8363072132307,
                        "principal_point": [
                            750.2385492176366,
                            670.8484096780304
                        ],
                        "disto_k3": [
                            0.028722041026780624,
                            0.08575024821506944,
                            -0.11633708450381754
                        ]
                    }
                }
            }
        },
    {
            "key": 1,
            "device_name": "external_cam",
            "device_id": "5c85779bcf48c9ce2daed6c2b8d866addb63cb8cc791ff057c644d7968351ebe",
            "value": {
                "polymorphic_id": 2147483649,
                "polymorphic_name": "pinhole_radial_k3",
                "ptr_wrapper": {
                    "id": 2147483652,
                    "data": {
                        "width": 1600,
                        "height": 900,
                        "focal_length": 1027.799075163841,
                        "principal_point": [
                            690.2165444936014,
                            777.7579150457667
                        ],
                        "disto_k3": [
                            0.011201482123224093,
                            0.06511654286639639,
                            -0.19514421123446228
                        ]
                    }
                }
            }
        }
];

export class StereoTriangulator {
    constructor() {
        this.intrinsics = this.parseIntrinsics(intrinsicsData);
        this.extrinsics = this.parseExtrinsics(extrinsicsData);
        this.cameras = this.setupCameras();
    }

    parseIntrinsics(intrinsicsData) {
        const intrinsics = {};
        intrinsicsData.forEach(item => {
            const key = item.device_id;
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
            extrinsics[item.device_id] = {
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
        const t = this.matrixVectorMultiply(R, C.map(x => -x));
        
        // Create [R|t] matrix
        const Rt = [
            [...R[0], t[0]],
            [...R[1], t[1]],
            [...R[2], t[2]]
        ];
        
        // P = K * [R|t]
        return this.matrixMultiply(K, Rt);
    }

    // Convert BlazePose normalized coordinates to pixel coordinates
    blazePoseToPixel(point, intrinsics) {
        // BlazePose returns normalized coordinates (0-1), convert to pixels
        const x = point.x * intrinsics.width;
        const y = point.y * intrinsics.height;
        return [x, y];
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
        
        // Convert BlazePose normalized coordinates to pixels
        const pixel1 = this.blazePoseToPixel(point1, camera1.intrinsics);
        const pixel2 = this.blazePoseToPixel(point2, camera2.intrinsics);
        
        // Undistort points
        const undistorted1 = this.undistortPoint(pixel1, camera1.intrinsics);
        const undistorted2 = this.undistortPoint(pixel2, camera2.intrinsics);
        
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
        
        // Solve using improved DLT
        const point3D = this.solveDLT(A);
        
        return point3D;
    }

    // Improved DLT solver using least squares with proper SVD approximation
    solveDLT(A) {
        // Build A^T * A
        const AT = this.transposeMatrix(A);
        const ATA = this.matrixMultiply(AT, A);
        
        // Use power iteration to find the eigenvector with smallest eigenvalue
        let x = [1, 1, 1, 1]; // Initial guess
        let prevX = [0, 0, 0, 0];
        
        // Inverse power iteration for smallest eigenvalue
        for (let iter = 0; iter < 50; iter++) {
            prevX = [...x];
            
            // Solve (ATA + λI)x = x for small λ to avoid singularity
            const lambda = 1e-6;
            const ATAShifted = ATA.map((row, i) => 
                row.map((val, j) => i === j ? val + lambda : val)
            );
            
            // Solve linear system using Gauss-Seidel iteration
            x = this.solveLinearSystem(ATAShifted, x);
            
            // Normalize
            const norm = Math.sqrt(x.reduce((sum, val) => sum + val * val, 0));
            if (norm > 1e-10) {
                x = x.map(val => val / norm);
            }
            
            // Check convergence
            const diff = x.reduce((sum, val, i) => sum + Math.abs(val - prevX[i]), 0);
            if (diff < 1e-8) break;
        }
        
        // Normalize by w coordinate
        if (Math.abs(x[3]) < 1e-10) {
            console.warn('Point at infinity detected');
            return [0, 0, 0]; // Point at infinity or degenerate case
        }
        
        return [
            x[0] / x[3],
            x[1] / x[3],
            x[2] / x[3]
        ];
    }

    // Solve linear system using Gauss-Seidel iteration
    solveLinearSystem(A, b) {
        const n = A.length;
        let x = [...b]; // Initial guess
        
        for (let iter = 0; iter < 20; iter++) {
            for (let i = 0; i < n; i++) {
                let sum = 0;
                for (let j = 0; j < n; j++) {
                    if (i !== j) {
                        sum += A[i][j] * x[j];
                    }
                }
                
                if (Math.abs(A[i][i]) > 1e-10) {
                    x[i] = (b[i] - sum) / A[i][i];
                }
            }
        }
        
        return x;
    }

    // Triangulate all BlazePose keypoints
    triangulateBlazePoseKeypoints(keypoints1, cameraKey1, keypoints2, cameraKey2) {
        if (keypoints1?.length !== keypoints2?.length) {
            console.error('Keypoint arrays must have the same length');
            return [];
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
                        kp1, // Pass full keypoint object with x, y properties
                        cameraKey1,
                        kp2, // Pass full keypoint object with x, y properties
                        cameraKey2
                    );

                    // Validate the result
                    if (isFinite(point3D[0]) && isFinite(point3D[1]) && isFinite(point3D[2])) {
                        triangulated3D.push({
                            x: point3D[0],
                            y: point3D[1],
                            z: point3D[2],
                            visibility: Math.min(kp1.visibility, kp2.visibility),
                            keypointIndex: i
                        });
                    } else {
                        console.warn(`Invalid 3D point for keypoint ${i}:`, point3D);
                        triangulated3D.push({
                            x: 0,
                            y: 0,
                            z: 0,
                            visibility: 0,
                            keypointIndex: i
                        });
                    }
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