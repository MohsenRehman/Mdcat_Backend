import app from '../src/app.js';
import connectDB from '../src/config/db.js';

let dbConnected = false;

export default async (req, res) => {
  // 1. Attach CORS headers immediately to the Vercel Serverless Response object
  // This ensures that even if DB connection fails or OPTIONS preflight is requested, CORS headers are always present.
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 2. Intercept OPTIONS preflight requests instantly before establishing MongoDB connection
  // This eliminates cold-start delays for preflight requests and prevents Vercel 504/CORS errors.
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Establish Database Connection for actual API requests (GET/POST/PUT/DELETE)
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
