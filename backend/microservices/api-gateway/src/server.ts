import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
// import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import winston from 'winston';
import { PortManager, getDatabase } from '@ivorian-realty/shared-lib';
import { 
  validateRegistration, 
  validateLogin, 
  // validatePropertySearch,
  handleValidationErrors, 
  sanitizeRequest 
} from './middleware/validation.js';
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import { authenticateToken, optionalAuth, AuthenticatedRequest } from './middleware/auth.js';
import { AuthService } from './services/authService.js';
import { PropertyService } from './services/propertyService.js';
import { seedDatabase } from './utils/seedData.js';

// Load environment variables
dotenv.config();

const app = express();
const portManager = PortManager.getInstance();
const authService = new AuthService();
const propertyService = new PropertyService();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization
app.use(sanitizeRequest);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api-gateway'
  });
});

// Authentication endpoints with validation and MongoDB integration
app.post('/api/auth/register', 
  validateRegistration, 
  handleValidationErrors, 
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  })
);

app.post('/api/auth/login', 
  validateLogin, 
  handleValidationErrors, 
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json(result);
  })
);

app.get('/api/auth/me', 
  authenticateToken, 
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await authService.getCurrentUser(req.user!.userId);
    res.status(200).json({
      success: true,
      data: user
    });
  })
);

app.put('/api/auth/profile', 
  authenticateToken, 
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  })
);

app.post('/api/auth/change-password', 
  authenticateToken, 
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

// Property endpoints with validation and MongoDB integration
app.get('/api/properties', 
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      search: req.query.search as string,
      type: req.query.type as string,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      city: req.query.city as string,
      bedrooms: req.query.bedrooms ? Number(req.query.bedrooms) : undefined,
      bathrooms: req.query.bathrooms ? Number(req.query.bathrooms) : undefined,
      status: req.query.status as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 10
    };
    
    const result = await propertyService.getAllProperties(filters);
    res.status(200).json(result);
  })
);

app.get('/api/properties/:id', 
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await propertyService.getPropertyById(req.params.id);
    res.status(200).json(result);
  })
);

app.post('/api/properties', 
  authenticateToken, 
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const propertyData = {
      ...req.body,
      ownerId: req.user!.userId
    };
    const result = await propertyService.createProperty(propertyData);
    res.status(201).json(result);
  })
);

app.put('/api/properties/:id', 
  authenticateToken, 
  asyncHandler(async (req: Request, res: Response) => {
    const result = await propertyService.updateProperty(req.params.id, req.body);
    res.status(200).json(result);
  })
);

app.delete('/api/properties/:id', 
  authenticateToken, 
  asyncHandler(async (req: Request, res: Response) => {
    const result = await propertyService.deleteProperty(req.params.id);
    res.status(200).json(result);
  })
);

app.get('/api/properties/owner/:ownerId', 
  authenticateToken, 
  asyncHandler(async (req: Request, res: Response) => {
    const result = await propertyService.getPropertiesByOwner(req.params.ownerId);
    res.status(200).json(result);
  })
);

// Proxy configuration will be set up in startServer function

// Default route
app.get('/', (_req, res) => {
  res.json({
    message: 'Ivorian Realty API Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      properties: '/api/properties'
    }
  });
});

// 404 handler
app.use('*', notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await getDatabase();
    logger.info('Connected to MongoDB');

    // Seed database with sample data (non-blocking)
    seedDatabase().catch((error) => {
      logger.warn('Database seeding failed (non-critical):', error);
    });

    // Initialize port configuration
    await portManager.initializePorts();
    
    // Get the assigned port for API Gateway (use env PORT if set, otherwise use portManager)
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : (portManager.getPort('api-gateway') || 3000);

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway server running on port ${PORT}`);
  console.log(`🚀 API Gateway running on http://localhost:${PORT}`);
      console.log(`📊 MongoDB connected successfully`);
      console.log(`🔐 Authentication endpoints: /api/auth/*`);
      console.log(`🏠 Property endpoints: /api/properties/*`);
    });

  } catch (error) {
    logger.error('Failed to start API Gateway:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
