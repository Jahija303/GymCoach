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
});

server.listen(port, () => {
  console.log(`GymCoach app listening at http://localhost:${port}`);
});
