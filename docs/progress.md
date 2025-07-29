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

## 29.07.2025.

task: 226-display-live-meta-info
- We managed to display the average color and metadata by using the library sharp (https://github.com/lovell/sharp)

task: 227-frame-processing
- Using the sharp library gives us a lot of image manipulation tools which makes it relatively simple to downsample a frame and add any effects to it, it is also very quick and optimized so it does not give us any issues with rendering