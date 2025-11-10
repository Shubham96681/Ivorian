import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import winston from 'winston';
import { PortManager, getDatabase } from '@ivorian-realty/shared-lib';
import { Collection } from 'mongodb';

// Load environment variables
dotenv.config();

const app = express();
const portManager = PortManager.getInstance();

// Database collection
let propertiesCollection: Collection;

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
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'property-service'
  });
});

// Database will be initialized in startServer function
// Sample properties will be inserted if collection is empty

// Get all properties
app.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, minPrice, maxPrice, bedrooms } = req.query;
    
    // Build filter query
    const filter: any = {};
    
    if (type) {
      filter.type = type;
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice as string);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice as string);
    }
    
    if (bedrooms) {
      filter.bedrooms = { $gte: parseInt(bedrooms as string) };
    }
    
    // Get total count
    const total = await propertiesCollection.countDocuments(filter);
    
    // Get paginated results
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const properties = await propertiesCollection
      .find(filter)
      .skip(skip)
      .limit(parseInt(limit as string))
      .toArray();
    
    return res.json({
      success: true,
      data: properties,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
    
  } catch (error) {
    logger.error('Get properties error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get property by ID
app.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const property = await propertiesCollection.findOne({ id });
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }
    
    return res.json({
      success: true,
      data: property
    });
    
  } catch (error) {
    logger.error('Get property error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new property
app.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      location,
      type,
      bedrooms,
      bathrooms,
      squareFeet,
      images,
      agentId
    } = req.body;
    
    // Validate required fields
    if (!title || !description || !price || !location || !type || !bedrooms || !bathrooms || !agentId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }
    
    const property = {
      id: uuidv4(),
      title,
      description,
      price: parseInt(price),
      location,
      type,
      bedrooms: parseInt(bedrooms),
      bathrooms: parseInt(bathrooms),
      squareFeet: parseInt(squareFeet) || 0,
      images: images || [],
      agentId,
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await propertiesCollection.insertOne(property);
    
    return res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: property
    });
    
  } catch (error) {
    logger.error('Create property error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Search properties
app.get('/search', async (req, res) => {
  try {
    const { q, city, type, minPrice, maxPrice } = req.query;
    
    // Build filter query
    const filter: any = {};
    
    // Text search
    if (q) {
      const searchTerm = (q as string).toLowerCase();
      filter.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { 'location.city': { $regex: searchTerm, $options: 'i' } },
        { 'location.address': { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // City filter
    if (city) {
      filter['location.city'] = { $regex: new RegExp(`^${city}$`, 'i') };
    }
    
    // Type filter
    if (type) {
      filter.type = type;
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice as string);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice as string);
    }
    
    const properties = await propertiesCollection.find(filter).toArray();
    
    return res.json({
      success: true,
      data: properties,
      total: properties.length
    });
    
  } catch (error) {
    logger.error('Search properties error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize port configuration
    await portManager.initializePorts();
    
    // Initialize MongoDB connection
    const db = await getDatabase();
    propertiesCollection = db.collection('properties');
    
    // Create indexes for better performance
    try {
      // Drop old problematic id index if it exists
      try {
        await propertiesCollection.dropIndex('id_1');
      } catch (e) {
        // Index doesn't exist, ignore
      }
      await propertiesCollection.createIndex({ type: 1 });
      await propertiesCollection.createIndex({ price: 1 });
      await propertiesCollection.createIndex({ 'location.city': 1 });
      await propertiesCollection.createIndex({ title: 'text', description: 'text' });
    } catch (error: any) {
      // Index might already exist, continue
      if (error.code !== 85 && error.code !== 11000) {
        logger.warn('Index creation warning:', error.message);
      }
    }
    
    // Insert sample data if collection is empty
    const count = await propertiesCollection.countDocuments();
    if (count === 0) {
      const sampleProperties = [
        {
          id: uuidv4(),
          title: 'Beautiful Family Home',
          description: 'A spacious 4-bedroom family home with a large backyard and modern amenities.',
          price: 450000,
          location: {
            address: '123 Main Street',
            city: 'Abidjan',
            state: 'Abidjan',
            zipCode: '00225',
            coordinates: {
              lat: 5.3599,
              lng: -4.0083
            }
          },
          type: 'house',
          bedrooms: 4,
          bathrooms: 3,
          squareFeet: 2500,
          images: [
            'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
            'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800'
          ],
          agentId: 'agent-1',
          status: 'available',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: uuidv4(),
          title: 'Modern Apartment in City Center',
          description: 'Contemporary 2-bedroom apartment with city views and premium finishes.',
          price: 280000,
          location: {
            address: '456 Business District',
            city: 'Abidjan',
            state: 'Abidjan',
            zipCode: '00225',
            coordinates: {
              lat: 5.3600,
              lng: -4.0080
            }
          },
          type: 'apartment',
          bedrooms: 2,
          bathrooms: 2,
          squareFeet: 1200,
          images: [
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
            'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800'
          ],
          agentId: 'agent-2',
          status: 'available',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      await propertiesCollection.insertMany(sampleProperties);
      console.log('✅ Sample properties inserted');
    }
    
    console.log('✅ MongoDB connected and indexes created');
    
    // Get the assigned port for Property Service (prioritize env PORT)
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : (portManager.getPort('property-service') || 3002);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Property service server running on port ${PORT}`);
      console.log(`🏠 Property service running on http://localhost:${PORT}`);
      console.log(`🗄️ MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017'}`);
    });

  } catch (error) {
    logger.error('Failed to start Property Service:', error);
    console.error('❌ MongoDB connection failed. Make sure MongoDB is running.');
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
