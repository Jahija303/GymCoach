const express = require('express');
const path = require('path');
const app = express();
const server = require("http").Server(app);
const port = 3000;

app.use(express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

server.listen(port, () => {
  console.log(`GymCoach app listening at http://localhost:${port}`);
});
