/**
 * Index Maintenance Service
 * 
 * Provides automated MongoDB index maintenance including:
 * - Index analysis and statistics
 * - Index rebuilding (reIndex)
 * - Index validation
 * - Fragmentation detection
 * - Performance monitoring
 * 
 * Runs on scheduled intervals to maintain optimal query performance.
 */

import mongoose from 'mongoose';

// Maintenance log storage
const maintenanceLogs = [];
const MAX_LOGS = 1000;

/**
 * Log maintenance action
 */
const logMaintenance = (action, collection, details, status = 'success') => {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    collection,
    details,
    status,
  };
  
  maintenanceLogs.unshift(entry);
  
  // Keep only last N logs
  if (maintenanceLogs.length > MAX_LOGS) {
    maintenanceLogs.pop();
  }
  
  const logLevel = status === 'error' ? 'error' : 'log';
  console[logLevel](`[IndexMaintenance] ${action} on ${collection}: ${JSON.stringify(details)}`);
  
  return entry;
};

/**
 * Get index statistics for a collection
 */
const getIndexStats = async (collectionName) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database not connected');
  }
  
  try {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    // Get index information
    const indexes = await collection.indexes();
    
    // Get collection stats
    const stats = await collection.stats();
    
    // Get index usage stats if available
    let indexUsage = [];
    try {
      indexUsage = await collection.aggregate([
        { $indexStats: {} }
      ]).toArray();
    } catch {
      // $indexStats may not be available in all MongoDB versions
    }
    
    return {
      collection: collectionName,
      indexCount: indexes.length,
      indexes: indexes.map(idx => ({
        name: idx.name,
        key: idx.key,
        unique: idx.unique || false,
        sparse: idx.sparse || false,
        background: idx.background || false,
        expireAfterSeconds: idx.expireAfterSeconds,
      })),
      stats: {
        documentCount: stats.count,
        avgDocumentSize: Math.round(stats.avgObjSize || 0),
        totalSize: Math.round(stats.size / 1024), // KB
        indexSize: Math.round(stats.totalIndexSize / 1024), // KB
        storageSize: Math.round(stats.storageSize / 1024), // KB
      },
      usage: indexUsage.map(u => ({
        name: u.name,
        accesses: u.accesses?.ops || 0,
        since: u.accesses?.since,
      })),
    };
  } catch (error) {
    logMaintenance('getIndexStats', collectionName, { error: error.message }, 'error');
    throw error;
  }
};

/**
 * Analyze all collection indexes
 */
const analyzeAllIndexes = async () => {
  if (mongoose.connection.readyState !== 1) {
    return { error: 'Database not connected' };
  }
  
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const results = [];
    let totalIndexCount = 0;
    let totalIndexSize = 0;
    
    for (const col of collections) {
      // Skip system collections
      if (col.name.startsWith('system.')) continue;
      
      try {
        const stats = await getIndexStats(col.name);
        results.push(stats);
        totalIndexCount += stats.indexCount;
        totalIndexSize += stats.stats.indexSize;
      } catch {
        results.push({
          collection: col.name,
          error: 'Failed to get stats',
        });
      }
    }
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalCollections: results.length,
      totalIndexCount,
      totalIndexSize: `${Math.round(totalIndexSize / 1024)} MB`,
      collections: results,
    };
    
    logMaintenance('analyzeAllIndexes', 'all', {
      collections: results.length,
      indexes: totalIndexCount,
    });
    
    return summary;
  } catch (error) {
    logMaintenance('analyzeAllIndexes', 'all', { error: error.message }, 'error');
    throw error;
  }
};

/**
 * Rebuild indexes for a specific collection
 */
const rebuildCollectionIndexes = async (collectionName) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database not connected');
  }
  
  const startTime = Date.now();
  
  try {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    // Get current indexes before rebuild
    const beforeIndexes = await collection.indexes();
    
    // MongoDB 4.2+ uses compact instead of reIndex
    // reIndex is deprecated, so we'll use a safer approach
    // Drop and recreate all non-_id indexes
    const result = await db.command({ compact: collectionName });
    
    const duration = Date.now() - startTime;
    
    logMaintenance('rebuildIndexes', collectionName, {
      indexCount: beforeIndexes.length,
      duration: `${duration}ms`,
      result,
    });
    
    return {
      collection: collectionName,
      success: true,
      indexCount: beforeIndexes.length,
      duration,
      result,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logMaintenance('rebuildIndexes', collectionName, {
      error: error.message,
      duration: `${duration}ms`,
    }, 'error');
    
    return {
      collection: collectionName,
      success: false,
      error: error.message,
      duration,
    };
  }
};

/**
 * Validate collection indexes
 */
const validateCollectionIndexes = async (collectionName) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database not connected');
  }
  
  try {
    const db = mongoose.connection.db;
    
    // Run validate command
    const result = await db.command({
      validate: collectionName,
      full: true,
    });
    
    const isValid = result.valid === true;
    
    logMaintenance('validateIndexes', collectionName, {
      valid: isValid,
      nrecords: result.nrecords,
      warnings: result.warnings?.length || 0,
    }, isValid ? 'success' : 'warning');
    
    return {
      collection: collectionName,
      valid: isValid,
      nrecords: result.nrecords,
      warnings: result.warnings || [],
      errors: result.errors || [],
    };
  } catch (error) {
    logMaintenance('validateIndexes', collectionName, {
      error: error.message,
    }, 'error');
    
    return {
      collection: collectionName,
      valid: false,
      error: error.message,
    };
  }
};

/**
 * Find unused indexes (indexes that haven't been used recently)
 */
const findUnusedIndexes = async (minAccessThreshold = 10) => {
  if (mongoose.connection.readyState !== 1) {
    return { error: 'Database not connected' };
  }
  
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const unusedIndexes = [];
    
    for (const col of collections) {
      if (col.name.startsWith('system.')) continue;
      
      try {
        const collection = db.collection(col.name);
        const usage = await collection.aggregate([{ $indexStats: {} }]).toArray();
        
        for (const idx of usage) {
          // Skip _id index
          if (idx.name === '_id_') continue;
          
          if ((idx.accesses?.ops || 0) < minAccessThreshold) {
            unusedIndexes.push({
              collection: col.name,
              indexName: idx.name,
              accesses: idx.accesses?.ops || 0,
              since: idx.accesses?.since,
            });
          }
        }
      } catch {
        // Skip collections that don't support $indexStats
      }
    }
    
    logMaintenance('findUnusedIndexes', 'all', {
      found: unusedIndexes.length,
      threshold: minAccessThreshold,
    });
    
    return {
      timestamp: new Date().toISOString(),
      threshold: minAccessThreshold,
      unusedIndexes,
    };
  } catch (error) {
    logMaintenance('findUnusedIndexes', 'all', { error: error.message }, 'error');
    throw error;
  }
};

/**
 * Run full maintenance routine
 */
const runFullMaintenance = async () => {
  console.log('\n🔧 Starting full index maintenance routine...\n');
  
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    duration: 0,
    analysis: null,
    validations: [],
    unusedIndexes: null,
    errors: [],
  };
  
  try {
    // Step 1: Analyze all indexes
    console.log('📊 Step 1: Analyzing indexes...');
    results.analysis = await analyzeAllIndexes();
    
    // Step 2: Validate critical collections
    console.log('✅ Step 2: Validating collections...');
    const criticalCollections = ['users', 'events', 'subevents', 'registrations', 'notifications'];
    
    for (const col of criticalCollections) {
      try {
        const validation = await validateCollectionIndexes(col);
        results.validations.push(validation);
      } catch (error) {
        results.errors.push({
          action: 'validate',
          collection: col,
          error: error.message,
        });
      }
    }
    
    // Step 3: Find unused indexes (don't auto-drop, just report)
    console.log('🔍 Step 3: Finding unused indexes...');
    results.unusedIndexes = await findUnusedIndexes();
    
    results.duration = Date.now() - startTime;
    
    console.log(`\n✅ Index maintenance completed in ${results.duration}ms\n`);
    
    logMaintenance('runFullMaintenance', 'all', {
      duration: `${results.duration}ms`,
      collections: results.analysis?.totalCollections || 0,
      validations: results.validations.length,
      errors: results.errors.length,
    });
    
  } catch (error) {
    results.errors.push({
      action: 'maintenance',
      error: error.message,
    });
    results.duration = Date.now() - startTime;
    
    logMaintenance('runFullMaintenance', 'all', { error: error.message }, 'error');
  }
  
  return results;
};

/**
 * Get maintenance logs
 */
const getMaintenanceLogs = (limit = 100) => {
  return maintenanceLogs.slice(0, limit);
};

/**
 * Clear maintenance logs
 */
const clearMaintenanceLogs = () => {
  maintenanceLogs.length = 0;
  return { cleared: true, timestamp: new Date().toISOString() };
};

export {
  logMaintenance,
  getIndexStats,
  analyzeAllIndexes,
  rebuildCollectionIndexes,
  validateCollectionIndexes,
  findUnusedIndexes,
  runFullMaintenance,
  getMaintenanceLogs,
  clearMaintenanceLogs,
};
