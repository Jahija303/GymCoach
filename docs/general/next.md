# What can we do next with the project ?

In which direction should the app proceed ? We want to create some use for this application.

1. Is this too big of a challenge ? We have many exercises, each one requires stages and joint angle calculations. Does it make sense to do invidual calculations for each exercise becuase this would be a lot of work. And if we opt for ML model, how difficult would it be to train one to do this automatically with relatively good confidence ? Do we scrap the idea and move on ?

2. Keep the solution as it is with one video input, focus on correctly validating exercises from only one perspective. Reorganise the code and make it more robust. This solution would still have general safety measures (with limitations because of the perspective) and rep/series counter. We could also expand this solution to suggest a certain pace for the user so they do not rest for too long or do the exercises too fast without reaching all stages.

Potential issues:
- Perspective limitations, we cannot validate a complete exercise from only one perspective, can we simply let the user know ?
- Rotation limitation, if the user slightly rotates from the expected perspective it will offset our calculations
- Scaling limitations, the user must be a certain distance away from the camera for most optimal calculations, can we trust them to do this ?

3. Add a second video input and have a more confident body keypoint locations, this will solve our two main issues with calculating joint angles in a 3D space. We could relatively easily verify the validity of the exercise and add good safety measures if we had correct 3D joint angles. The second video input would be connected to the same device that has the main video input, the model would still work on client side just the same.

Potential issues:
- How confidently can we combine the body keypoint results into (or at least have better Z), how difficult is this to do ?
- Will body scaling still present an issue ? How could we resolve this ?

4. Use a data driven approach to solve the scalability problem. For the most optimal validations we could still use two video inputs and try to get valid 3D joint angles. However, each exercise would be a json object with every stage, limitation and ruleset defined and our code would simply be a framework that consumes this data.

Potential issues:
- Same as in point 3

5. Data driven approach + ML model: in order to add as many exercise as we would like we could train a model to analyse footage of the same exercise (in different angles) and decide by itself what stages are there and define the correct joint angles.

Potential issues:
- Same as in point 4
- How could we get valid training data
- How difficult would it be to train an ML model for footage analsys

6. Posture analsys: We would still need two video inputs for this, however it would be a much simpler use case. We could simply decide when the users body position (in the 3d space) is too unhealthy and give them a warning.

Potential issues:
- Spinal curvature, we would to figure out a way to get the spinal curvature of the user in order to correctly decide if the posture is healthy or not

7. Can we use the current logic and what we learned for another use case ? Is there a similar application we could build that would benefit from this ?