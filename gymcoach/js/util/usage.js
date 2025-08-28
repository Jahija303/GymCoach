// Example usage with your specific camera data
const extrinsicsData = [
        {
            "key": 0,
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
            "device_id": "123",
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
            "device_id": "123",
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

// Initialize the triangulator
const triangulator = new StereoTriangulator(intrinsicsData, extrinsicsData);

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
    }
}

// Function to integrate with your existing BlazePose pipeline
function integrateWithBlazePose() {
    // This would be called after you get results from both cameras
    const triangulated3D = processBlazePoseResults(
        blazePoseKeypoints1, 
        blazePoseKeypoints2
    );
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