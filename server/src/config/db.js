/**
 * MongoDB Connection Configuration
 * Handles connection to MongoDB Atlas or local MongoDB instance
 * 
 * Environment Variables:
 * - MONGODB_URI: MongoDB connection string (required)
 *   Examples:
 *   - Atlas: mongodb+srv://username:password@cluster.mongodb.net/dbname
 *   - Local: mongodb://localhost:27017/eventhub
 *   - Linux Server with public IP: mongodb://admin:password@192.168.x.x:27017/eventhub?authSource=admin
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
const DEFAULT_DB_NAME = 'EVENTHUB';

/**
 * Validate MongoDB connection string
 * @throws {Error} If MongoDB URI is not configured
 */
const validateMongoUri = () => {
  if (!mongoUri) {
    const error = new Error(
      'FATAL: MONGODB_URI environment variable is not set.\n' +
      'Please configure one of the following:\n' +
      '1. MongoDB Atlas (cloud): mongodb+srv://username:password@cluster.mongodb.net/dbname\n' +
      '2. Local MongoDB: mongodb://localhost:27017/eventhub\n' +
      '3. Linux Server (public IP): mongodb://admin:password@SERVER_IP:27017/eventhub?authSource=admin\n\n' +
      'Set this in your .env file: MONGODB_URI=your_connection_string'
    );
    console.error(error.message);
    throw error;
  }
};

/**
 * Connect to MongoDB
 * Handles connection attempts with error reporting
 * 
 * @returns {Promise<void>}
 * @throws {Error} If connection fails after retries
 */
export const connectDatabase = async () => {
  try {
    validateMongoUri();

    // ...removed console log for production...
    
    // Mongoose connection options
    const options = {
      dbName: DEFAULT_DB_NAME, // Use EVENTHUB as the default database name
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    };

    await mongoose.connect(mongoUri, options);
    
    // ...removed console log for production...
    
    // Setup connection event handlers
    setupConnectionHandlers();
    
  } catch (err) {
    console.error('✗ MongoDB Connection Error:');
    console.error('  Message:', err.message || err);
    
    // Provide specific guidance based on error type
    if (err.message.includes('ECONNREFUSED')) {
      console.error('\n  → Connection refused. Check if MongoDB is running at the specified address.');
    } else if (err.message.includes('authentication')) {
      console.error('\n  → Authentication failed. Verify username and password in MONGODB_URI.');
    } else if (err.message.includes('getaddrinfo')) {
      console.error('\n  → Host resolution failed. Check the server address/hostname.');
    } else if (err.message.includes('ETIMEDOUT')) {
      console.error('\n  → Connection timeout. The server may be unreachable or slow.');
    }
    
    console.error('\n  Fix: Update MONGODB_URI in your .env file and restart the server.');
    
    throw err;
  }
};

/**
 * Setup MongoDB connection event handlers
 */
const setupConnectionHandlers = () => {
  mongoose.connection.on('connected', () => {
    // ...removed console log for production...
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    // ...removed console log for production...
  });
};

/**
 * Close MongoDB connection gracefully
 * @returns {Promise<void>}
 */
export const disconnectDatabase = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      // ...removed console log for production...
    }
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    throw err;
  }
};

/**
 * Get MongoDB GridFS Bucket for file storage
 * @param {string} bucketName - Name of the GridFS bucket
 * @returns {object} GridFSBucket instance
 */
export const getGridFSBucket = (bucketName = 'eventImages') => {
  if (!mongoose.connection.db) {
    throw new Error('Database not connected. Cannot create GridFS bucket.');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
};

/**
 * Check if MongoDB connection is healthy
 * @returns {boolean} True if connected and responsive
 */
export const isDBHealthy = async () => {
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (err) {
    console.error('Database health check failed:', err.message);
    return false;
  }
};

export default {
  connectDatabase,
  disconnectDatabase,
  getGridFSBucket,
  isDBHealthy
};
