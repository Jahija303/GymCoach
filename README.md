# GymCoach

## Vision

GymCoach should be at least as good as a great personal coach for gym workouts. It may achieve this by being an interactive and personal app that can observe the user while doing her exercises and give live feedback and help her to achieve the user her fitness goals.
It should

- Suggest a plan of exercises, and thereby (optionally) presenting information on the how and why of the exercises and the useful quantities.
- Observe the user, while doing the exercises, keeping track of how well she adheres to the plan, and how good the exercises are.
- Give live feedback during the exercise by overlaying the live image of the user with an ideal version of the exercise, marking the good parts and highlighting the areas for improvement.
- Work like a good coach in the sense that it does not shout stop on any minor regression but to focus on the aspects that are improving or worsen during the workout or compared to the past workouts.

## Technical ideas

- A large screen, probably TV screen in portrait mode (but touchscreen would also be nice)
- One or more cameras
- Option to connect bluetooth audio for feedback

The display should focus on the current exercise, by default overlaying a perfect body posture doing that exercise in case the user is not doing a flawless version, highlighting what is good and what needs to be changed.
It should also have an outline for the whole workout, and an indication where the person currently is.
It should give the user a chance to alter the plan mid exercise and suggest changes, in case some exercises are too difficult in the current situation for him.

## Implementation guidelines

Let’s try to get very fast to the parts that seem to be very difficult to solve.
Because if we can not solve those hard problems, the whole project may not succeed and there is no need in investing all the labour into the other aspects we are confident that we can manage them.

Comparing to our current experiences, it will probably be the most difficult thing to analyze a video stream in real time in the browser.

- Therefore the _first milestone_ should be to recognize, if a person enters the video stream or leaves it.
- The _second milestone_ will be to recognize the change in posture of the main person in the stream, and to describe it, thereby always having an assessment if it is a healthy posture or not.

If that second milestone is reached, we should try to make it useful for a person that works all day on a computer and struggles with keeping good posture. It should be helpful that it gives feedback if posture degrades, but it should not get on her nerves every time she slightly moves or the camera quality degrades because of changing light or similar circumstances. The idea is to get a feeling, what it means to be a good coach.

After we have got the confidence that we can solve the technical problems and got an understanding for the complexities of what it may mean to be a good coach, we may start with a detailed plan to create a great gym coach.
