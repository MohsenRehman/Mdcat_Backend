import app from '../src/app.js';
import connectDB from '../src/config/db.js';

let dbConnected = false;

export default async (req, res) => {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
    } catch (error) {
      console.error('Database connection failed in Vercel serverless function:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Database connection failed.',
        error: error.message,
        hint: 'Please ensure MONGO_URI is set correctly in Vercel Environment Variables and MongoDB Atlas Network Access is set to allow all IPs (0.0.0.0/0).'
      });
    }
  }
  return app(req, res);
};
