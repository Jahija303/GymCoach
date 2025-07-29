const socket = io.connect("http://localhost:3000");
const localVideo = document.getElementById('localVideo');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const cameraStatus = document.getElementById('status');

let stream = null;
const FPS = 15;
let intervalId = null;

canvas.width = 640;
canvas.height = 480;

async function startCamera() {
    try {
    // Request camera access
    stream = await navigator.mediaDevices.getUserMedia({
        video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: FPS }
        },
        audio: false
    });

    localVideo.srcObject = stream;
    
    startFrameCapture();
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    cameraStatus.textContent = 'Camera started';
    
    } catch (error) {
        console.error('Error accessing camera:', error);
        cameraStatus.textContent = 'Error accessing camera: ' + error.message;
    }
}

function startFrameCapture() {
    intervalId = setInterval(() => {
    if (stream && localVideo.videoWidth > 0) {
        // Draw current video frame to canvas
        ctx.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to base64 image data
        const frameData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Send frame to server
        socket.emit('video-frame', frameData);
    }
    }, 1000 / FPS);
}

function stopCamera() {
    if (stream) {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    
    localVideo.srcObject = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    cameraStatus.textContent = 'Camera stopped';
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

socket.on('connect', () => {
    console.log('Connected to server');
    cameraStatus.textContent = 'Connected to server';
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    cameraStatus.textContent = 'Disconnected from server';
});