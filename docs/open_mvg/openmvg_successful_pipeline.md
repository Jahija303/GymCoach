# OpenMVG Structure from Motion - Successful Pipeline Guide

This document provides a step-by-step guide for running a successful OpenMVG Structure from Motion (SfM) pipeline with custom parameters including focal length and AKAZE descriptors.

## Overview

The standard `SfM_SequentialPipeline.py` script has limitations and doesn't support advanced parameters like custom focal length or descriptor methods. This guide shows how to run each step manually for better control and results.

## Prerequisites

- OpenMVG built and installed
- Input images in a directory
- Camera focal length known (if available)

## Pipeline Steps

### 1. Image Listing with Camera Intrinsics

**Purpose**: Initialize the SfM data structure and set camera intrinsics (focal length, principal point, distortion).

**Command**:
```bash
~/schade/openMVG_Build/Linux-x86_64-RELEASE/openMVG_main_SfMInit_ImageListing \
  -i ~/schade/openMVG_Build/image_test_02 \
  -o ~/schade/openMVG_Build/output_test_02/matches \
  -d ~/schade/openMVG/src/software/SfM/../../openMVG/exif/sensor_width_database/sensor_width_camera_database.txt \
  -f 800
```

**Parameters**:
- `-i`: Input directory containing images
- `-o`: Output directory for matches and intermediate files
- `-d`: Camera sensor width database for EXIF parsing
- `-f 800`: Set focal length to 800 pixels

**Expected Output**:
```
usable #Intrinsic(s) listed in sfm_data: 1
```

**What happens**: 
- Analyzes images and creates `sfm_data.json` with proper camera intrinsics
- Sets focal length to 800px and calculates principal point as image center
- Without this step, reconstruction will fail with 0 tracks

### 2. Feature Extraction with AKAZE

**Purpose**: Extract distinctive features from each image using AKAZE descriptor.

**Command**:
```bash
~/schade/openMVG_Build/Linux-x86_64-RELEASE/openMVG_main_ComputeFeatures \
  -i ~/schade/openMVG_Build/output_test_02/matches/sfm_data.json \
  -o ~/schade/openMVG_Build/output_test_02/matches \
  -m AKAZE_FLOAT
```

**Parameters**:
- `-i`: Input SfM data file from step 1
- `-o`: Output directory for feature files
- `-m AKAZE_FLOAT`: Use AKAZE descriptor with floating-point features

**Alternative descriptor options**:
- `SIFT` (default)
- `SIFT_ANATOMY`
- `AKAZE_FLOAT`: AKAZE with floating point descriptors
- `AKAZE_MLDB`: AKAZE with binary descriptors

**What happens**:
- Creates `.feat` and `.desc` files for each image
- AKAZE is more robust to viewpoint changes than SIFT
- Features are stored in OpenMVG's internal format

### 3. Image Pair Generation

**Purpose**: Determine which image pairs should be matched (exhaustive by default).

**Command**:
```bash
~/schade/openMVG_Build/Linux-x86_64-RELEASE/openMVG_main_PairGenerator \
  -i ~/schade/openMVG_Build/output_test_02/matches/sfm_data.json \
  -o ~/schade/openMVG_Build/output_test_02/matches/pairs.bin
```

**Parameters**:
- `-i`: Input SfM data file
- `-o`: Output binary file containing image pairs

**What happens**:
- For 2 images, creates 1 pair: (0,1)
- For larger datasets, can use different strategies (sequential, vocabulary tree, etc.)
- Outputs `pairs.bin` file

### 4. Feature Matching

**Purpose**: Match features between image pairs to find correspondences.

**Command**:
```bash
~/schade/openMVG_Build/Linux-x86_64-RELEASE/openMVG_main_ComputeMatches \
  -i ~/schade/openMVG_Build/output_test_02/matches/sfm_data.json \
  -o ~/schade/openMVG_Build/output_test_02/matches/matches.putative.bin \
  -p ~/schade/openMVG_Build/output_test_02/matches/pairs.bin
```

**Parameters**:
- `-i`: Input SfM data file
- `-o`: Output file for putative matches
- `-p`: Pairs file from step 3

**Expected Output**:
```
#Putative pairs: 1
Graph statistics:
    #nodes: 2
    #cc: 1  ← Connected components = 1 (good!)
    #singleton: 0
```

**What happens**:
- Matches AKAZE features between image pairs
- Uses ratio test (default 0.8) to filter matches
- Creates initial correspondence graph

### 5. Geometric Filtering

**Purpose**: Filter matches using geometric constraints (fundamental matrix).

**Command**:
```bash
~/schade/openMVG_Build/Linux-x86_64-RELEASE/openMVG_main_GeometricFilter \
  -i ~/schade/openMVG_Build/output_test_02/matches/sfm_data.json \
  -m ~/schade/openMVG_Build/output_test_02/matches/matches.putative.bin \
  -o ~/schade/openMVG_Build/output_test_02/matches/matches.f.bin
```

**Parameters**:
- `-i`: Input SfM data file
- `-m`: Putative matches from step 4
- `-o`: Output geometrically filtered matches

**Expected Output**:
```
Graph statistics:
    #nodes: 2
    #cc: 1  ← Still connected (good!)
    #singleton: 0
```

**What happens**:
- Applies RANSAC with fundamental matrix estimation
- Removes outlier matches that don't fit geometric model
- Essential for robust reconstruction

### 6. Structure from Motion Reconstruction

**Purpose**: Reconstruct 3D structure and camera poses from filtered matches.

**Command**:
```bash
mkdir -p ~/schade/openMVG_Build/output_test_02/reconstruction_sequential

~/schade/openMVG_Build/Linux-x86_64-RELEASE/openMVG_main_SfM \
  -i ~/schade/openMVG_Build/output_test_02/matches/sfm_data.json \
  -m ~/schade/openMVG_Build/output_test_02/matches \
  -o ~/schade/openMVG_Build/output_test_02/reconstruction_sequential/sfm_data.bin
```

**Parameters**:
- `-i`: Input SfM data file
- `-m`: Directory containing match files
- `-o`: Output reconstruction file

**Expected Output**:
```
-- Tracks Stats --
 Tracks number: 19  ← Found tracks (not 0!)
 Images Id: 0, 1

Bundle Adjustment statistics:
 #views: 2
 #poses: 2
 #intrinsics: 1
 #tracks: 15  ← Final 3D points
 Final RMSE: 0.923871  ← Good accuracy

-- #Camera calibrated: 2 from 2 input images
-- #Tracks, #3D points: 14
```

**What happens**:
- Builds tracks from filtered matches
- Initializes reconstruction with best image pair
- Runs bundle adjustment to optimize camera poses and 3D points
- Generates reconstruction report and 3D model

### 7. Structure Colorization

**Purpose**: Add color information to 3D points from source images.

**Command**:
```bash
~/schade/openMVG_Build/Linux-x86_64-RELEASE/openMVG_main_ComputeSfM_DataColor \
  -i ~/schade/openMVG_Build/output_test_02/reconstruction_sequential/sfm_data.bin/sfm_data.bin \
  -o ~/schade/openMVG_Build/output_test_02/reconstruction_sequential/colorized.ply
```

**Parameters**:
- `-i`: Input reconstruction file (note the nested path)
- `-o`: Output colored point cloud in PLY format

**What happens**:
- Projects 3D points back to source images
- Extracts RGB color values
- Creates colored PLY file for visualization

### 8. Convert sfm_data.bin to a json

```bash
~/schade/openMVG_Build/Linux-x86_64-RELEASE/openMVG_main_ConvertSfM_DataFormat -V -I -E \
-i /home/knight/schade/openMVG_Build/output_test_02/reconstruction_sequential/sfm_data.bin/sfm_data.bin \
-o /home/knight/schade/openMVG_Build/output_test_02/reconstruction_sequential/sfm_data.bin/sfm_data_out.json
```

## Results

### Final Output Files:
- `colorized.ply`: Colored 3D point cloud (1.2KB for 14 points)
- `sfm_data.bin/`: Directory containing reconstruction data
- `Reconstruction_Report.html`: Detailed reconstruction statistics

### Quality Metrics:
- **Tracks found**: 19 initial → 14 final
- **RMSE**: 0.923871 pixels (good accuracy)
- **Validation rate**: 79% points validated during robust estimation
- **Connected components**: 1 (all images connected)

## Troubleshooting

### Common Issues:

1. **0 tracks found**:
   - **Cause**: No camera intrinsics set
   - **Solution**: Use `-f` parameter in step 1

2. **AKAZE descriptor not found**:
   - **Cause**: Using `AKAZE` instead of `AKAZE_FLOAT`
   - **Solution**: Use correct descriptor name

3. **Disconnected graph (cc > 1)**:
   - **Cause**: Insufficient feature matches
   - **Solution**: Check image overlap, lighting conditions, try different descriptors

4. **High RMSE**:
   - **Cause**: Poor feature matches or incorrect focal length
   - **Solution**: Verify focal length, check image quality

## Advanced Options

### Different Descriptor Methods:
```bash
# SIFT (default, robust but slower)
-m SIFT

# AKAZE Float (faster, good for video sequences)
-m AKAZE_FLOAT

# AKAZE Binary (fastest, good for real-time)
-m AKAZE_MLDB
```

### Camera Models:
- Model 3 (default): Pinhole with radial distortion (K1, K2, K3)
- Model 1: Pinhole (no distortion)
- Model 4: Pinhole + tangential distortion

### Matching Strategies:
```bash
# Exhaustive (default for small datasets)
--pair_mode EXHAUSTIVE

# Sequential (for ordered image sequences)
--pair_mode CONTIGUOUS

# Custom pairs from file
--input_pairs pairs.txt
```

## Performance Tips

1. **For large datasets**: Use vocabulary tree matching instead of exhaustive
2. **For video sequences**: Use sequential pair generation
3. **For speed**: Use AKAZE_MLDB binary descriptors
4. **For accuracy**: Use SIFT with bundle adjustment

## Integration with GymCoach

This pipeline can be integrated into the GymCoach application for:
- 3D pose reconstruction from multiple camera views
- Camera calibration and positioning
- 3D scene understanding for exercise analysis
- Real-time pose tracking improvements

The successful reconstruction with 14 3D points from just 2 images shows the pipeline is working correctly and can be scaled for more complex scenarios.
