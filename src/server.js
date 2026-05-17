import app from './app.js';
import connectDB from './config/db.js';
import http from 'http';
import { initializeSocket } from './sockets/index.js';
import { autoPublishDueResults } from './controllers/result.controller.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Connect to Database and Start Server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Auto-publish results whose scheduled publishDate has passed (check every 60 seconds)
  setInterval(autoPublishDueResults, 60 * 1000);
  console.log('[AutoPublish] Scheduled result release checker started (60s interval)');

}).catch(err => {
  console.error(`Failed to connect to DB: ${err.message}`);
  process.exit(1);
});
