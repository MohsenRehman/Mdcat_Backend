import { Server } from 'socket.io';

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true, // Dynamically allows any origin (Vercel preview/production/localhost)
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

export const getIO = () => {
  if (!io) {
    console.log('[Serverless IO] Socket.io not initialized in this environment. Returning mock emitter.');
    return {
      emit: (event, data) => console.log(`[Serverless Mock IO] Event '${event}' broadcast suppressed in serverless container.`)
    };
  }
  return io;
};