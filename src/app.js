import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import mcqRoutes from './routes/mcq.routes.js';
import subjectRoutes from './routes/subject.routes.js';
import examRoutes from './routes/exam.routes.js';
import resultRoutes from './routes/result.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import paymentRoutes from './routes/payment.routes.js';

const app = express();

// Middlewares
app.use(cors(
  {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:',
  }
));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mcqs', mcqRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments', paymentRoutes);

// Root route for Vercel deployment check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'MDCAT Backend API is running successfully on Vercel!',
    version: '1.0.0',
    documentation: 'Visit /health to check server health status.'
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running smoothly' });
});

// Handle undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found - ${req.originalUrl}`
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
