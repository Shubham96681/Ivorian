import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';
import { PortManager, getDatabase } from '@ivorian-realty/shared-lib';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

const app = express();
const portManager = PortManager.getInstance();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

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
app.use((req, _res, next) => {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  next();
});

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

// Input sanitization function
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
}

// Validation functions
function validateRegistration(req: any, res: any, next: any) {
  const { firstName, lastName, email, password, role } = req.body;
  const errors: any[] = [];

  if (!firstName || firstName.length < 2) {
    errors.push({ field: 'firstName', message: 'First name is required and must be at least 2 characters' });
  }
  if (!lastName || lastName.length < 2) {
    errors.push({ field: 'lastName', message: 'Last name is required and must be at least 2 characters' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }
  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }
  if (!role || !['buyer', 'seller', 'agent', 'admin'].includes(role)) {
    errors.push({ field: 'role', message: 'Valid role is required' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  next();
}

function validateLogin(req: any, res: any, next: any) {
  const { email, password } = req.body;
  const errors: any[] = [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }
  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  next();
}

// Authentication endpoints
app.post('/api/auth/register', validateRegistration, async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phone } = req.body;
    
    const db = await getDatabase();
    const users = db.collection('users');

    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      phone: phone || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await users.insertOne(newUser);
    const userId = result.insertedId.toString();

    // Generate JWT token
    const token = jwt.sign(
      { userId, email, role },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          _id: userId,
          firstName,
          lastName,
          email,
          role,
          phone: phone || ''
        }
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

app.post('/api/auth/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const db = await getDatabase();
    const users = db.collection('users');

    // Find user
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          phone: user.phone || ''
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const db = await getDatabase();
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone || ''
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Property endpoints
app.get('/api/properties', async (req, res) => {
  try {
    const db = await getDatabase();
    const properties = db.collection('properties');
    
    const {
      search,
      type,
      minPrice,
      maxPrice,
      city,
      status = 'available',
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query: any = { status };
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (type) {
      query.type = type;
    }
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    if (city) {
      query['location.city'] = { $regex: city, $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await properties.countDocuments(query);
    const propertiesList = await properties
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    res.status(200).json({
      success: true,
      message: 'Properties retrieved successfully',
      data: {
        properties: propertiesList,
        total,
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    logger.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve properties'
    });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const properties = db.collection('properties');
    const property = await properties.findOne({ _id: new ObjectId(req.params.id) });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Property retrieved successfully',
      data: property
    });
  } catch (error) {
    logger.error('Get property error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve property'
    });
  }
});

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
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((error: any, _req: any, res: any, _next: any) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await getDatabase();
    logger.info('Connected to MongoDB');

    // Initialize port configuration
    await portManager.initializePorts();
    
    // Get the assigned port for API Gateway
    const PORT = portManager.getPort('api-gateway') || 8000;

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
