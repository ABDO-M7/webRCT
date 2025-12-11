const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
  socket.on('join', room => {
    const clients = io.sockets.adapter.rooms.get(room);
    const numClients = clients ? clients.size : 0;

    if (numClients === 0) {
      socket.join(room);
      socket.emit('created', room);
    } else if (numClients === 1) {
      socket.join(room);
      socket.emit('joined', room);
      socket.to(room).emit('ready');
    } else {
      socket.emit('full', room);
    }
  });

  socket.on('offer', (room, offer) => {
    socket.to(room).emit('offer', offer);
  });

  socket.on('answer', (room, answer) => {
    socket.to(room).emit('answer', answer);
  });

  socket.on('ice-candidate', (room, candidate) => {
    socket.to(room).emit('ice-candidate', candidate);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
