# OpenMVG Structure from Motion Pipeline - Step by Step Guide

## What is openMVG?
OpenMVG (Multiple View Geometry) is a C++ library for computer vision research and provides a complete Structure from Motion pipeline. It can reconstruct 3D scenes from multiple 2D images.

## Prerequisites

### 1. System Requirements
- Linux (Ubuntu/Debian recommended)
- CMake (>= 3.10)
- C++ compiler (GCC or Clang)
- Git

### 2. Dependencies to Install

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y \
    build-essential \
    cmake \
    git \
    libpng-dev \
    libjpeg-dev \
    libtiff-dev \
    libglu1-mesa-dev \
    libxrandr-dev \
    libxi-dev \
    libxmu-dev \
    libblas-dev \
    liblapack-dev \
    libsuitesparse-dev \
    libeigen3-dev \
    libceres-dev \
    libopencv-dev
```

## Step-by-Step Installation

### Step 1: Clone openMVG
```bash
cd ~/
git clone --recursive https://github.com/openMVG/openMVG.git
cd openMVG
```

### Step 2: Build openMVG
```bash
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
```

### Step 3: Install (Optional)
```bash
sudo make install
```

## Basic SfM Pipeline Workflow

### Step 1: Prepare Your Images
1. Create a directory for your images
2. Place all images in the same directory
3. Images should have some overlap between views
4. For your GymCoach project: use frames from your two cameras

### Step 2: Image Listing
```bash
# Create a list of images with their intrinsic parameters
openMVG_main_SfMInit_ImageListing \
    -i /path/to/images \
    -o /path/to/output \
    -d /path/to/openMVG/src/openMVG/cameras/sensor_width_camera_database.txt
```

### Step 3: Feature Detection
```bash
# Detect SIFT features in all images
openMVG_main_ComputeFeatures \
    -i /path/to/output/sfm_data.json \
    -o /path/to/output \
    -m SIFT
```

### Step 4: Feature Matching
```bash
# Match features between image pairs
openMVG_main_ComputeMatches \
    -i /path/to/output/sfm_data.json \
    -o /path/to/output \
    -g e  # Essential matrix geometric model
```

### Step 5: Structure from Motion
```bash
# Incremental SfM reconstruction
openMVG_main_IncrementalSfM \
    -i /path/to/output/sfm_data.json \
    -m /path/to/output \
    -o /path/to/output/reconstruction
```

### Step 6: Export Results
```bash
# Export to various formats
openMVG_main_openMVG2openMVS \
    -i /path/to/output/reconstruction/sfm_data.bin \
    -o /path/to/output/scene.mvs

# Or export to PLY point cloud
openMVG_main_ComputeSfM_DataColor \
    -i /path/to/output/reconstruction/sfm_data.bin \
    -o /path/to/output/colorized.ply
```

## Simple Example for GymCoach Project

### Scenario: Camera Calibration for Two Cameras

1. **Capture Calibration Images**:
   - Take 20-30 photos of a checkerboard pattern from different angles
   - Use both cameras simultaneously
   - Ensure good coverage of the field of view

2. **Run Basic Pipeline**:
```bash
# Set up directories
mkdir -p ~/gymcoach_sfm/{images,output}

# Copy your calibration images to ~/gymcoach_sfm/images/

# Run the pipeline
cd ~/openMVG/build/Linux-x86_64-RELEASE

# Image listing
./openMVG_main_SfMInit_ImageListing \
    -i ~/gymcoach_sfm/images \
    -o ~/gymcoach_sfm/output \
    -d ../src/openMVG/cameras/sensor_width_camera_database.txt

# Feature detection
./openMVG_main_ComputeFeatures \
    -i ~/gymcoach_sfm/output/sfm_data.json \
    -o ~/gymcoach_sfm/output \
    -m SIFT

# Feature matching
./openMVG_main_ComputeMatches \
    -i ~/gymcoach_sfm/output/sfm_data.json \
    -o ~/gymcoach_sfm/output

# SfM reconstruction
./openMVG_main_IncrementalSfM \
    -i ~/gymcoach_sfm/output/sfm_data.json \
    -m ~/gymcoach_sfm/output \
    -o ~/gymcoach_sfm/output/reconstruction
```

## Expected Outputs

- **Camera intrinsics**: Focal length, principal point, distortion parameters
- **Camera extrinsics**: Rotation and translation between cameras
- **3D point cloud**: Sparse reconstruction of the scene
- **Camera poses**: Position and orientation of each camera

## Integration with GymCoach

The camera calibration results can be used for:
1. **Triangulation**: More accurate 3D keypoint estimation
2. **Depth calculation**: Better Z-values for BlazePose keypoints
3. **Coordinate transformation**: Converting between camera coordinate systems

## Common Issues and Solutions

1. **Not enough features**: Use more distinctive objects in your scene
2. **Poor matches**: Ensure sufficient overlap between images
3. **Failed reconstruction**: Try with more images or adjust matching parameters
4. **Scale ambiguity**: Add known measurements or use a reference object

## Next Steps for GymCoach

1. Use openMVG to calibrate your two cameras
2. Extract camera intrinsics and extrinsics
3. Implement triangulation using the calibration data
4. Apply to your BlazePose keypoints for better 3D positioning

This approach is more lightweight than VoxelPose but requires the one-time calibration step mentioned in your research.
