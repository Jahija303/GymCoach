const express = require('express');
const path = require('path');
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const sharp = require('sharp');
const port = 3000;

app.use(express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('video-frame', async (frameData) => {
    console.log('Received video frame from client');
    const buffer = Buffer.from(frameData.split(',')[1], 'base64');
    const processedFrame = await downsampleFrame(buffer);

    socket.emit('processed-frame', processedFrame);
  });
});

server.listen(port, () => {
  console.log(`GymCoach app listening at http://localhost:${port}`);
});

async function downsampleFrame(binaryBuffer) {
  try {
    const metadata = await sharp(binaryBuffer).metadata();
    
    const downsampledBuffer = await sharp(binaryBuffer)
      .resize(Math.floor(metadata.width / 2), Math.floor(metadata.height / 2), {
        kernel: 'nearest' // Use nearest neighbor for pixelated effect
      })
      .grayscale() // Convert to grayscale
      // .tint({ r: 255, g: 100, b: 100 }) // Red tint
      // .modulate({ brightness: 1.2, saturation: 0.5, hue: 180 }) // Adjust brightness, saturation, hue
      // .negate() // Invert colors
      // .sepia() // Sepia tone (requires newer Sharp version)
      .jpeg({ quality: 40 })
      .toBuffer();

    // Convert back to base64 data URL
    const base64 = downsampledBuffer.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error downsampling frame:', error);
    return null;
  }
}