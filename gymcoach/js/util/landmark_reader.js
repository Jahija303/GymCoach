// MediaPipe Pose landmark constants
export const LANDMARK = {
    // Face landmarks
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    
    // Upper body landmarks
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    
    // Lower body landmarks
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

export class LandmarkReader {
    constructor(results) {
        this.landmarks = results?.landmarks?.[0] || null;
    }

    getLandmark(landmarkIndex) {
        if (!this.landmarks || !this.landmarks[landmarkIndex]) {
            return false;
        }

        const landmark = this.landmarks[landmarkIndex];
        return landmark.visibility > 0.5 ? landmark : false;
    }

    hasLandmarks() {
        return this.landmarks !== null;
    }

    getRawLandmark(landmarkIndex) {
        return this.landmarks?.[landmarkIndex] || null;
    }
}
