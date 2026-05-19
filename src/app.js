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

// Helper to extract base origin from a URL (e.g. extracts 'https://mdcat-frontend.vercel.app' from 'https://mdcat-frontend.vercel.app/login')
const getBaseOrigin = (url) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (err) {
    return url.replace(/\/$/, '');
  }
};

// Configured allowed origins
const allowedOrigins = [
  'https://mdcat-frontend.vercel.app',
  getBaseOrigin(process.env.FRONTEND_URL),
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.vercel.app') || 
                      process.env.NODE_ENV === 'development';
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
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

// Handle Socket.io polling fallback in Vercel Serverless environment to prevent scary CORS/404 console errors
app.use('/socket.io', (req, res) => {
  res.status(200).json({
    code: 0,
    message: "WebSockets not supported in Vercel Serverless environment."
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
