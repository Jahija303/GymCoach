# The current progress and ideas for next steps

## 25.08.2025

branch: 235-better-3d-positioning-results
progress:
- We have two video inputs from two different cameras (the cameras have different focal lengths)
- The two inputs are retrieved from blazepose heavy model (which is a bit more accurate)
- Both inputs are rendered in a 3D space via three.js

next:
- How can we get an accurate representation 3D representation of the keypoints from these two inputs ?
- Can we find a working method for triangulation/stereo vision or will this still be inaccurate ?
- Can we find a different model that takes two video inputs instead of one to get an accurate result ?
- Can we use one model and give it a series of images as an input to get an accurate result ?

research results:
- Getting accurate Z values is difficult from one 2D model, a tall person far away vs. a short person close up look the same in 2D. We just cannot resolve all depth ambiguities from a single camera projection
- HMR 2.0, HybrIK, PARE could be more accurate than BlazePose with Z values from a single 2D camera, but they still cannot guarantee accurate z values without extra info
- HMR 2.0, HybrIK, PARE are python research tools and there are no js ports available
- If we are using two cameras, the most reliable route is triangulation with calibrated cameras, it does not work without calibrated cameras
- To calibrate the cameras we need camera extrinsics and intrinsics. Intrinsics (per camera) include focal length, lens distorion, principal point. Extrinsics (between two cameras) describe how they are oriented in the real world relative to a chosen reference frame, this includes how the camera is rotated and where the camera is located in space.
- We need to calibrate the cameras before doing any triangulation calculation because the current keypoint values are from the projection in a pixel space, not actual 3d space, the intrinsics help us map pixel space to camera ray.
- To skip manually calculating the triangulation, and to get maximum 3d accuracy, we can use VoxelPose (or some similar successors) which can handle imperfect detections better
- VoxelPose is compute heavy, which might be a potential issue and prevent us from making a practical application
- Conclusion: for fast and lightweight we triangulate 2d blazepose keypoints, for maximum 3d accuracy + robustness with 2 or more cameras we can use voxelPose or FasterVoxelPose or any successors of theirs
- VoxelPose is written in pyhton and we did not find any js implementation for it
- FasterVoxelPose is an optimized version of VoxelPose written in pytorch, it could run on 15-20 FPS with 2 cameras and an rtx card (3060/70 4060/70), however it is still GPU heavy, In practice we would need to run FasterVoxelPose on the backend and send the frame estimations to the frontend...
- OpenPose 3D + Anipose, takes classic 2d keypoints, does camera calibration and sync, triangulates automatically. Does not need model training, still needs to run on the backend (cannot run client-side), can be customizable to use any number of keypoints (usually coco17 keypoint set like openPose uses). Downsides is that it requires calibration (one time) and synced cameras
- Anipose vs FasterVoxelPose: Anipose (geometry based) is simpler, lightweight, easier to integrate while FsterVoxelPose (learning based) is heavier, more accurate even with ambiguities, harder to implement in real time since it is gpu hungry
- https://github.com/AlvinYH/Faster-VoxelPose
- https://github.com/lambdaloop/anipose

results v2:
- SnapSnap takes frames from two different perspectives ideally front and back and returns a 3D Human as a result (no joints detection)
- SfM only reconstructs what is visible and two views are barely enough for good triangulation, SfM prefers many views.
- Unlike SfM (structure from motion algorithms) SnapSnap uses related ideas with a deep learning implementation, while SfM relies on triangulation
- SnapSnap can be used to remove the need for camera calibration and avoid camera triangulation since it uses deep learning to generate a human guassian
- SnapSnap is just a deep learning model trained on millions of datasets and it predicts the human pose based on that data, it does not directly calculate anything related to geometry

- To get joint keypoint detection we can use SMPL/SMPL-X fit for an accurate 3D result
- SMPL/SMPL-X (https://www.youtube.com/watch?v=XyXIEmapWkw) with a single view is still guessing the depth of the body, but is probably more accurate than BlazePose
- Two views + SMPL should give an accurate 3d reconstruction, but camera calibration is still recommended
- Without calibrating the cameras SMPL-X can still work, but the body will not have a true 3D position and may float, however we still might get correct joint angles even with the incorrect scale factor. However extra calibration does really help and the optimizer does not have to guess how the two inputs relate

- Anipose requires camera calibration, camera calibration can be done with a reference item (like a checkerboard) recorded from both cameras at the same time. Anipose provides pre-built extensions for calibration, triangulation and computing angles between three keypoints.