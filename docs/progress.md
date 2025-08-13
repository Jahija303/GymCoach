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
- We added hands, legs and body position, calculations based on joint angles

problems:
- We retrieve keypoints of the shoulders, hips, etc., but we do not know if a persons posture is correct, or if the person has bent shoulders, this could be a big problem for verifying the quality of an exercise or even verifying the persons posture.

## 05.08.2025

task: 231-basic-exercise-form-calculation

brainstorming:
- How can we get over the hurdle that a camera cannot simply detect the spinal curvature of the person doing the exercise, which in turn might give a false positive.
- First, we should have the user select an exercise so we can decide which ruleset to use. Second, the model should recognise the starting position, the apex, and the ending postion (probably same as the starting).
- After we can confidently recongise the start and apex positions, we can easily count the reps the user did.
- To expand this, we need to then figure out a way to validate the movement between the start and the apex of the exercise. We need to define a detailed ruleset and movement pattern which the user must follow for the exercise to be valid.

progress:
- Figuring out a way to determine the current squat position based on the joint angles
- Refcatoring the code functions a little bit to make it easier to get the joint angles
- Made the calculations for the three squat states, standing, apex and transitioning

todo:
- Separate camera.js into multiple files/classes
- Create a class only responsible for calculating joint angles, and determing if the calculations can be done at all based on visibility and which sections to consider based on users position (front/side)
- Do the same for plank and pushup as we did for squat

progress 02:
- Started refactoring the code so we can organise it better. Separated the methods into multiple files so we can have the squat as an excerise in a specialized class, as well as all angle calculations.
- When changing exercises, assign the new class instance to the new exercise and use it and it's parent class (exercise) for validating the correctness and form

## 06.08.2025

task: 231-basic-exercise-form-calculation

brainstorming:
- We should have the exercise class detect where the user is facing (front/side). Based on the users direction, we should apply different rules for exercise form validation. We won't take into account any other direction other than front/side, for the moment.
- The squat class should now use different predefined rules based on the users direction.

todo:
- Analyze the exercise and understand what it means to do the exercise with a proper form and then try to translate this into code.
- Optimize the body pose calculations

progress:
- We can successfully detect person front and side, however, we have a problem with scaling when the person stands further away from the camera. The values are hard-coded at the moment. We are trying to figure out how to setup scaling in order to detect person front and side from any distance

## 07.08.2025

task: 231-basic-exercise-form-calculation

progress:
- We made a relatively reliable scaling solution and solved the user direction issue
- We are also able to detect different stages of a squat from the side. For the squat exercise we have to detect different stages of the exercise from the front, give feedback regarding the form and the rep counter. We are also looking into other solutions that would give us better feedback regarding the form since the angle calculation has a lot of limitations, probably training a ML model but this needs more research


## 08.08.2025

task: 231-basic-exercise-form-calculation

to do:
- Update the method for squat validation from the front.
- Update manual validations to include validation of knee positioning from the front(both legs) and from the side. The idea is to have the manual calculations as safety measures.
- With the manual calculations we can include rep and duration counter(to verify that the person is not doing the exercise too fast) for stability metrics.
- Research the creation of the ML model, is it realistic for us to implement in this case? We will pause the manual calculations for the other exercises until we understand this better. The goal is to have one exercise (for now) that can be completely validated.

problems:
- There might be a problem with front squat validation. If the user is not perfectly front facing the camera, the angles cannot be aligned. We need to further investigate if there is a possiblity to get the body rotation degree. If we find a way to get the rotation degree, we might be able to calculate the knee degrees and determine if the user has potential for knee injury.

progress:
- In our attempt to validate correct knee angles and positions we relised that there are a lot of edge cases for this, for example if we define strict angles which the user must fulfill from the side perspective, the user might not exaclty face the side and have a certain offset, hence it would result in incorrect validations, so we tried to go around this problem by calculating the joint angle in a 3d plane using the z point of blazePose, this is still work in progress.

## 11.08.2025

progress:
- Today we tried to make calculate3DAngle method more accurate by normalizing the Z keypoint using the users body scale as a reference, however it still did not turn out as accurate as we hoped it would, we need to investigate this more
- Refactored squat state validation from the side

## 12.08.2025

progress:
- Today we are working on getting the correct angle in a 3D space based on a 2D image, to do this we are considering the body rotation and the length of the limbs in 2D instead of the Z points as they are too unpredictable. We managed to get an improved calculate3DAngle method, but it is still flaky.

problems:
- The current problem is that the body rotation is not reliable enough and that our method is too sensitive to any variations to body rotation.

todo:
- We want to get a relatively confident 3D angle in order to implement any kind of safety measures for an excersize, otherwise the user would have to be perfectly facing the camera (front or side) which is not realistic to do.
- We can still implement the validations in such a way that we do not tolerate some rotations, for example if the user is side facing then we can tolerate a little bit of rotation and still make valid suggestions, otherwise we can let the user know to face the side or the front for full validation.

progress 2:
- The problem lies in the body rotation angle and the body scale, how can we confidently calculate these two values ?

## 13.08.2025

todo:
- We were thinking of adding a calibration button to retrieve all lengths between keypoints and use this as a reference to calculate body rotation and have better z values for our 3d angle method

progress:
- We implemented a calibration method which gets all keypoints and calculates limb length if all keypoints are visible (more than 0.85) which should help us get a correct z value and body rotation in order to validate any exercise with 3d angles

brainstorming:
- To improve the calibration method we can add an individual visibility value for all keypoints, for example shoulders and hips are priority and should be at least 0.9 while toes and heels might not be a priorty so they can be 0.6 or so