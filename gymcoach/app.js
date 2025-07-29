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
    const averageColor = await calculateAverageColor(buffer);

    socket.emit('average-color', averageColor);
    console.log(await sharp(buffer).metadata());
  });
});

server.listen(port, () => {
  console.log(`GymCoach app listening at http://localhost:${port}`);
});

async function calculateAverageColor(binaryBuffer) {
  try {
    const { dominant } = await sharp(binaryBuffer)
      .stats();
    
    return {
      r: Math.round(dominant.r),
      g: Math.round(dominant.g),
      b: Math.round(dominant.b)
    };
  } catch (error) {
    console.error('Error calculating average color:', error);
  }
}