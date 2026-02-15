import cors from 'cors';

const corsOptions: cors.CorsOptions = {
  origin: [
    'http://localhost:8081',
    'http://192.168.0.88:8081',
    'exp://192.168.0.88:8081',
    'http://192.168.0.88:3000',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8082',
    'http://192.168.0.88:8082',
    'exp://192.168.0.88:8082',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

export default corsOptions;
