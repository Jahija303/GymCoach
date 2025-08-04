# Here we will describe out progress and thought process for each day

## 28.07.2025

task: 223-display-video-stream-in-browser

- Doing research on how to render webcam output on an html page using nodejs
- Generally two ways to do this, grab a camera snapshot (every x seconds) and update the image on page, or display a live video stream using ffmpeg or other stream capture (more complex)
- The most important aspect for choosing a solution is the hardware involved and the interface it offers. For development purposes it is probably best to use a simple (snapshot grab) solution and move onto the next step because this will be definitely changed once we finish the important milestones.
- Trying to setup and install openCV for nodejs. We will use it to render webcam output on the web as well as image processing.
- opencv4nodejs has some issues setting up, we will not waste any more time on it, we will just pivot back to node-webcam and get the video stream running, and think about ways of using openCV later down the line, the priority right now is a stable video stream.
- We setup a version of video capture with node-webcam, but it was extremely slow and unoptimized, we tried to make it work smoother but we had little success. 
- node-webcam does not support camera on mobile phone
- We fixed our implementation by utilizing browsers built in navigator.mediaDevices.getUserMedia API, which works smoothly, the implementation was changed so that the media displays the video directly to the client, and then capture every nth frame and send it to the server for processing.

## 29.07.2025

task: 226-display-live-meta-info
- We managed to display the average color and metadata by using the library sharp (https://github.com/lovell/sharp)

task: 227-frame-processing
- Using the sharp library gives us a lot of image manipulation tools which makes it relatively simple to downsample a frame and add any effects to it, it is also very quick and optimized so it does not give us any issues with rendering

task: 228-recognize-people-in-the-frame
- Researching opencv (https://opencv.org/university/free-opencv-course/?utm_source=opcvu&utm_medium=menu&utm_campaign=obc)

## 30.07.2025

task: 228-recognize-people-in-the-frame

- Going through the openCV course on the basics of computer vision
- Learning about different image loading and rendering methods, image processing, filtering, blurring.
- Camera access, video render, video storing, detecting sharp and canny edges
- Object tracking, face detection, TensorFlow object detection and pose estimation using OpenPose
- This course also had a quiz after each chapter which strengthened our understanding a bit

next steps:

- How can we integrate opencv into our nodejs application ?
- Can we try opencv4nodejs again and make it work correctly ? Or do we have to pivot to a python application with an interfacte for the browser ?

## 31.07.2025

task: 228-recognize-people-in-the-frame

ideas:
- We now learned about two ways we can make this work, use tensorflow.js (or similar) to run client side in the browser, or send frames to the server and use opecv (or tensorflow or similar) to run the processing on server side and send responses to the client. If we use the server side processing, the problem will be scalability and network latency, if we use client side models the potential problem will be older device hardware.

progress: 
- We decided not to use opencv, since tensorflow.js is faster and has better integration with javascript
- We have managed to recognize different parts of a person with tensorflow.js
- We are using client-side model processing, since server-side processing might be too resource intensive and currently an overkill
- We found out that the MoveNet model is highly optimized for browser usage, we will stick with it as long as we can (or until we run into a potential roadblock)

current problems:
- not adapted for different screen sizes
- is the person standing, or sitting? how can we retrieve more details about the persons posture
- how can we check if the pose is actually an exercise?

## 01.08.2025

task: 229-try-to-recognize-something-about-the-posture

progress:
- General investigation on how to classify poses and actions based on movenet model keypoints
- We found that most solutions online use some sort of manual calculations to classify the pose, but they only do it for simple poses and not complex actions/movements
- Currently we need to find a way to classify an action based on a series of keypoints across a certain timeframe
- We watched a few machine learning videos to understand our options better
- We found the [teachable machine page](https://teachablemachine.withgoogle.com/) which trains and creates a new model in a simple way
- We used AI to genererate a classifyPose function which manually calculates the current body position based on ligament angles and distances, we used this as an example for the manual solution

current problems:
- how can we classify an action based on movenet keypoints?
- do we need to create a new model or is there a trained solution already?
- can a model automatically recognize an action or do we have to manually make some similarity calculations?

## 04.08.2025

task: 230-recognize-a-pose-with-a-teachable-machine-model

branstorming:
- Autodetection of exercises does not make sense right now, we will manually select it. Autodetection would be too ambiguous and is not a priority.
- The following solution from the [article](https://medium.com/@pawelkapica/using-pose-estimation-algorithms-to-build-a-simple-gym-training-aid-app-ef87b3d07f94) is not realistic. The biggest problem is the exercise tempo, and real-time video normalization (we need to make sure the footage of the profesional and the user is matched in size, duration and speed) which is quite a challenge.
- The current idea is to have a selection of a few basic exercises and use MoveNet keypoints to check the users form. The form checking should be a multi-step process:
1. Joint angles (primary form check)
2. Angular velocities (movement quality)
3. Joint relationships (kinetic chain alignment)
4. Temporal patterns (movement phases)
5. Stability metrics (consistency across repetitions)

progress:
- This idea will be scrapped, we are going for the manual joint angle calculations
- Replaced movenet with media pipe blazepose since blazepose is more precise for fitness applications
