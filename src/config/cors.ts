import type cors from 'cors';

const allowedOrigins = [
  // Production
  process.env.CLIENT_APP_URL,
  process.env.VENDOR_APP_URL,
  process.env.ADMIN_APP_URL,
  // Development
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
].filter(Boolean) as string[];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

export default corsOptions;
