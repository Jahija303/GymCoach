import { LANDMARK_NAMES } from './pose.js';

// This class handles all camera-related functionality
export class Camera {
    constructor() {
        this.stream = null;
        this.devices = null;
    }

    // Must be async to get camera permissions
    // Initialize wrappers creates the video boxes and the canvas on which the pose data will be drawn
    // InitializeTables creates the tables in which the keypoint data xyz will be displayed
    async initializeDevices() {
        this.COLORS = [
            0xffff00, // Yellow
            0xff0000, // Red
            0x0000ff, // Blue
            0x00ff00, // Green
        ]
        this.devices = await this.getCameraDevices();
        this.initializeCameraWrappers();
        this.initializeTables(this.devices.map(device => device.label));
    }

    // Create camera wrapper html elements and assing camera IDs to the video elements
    createCameraWrapper(device, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'wrapper';
        
        const label = document.createElement('label');
        label.textContent = device.label || `Camera ${index}`;
        
        const videoSection = document.createElement('div');
        videoSection.className = 'video-section';
        
        const video = document.createElement('video');
        video.id = `localVideo${index}`;
        video.className = 'local-video';
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        
        const canvas = document.createElement('canvas');
        canvas.id = `poseCanvas${index}`;
        canvas.className = 'pose-canvas';

        videoSection.appendChild(video);
        videoSection.appendChild(canvas);
        
        wrapper.appendChild(label);
        wrapper.appendChild(videoSection);
        
        return wrapper;
    }

    // For each camera device, create a video wrapper
    initializeCameraWrappers() {
        const videoContainer = document.getElementById('video-container');

        this.devices.forEach((device, index) => {
            const wrapper = this.createCameraWrapper(device, index);
            videoContainer.prepend(wrapper);
        });
    }

    // For each camera device, create a table to display pose data
    initializeTables(cameras) {
        const dataSection = document.getElementById('data-section');
        cameras.forEach(camera => {
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-container';

            const table = document.createElement('table');
            table.id = camera;
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            const headers = [camera, 'X', 'Y', 'Z', 'V'];
            headers.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);
            const tbody = document.createElement('tbody');
            for (let i = 0; i < 33; i++) {
                const row = document.createElement('tr');
                row.insertCell(0).textContent = LANDMARK_NAMES[i];
                row.insertCell(1).textContent = '-';
                row.insertCell(2).textContent = '-';
                row.insertCell(3).textContent = '-';
                row.insertCell(4).textContent = '-';
                tbody.appendChild(row);
            }
            tableContainer.appendChild(table);
            table.appendChild(thead);
            table.appendChild(tbody);

            dataSection.appendChild(tableContainer);
        })
    }

    // Update pose data table
    updateTableData(tableId, results) {
        const tableBody = document.getElementById(tableId);
        const rows = tableBody.rows;

        if (results && results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            for (let i = 0; i < landmarks.length && i < 33; i++) {
            const landmark = landmarks[i];
            if (rows[i]) {
                rows[i].cells[1].textContent = landmark.x.toFixed(2);
                rows[i].cells[2].textContent = landmark.y.toFixed(2);
                rows[i].cells[3].textContent = landmark.z.toFixed(2);
                rows[i].cells[4].textContent = landmark.visibility ? landmark.visibility.toFixed(2) : '-';

                // Highlight row in red if visibility is less than 0.5
                if (landmark.visibility && landmark.visibility < 0.5) {
                rows[i].classList.add('low-visibility');
                } else {
                rows[i].classList.remove('low-visibility');
                }
            }
            }
        } else {
            // Clear data if no landmarks detected
            for (let i = 0; i < rows.length; i++) {
            if (rows[i]) {
                rows[i].cells[1].textContent = '-';
                rows[i].cells[2].textContent = '-';
                rows[i].cells[3].textContent = '-';
                rows[i].cells[4].textContent = '-';
                // Remove highlighting when no data
                rows[i].classList.remove('low-visibility');
            }
            }
        }
    }

    async askForPermissions() {
        try {
            var constraints = {video: true, audio: false};
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);  
        } catch (error) {
            console.log(error);
        }

        if (this.stream){
            this.stream.getTracks().forEach(track => track.stop());
        }
    }

    async getCameraDevices() {
        await this.askForPermissions();
        var allDevices = await navigator.mediaDevices.enumerateDevices();
        var cameraDevices = [];
        for (var i = 0; i < allDevices.length; i++) {
            var device = allDevices[i];
            device.color = this.COLORS[i];
            if (device.kind == 'videoinput') {
                cameraDevices.push(device);
            }
        }
        return cameraDevices;
    }
}