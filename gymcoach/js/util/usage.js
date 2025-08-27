// Example usage with your specific camera data
const extrinsicsData = [
    {
        "key": 2,
        "value": {
            "rotation": [
                [0.9988030137049204, 0.04395316831220853, -0.021462963665052287],
                [-0.04428200294652341, 0.9989050420333288, -0.01509374756108893],
                [0.020776044594984355, 0.016026103572373854, 0.9996557007166391]
            ],
            "center": [0.04226977516862528, -0.015511915928765434, 0.40964726389637975]
        }
    },
    {
        "key": 4,
        "value": {
            "rotation": [
                [0.9529560158659477, 0.03999673721586226, -0.30045813824389069],
                [-0.06075282191007576, 0.9963445198234208, -0.06005574450291767],
                [0.29695778564446209, 0.07548416277552773, 0.9519024186938572]
            ],
            "center": [-0.7986772410381993, -0.19260410095828965, 0.36612682036232588]
        }
    }
];

const intrinsicsData = [
    {
        "key": 0,
        "value": {
            "polymorphic_id": 2147483649,
            "polymorphic_name": "pinhole_radial_k3",
            "ptr_wrapper": {
                "id": 2147483654,
                "data": {
                    "width": 605,
                    "height": 1446,
                    "focal_length": 594.8821776151864,
                    "principal_point": [357.242276650705, 764.0771781638679],
                    "disto_k3": [0.9899284910423792, -11.15648401514126, 88.35437311025942]
                }
            }
        }
    },
    {
        "key": 2,
        "value": {
            "polymorphic_id": 1,
            "ptr_wrapper": {
                "id": 2147483655,
                "data": {
                    "width": 763,
                    "height": 1600,
                    "focal_length": 1299.5496492655435,
                    "principal_point": [405.10082483356259, 725.7244877273535],
                    "disto_k3": [-2.2483330530090339, 10.205365061064383, -33.51692246536753]
                }
            }
        }
    }
];

// Initialize the triangulator
const triangulator = new StereoTriangulator(intrinsicsData, extrinsicsData);

// Example BlazePose keypoints from two cameras
// BlazePose returns 33 keypoints, here's an example subset
const blazePoseKeypoints1 = [
    // Nose
    { x: 320, y: 240, visibility: 0.9 },
    // Left eye inner
    { x: 315, y: 235, visibility: 0.85 },
    // Left eye
    { x: 310, y: 235, visibility: 0.88 },
    // Left eye outer
    { x: 305, y: 235, visibility: 0.82 },
    // Right eye inner
    { x: 325, y: 235, visibility: 0.87 },
    // Right eye
    { x: 330, y: 235, visibility: 0.9 },
    // Right eye outer
    { x: 335, y: 235, visibility: 0.83 },
    // Left ear
    { x: 295, y: 240, visibility: 0.75 },
    // Right ear
    { x: 345, y: 240, visibility: 0.78 },
    // Mouth left
    { x: 310, y: 255, visibility: 0.92 },
    // Mouth right
    { x: 330, y: 255, visibility: 0.91 },
    // Left shoulder
    { x: 280, y: 320, visibility: 0.95 },
    // Right shoulder
    { x: 360, y: 320, visibility: 0.94 },
    // Left elbow
    { x: 250, y: 380, visibility: 0.89 },
    // Right elbow
    { x: 390, y: 380, visibility: 0.87 },
    // Left wrist
    { x: 220, y: 420, visibility: 0.85 },
    // Right wrist
    { x: 420, y: 420, visibility: 0.83 },
    // ... Add remaining 16 keypoints for full BlazePose model
];

const blazePoseKeypoints2 = [
    // Corresponding keypoints from second camera
    { x: 425, y: 380, visibility: 0.88 },
    { x: 420, y: 375, visibility: 0.84 },
    { x: 415, y: 375, visibility: 0.86 },
    { x: 410, y: 375, visibility: 0.81 },
    { x: 430, y: 375, visibility: 0.85 },
    { x: 435, y: 375, visibility: 0.89 },
    { x: 440, y: 375, visibility: 0.82 },
    { x: 400, y: 380, visibility: 0.74 },
    { x: 450, y: 380, visibility: 0.77 },
    { x: 415, y: 395, visibility: 0.91 },
    { x: 435, y: 395, visibility: 0.90 },
    { x: 385, y: 460, visibility: 0.93 },
    { x: 465, y: 460, visibility: 0.92 },
    { x: 355, y: 520, visibility: 0.88 },
    { x: 495, y: 520, visibility: 0.86 },
    { x: 325, y: 560, visibility: 0.84 },
    { x: 525, y: 560, visibility: 0.82 },
    // ... Add remaining 16 keypoints
];

// Function to process BlazePose results from both cameras
function processBlazePoseResults(keypoints1, keypoints2) {
    try {
        // Triangulate 3D keypoints
        const keypoints3D = triangulator.triangulateBlazePoseKeypoints(
            keypoints1,
            2, // Camera key for first camera
            keypoints2,
            4  // Camera key for second camera
        );
        
        console.log('3D Keypoints:', keypoints3D);
        
        // Filter out low-confidence keypoints
        const confidenKeypoints = keypoints3D.filter(kp => kp.visibility > 0.5);
        
        console.log(`Found ${confidenKeypoints.length} confident 3D keypoints`);
        
        return keypoints3D;
    } catch (error) {
        console.error('Error during triangulation:', error);
        return null;
    }
}

// Function to integrate with your existing BlazePose pipeline
function integrateWithBlazePose() {
    // This would be called after you get results from both cameras
    const triangulated3D = processBlazePoseResults(
        blazePoseKeypoints1, 
        blazePoseKeypoints2
    );
    
    if (triangulated3D) {
        // Use the 3D keypoints for your application
        displayResults(triangulated3D);
    }
}

// Helper function to display results
function displayResults(keypoints3D) {
    console.log('=== 3D BlazePose Results ===');
    
    const keypointNames = [
        'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
        'right_eye_inner', 'right_eye', 'right_eye_outer',
        'left_ear', 'right_ear', 'mouth_left', 'mouth_right',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist'
        // Add remaining keypoint names as needed
    ];
    
    keypoints3D.forEach((kp, index) => {
        if (kp.visibility > 0.5) {
            const name = keypointNames[index] || `keypoint_${index}`;
            console.log(`${name}: (${kp.x.toFixed(3)}, ${kp.y.toFixed(3)}, ${kp.z.toFixed(3)}) - confidence: ${kp.visibility.toFixed(3)}`);
        }
    });
}

// Advanced usage: Real-time processing
class BlazePose3DProcessor {
    constructor(intrinsics, extrinsics) {
        this.triangulator = new StereoTriangulator(intrinsics, extrinsics);
        this.frameBuffer = [];
        this.maxBufferSize = 5; // For smoothing
    }
    
    processFrame(keypoints1, keypoints2) {
        const triangulated = this.triangulator.triangulateBlazePoseKeypoints(
            keypoints1, 2, keypoints2, 4
        );
        
        // Add to buffer for temporal smoothing
        this.frameBuffer.push(triangulated);
        if (this.frameBuffer.length > this.maxBufferSize) {
            this.frameBuffer.shift();
        }
        
        // Apply temporal smoothing
        return this.smoothKeypoints(triangulated);
    }
    
    smoothKeypoints(currentKeypoints) {
        if (this.frameBuffer.length < 2) {
            return currentKeypoints;
        }
        
        const smoothed = currentKeypoints.map((kp, index) => {
            let sumX = 0, sumY = 0, sumZ = 0, count = 0;
            
            this.frameBuffer.forEach(frame => {
                if (frame[index] && frame[index].visibility > 0.5) {
                    sumX += frame[index].x;
                    sumY += frame[index].y;
                    sumZ += frame[index].z;
                    count++;
                }
            });
            
            if (count > 0) {
                return {
                    x: sumX / count,
                    y: sumY / count,
                    z: sumZ / count,
                    visibility: kp.visibility,
                    keypointIndex: kp.keypointIndex
                };
            }
            
            return kp;
        });
        
        return smoothed;
    }
}

// Example usage with real-time processing
const processor = new BlazePose3DProcessor(intrinsicsData, extrinsicsData);

// This would be called for each frame
function onNewFrame(keypoints1, keypoints2) {
    const smoothed3D = processor.processFrame(keypoints1, keypoints2);
    // Use smoothed3D for your application
    return smoothed3D;
}

// Run the example
integrateWithBlazePose();