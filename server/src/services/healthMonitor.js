/**
 * Health Monitoring Service
 * 
 * Provides comprehensive automated health monitoring for the EventHub application.
 * Features:
 * - Server health monitoring (CPU, memory, disk)
 * - Database health and performance metrics
 * - API endpoint health checks
 * - Error rate tracking
 * - Response time monitoring
 * - Automated crash prevention
 * - Storage capacity monitoring
 */

import os from 'os';
import mongoose from 'mongoose';

// Health thresholds
const THRESHOLDS = {
  CPU_WARNING: 70,           // 70% CPU usage
  CPU_CRITICAL: 90,          // 90% CPU usage
  MEMORY_WARNING: 75,        // 75% memory usage
  MEMORY_CRITICAL: 90,       // 90% memory usage
  DISK_WARNING: 80,          // 80% disk usage
  DISK_CRITICAL: 95,         // 95% disk usage
  DB_RESPONSE_WARNING: 1000, // 1 second
  DB_RESPONSE_CRITICAL: 5000,// 5 seconds
  API_RESPONSE_WARNING: 2000,// 2 seconds
  API_RESPONSE_CRITICAL: 5000,// 5 seconds
  ERROR_RATE_WARNING: 1,     // 1% error rate
  ERROR_RATE_CRITICAL: 5,    // 5% error rate
  HEAP_WARNING: 80,          // 80% heap used
  HEAP_CRITICAL: 95,         // 95% heap used
};

// Metrics storage
let metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    responseTimes: [],
  },
  errors: [],
  lastCheck: null,
  status: 'healthy',
  alerts: [],
};

// Sliding window for metrics (last 5 minutes)
const METRICS_WINDOW = 5 * 60 * 1000;

/**
 * Get current CPU usage percentage
 */
const getCpuUsage = () => {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idlePercent = totalIdle / totalTick * 100;
  return Math.round((100 - idlePercent) * 100) / 100;
};

/**
 * Get memory usage statistics
 */
const getMemoryUsage = () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = (usedMemory / totalMemory) * 100;

  // Process-specific memory
  const processMemory = process.memoryUsage();
  const heapUsedPercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;

  return {
    total: Math.round(totalMemory / (1024 * 1024 * 1024) * 100) / 100,
    used: Math.round(usedMemory / (1024 * 1024 * 1024) * 100) / 100,
    free: Math.round(freeMemory / (1024 * 1024 * 1024) * 100) / 100,
    usagePercent: Math.round(usagePercent * 100) / 100,
    process: {
      heapTotal: Math.round(processMemory.heapTotal / (1024 * 1024) * 100) / 100,
      heapUsed: Math.round(processMemory.heapUsed / (1024 * 1024) * 100) / 100,
      heapUsedPercent: Math.round(heapUsedPercent * 100) / 100,
      external: Math.round(processMemory.external / (1024 * 1024) * 100) / 100,
      rss: Math.round(processMemory.rss / (1024 * 1024) * 100) / 100,
    },
  };
};

/**
 * Check database health and connection
 */
const checkDatabaseHealth = async () => {
  const start = Date.now();
  let status = 'healthy';
  let responseTime = 0;
  let connectionState = 'unknown';
  let error = null;

  try {
    // Check connection state
    connectionState = mongoose.connection.readyState === 1 ? 'connected' : 
                     mongoose.connection.readyState === 2 ? 'connecting' :
                     mongoose.connection.readyState === 3 ? 'disconnecting' : 'disconnected';

    if (mongoose.connection.readyState === 1) {
      // Ping database
      await mongoose.connection.db.admin().ping();
      responseTime = Date.now() - start;

      if (responseTime > THRESHOLDS.DB_RESPONSE_CRITICAL) {
        status = 'critical';
      } else if (responseTime > THRESHOLDS.DB_RESPONSE_WARNING) {
        status = 'warning';
      }
    } else {
      status = 'critical';
      error = 'Database not connected';
    }
  } catch (err) {
    status = 'critical';
    error = err.message;
    responseTime = Date.now() - start;
  }

  return {
    status,
    connectionState,
    responseTime,
    error,
  };
};

/**
 * Get database statistics
 */
const getDatabaseStats = async () => {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    
    return {
      collections: stats.collections,
      objects: stats.objects,
      dataSize: Math.round(stats.dataSize / (1024 * 1024) * 100) / 100, // MB
      storageSize: Math.round(stats.storageSize / (1024 * 1024) * 100) / 100, // MB
      indexSize: Math.round(stats.indexSize / (1024 * 1024) * 100) / 100, // MB
      totalSize: Math.round((stats.dataSize + stats.indexSize) / (1024 * 1024) * 100) / 100, // MB
    };
  } catch (error) {
    console.error('Error getting database stats:', error.message);
    return null;
  }
};

/**
 * Record API request metrics
 */
const recordRequest = (success, responseTime, errorMessage = null) => {
  const now = Date.now();
  
  metrics.requests.total++;
  if (success) {
    metrics.requests.success++;
  } else {
    metrics.requests.errors++;
    if (errorMessage) {
      metrics.errors.push({
        time: now,
        message: errorMessage,
      });
    }
  }
  
  metrics.requests.responseTimes.push({
    time: now,
    value: responseTime,
  });

  // Clean up old metrics outside the sliding window
  const cutoff = now - METRICS_WINDOW;
  metrics.requests.responseTimes = metrics.requests.responseTimes.filter(r => r.time > cutoff);
  metrics.errors = metrics.errors.filter(e => e.time > cutoff);
};

/**
 * Calculate error rate from recent requests
 */
const getErrorRate = () => {
  const now = Date.now();
  const cutoff = now - METRICS_WINDOW;
  
  const recentErrors = metrics.errors.filter(e => e.time > cutoff).length;
  const recentTotal = metrics.requests.responseTimes.filter(r => r.time > cutoff).length;
  
  if (recentTotal === 0) return 0;
  return Math.round((recentErrors / recentTotal) * 100 * 100) / 100;
};

/**
 * Get average response time
 */
const getAverageResponseTime = () => {
  const now = Date.now();
  const cutoff = now - METRICS_WINDOW;
  
  const recentTimes = metrics.requests.responseTimes.filter(r => r.time > cutoff);
  if (recentTimes.length === 0) return 0;
  
  const sum = recentTimes.reduce((acc, r) => acc + r.value, 0);
  return Math.round(sum / recentTimes.length);
};

/**
 * Perform comprehensive health check
 */
const performHealthCheck = async () => {
  const alerts = [];
  let overallStatus = 'healthy';

  // CPU check
  const cpuUsage = getCpuUsage();
  if (cpuUsage > THRESHOLDS.CPU_CRITICAL) {
    alerts.push({
      severity: 'critical',
      type: 'cpu',
      message: `Critical CPU usage: ${cpuUsage}%`,
      value: cpuUsage,
      threshold: THRESHOLDS.CPU_CRITICAL,
    });
    overallStatus = 'critical';
  } else if (cpuUsage > THRESHOLDS.CPU_WARNING) {
    alerts.push({
      severity: 'warning',
      type: 'cpu',
      message: `High CPU usage: ${cpuUsage}%`,
      value: cpuUsage,
      threshold: THRESHOLDS.CPU_WARNING,
    });
    if (overallStatus === 'healthy') overallStatus = 'warning';
  }

  // Memory check
  const memory = getMemoryUsage();
  if (memory.usagePercent > THRESHOLDS.MEMORY_CRITICAL) {
    alerts.push({
      severity: 'critical',
      type: 'memory',
      message: `Critical memory usage: ${memory.usagePercent}%`,
      value: memory.usagePercent,
      threshold: THRESHOLDS.MEMORY_CRITICAL,
    });
    overallStatus = 'critical';
  } else if (memory.usagePercent > THRESHOLDS.MEMORY_WARNING) {
    alerts.push({
      severity: 'warning',
      type: 'memory',
      message: `High memory usage: ${memory.usagePercent}%`,
      value: memory.usagePercent,
      threshold: THRESHOLDS.MEMORY_WARNING,
    });
    if (overallStatus === 'healthy') overallStatus = 'warning';
  }

  // Heap check
  if (memory.process.heapUsedPercent > THRESHOLDS.HEAP_CRITICAL) {
    alerts.push({
      severity: 'critical',
      type: 'heap',
      message: `Critical heap usage: ${memory.process.heapUsedPercent}%`,
      value: memory.process.heapUsedPercent,
      threshold: THRESHOLDS.HEAP_CRITICAL,
    });
    overallStatus = 'critical';
    
    // Attempt garbage collection if available
    if (global.gc) {
      // ...removed console log for production...
      global.gc();
    }
  } else if (memory.process.heapUsedPercent > THRESHOLDS.HEAP_WARNING) {
    alerts.push({
      severity: 'warning',
      type: 'heap',
      message: `High heap usage: ${memory.process.heapUsedPercent}%`,
      value: memory.process.heapUsedPercent,
      threshold: THRESHOLDS.HEAP_WARNING,
    });
    if (overallStatus === 'healthy') overallStatus = 'warning';
  }

  // Database check
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.status === 'critical') {
    alerts.push({
      severity: 'critical',
      type: 'database',
      message: dbHealth.error || `Database response time: ${dbHealth.responseTime}ms`,
      value: dbHealth.responseTime,
      threshold: THRESHOLDS.DB_RESPONSE_CRITICAL,
    });
    overallStatus = 'critical';
  } else if (dbHealth.status === 'warning') {
    alerts.push({
      severity: 'warning',
      type: 'database',
      message: `Slow database response: ${dbHealth.responseTime}ms`,
      value: dbHealth.responseTime,
      threshold: THRESHOLDS.DB_RESPONSE_WARNING,
    });
    if (overallStatus === 'healthy') overallStatus = 'warning';
  }

  // Error rate check
  const errorRate = getErrorRate();
  if (errorRate > THRESHOLDS.ERROR_RATE_CRITICAL) {
    alerts.push({
      severity: 'critical',
      type: 'error_rate',
      message: `Critical error rate: ${errorRate}%`,
      value: errorRate,
      threshold: THRESHOLDS.ERROR_RATE_CRITICAL,
    });
    overallStatus = 'critical';
  } else if (errorRate > THRESHOLDS.ERROR_RATE_WARNING) {
    alerts.push({
      severity: 'warning',
      type: 'error_rate',
      message: `High error rate: ${errorRate}%`,
      value: errorRate,
      threshold: THRESHOLDS.ERROR_RATE_WARNING,
    });
    if (overallStatus === 'healthy') overallStatus = 'warning';
  }

  // Response time check
  const avgResponseTime = getAverageResponseTime();
  if (avgResponseTime > THRESHOLDS.API_RESPONSE_CRITICAL) {
    alerts.push({
      severity: 'critical',
      type: 'response_time',
      message: `Critical API response time: ${avgResponseTime}ms`,
      value: avgResponseTime,
      threshold: THRESHOLDS.API_RESPONSE_CRITICAL,
    });
    overallStatus = 'critical';
  } else if (avgResponseTime > THRESHOLDS.API_RESPONSE_WARNING) {
    alerts.push({
      severity: 'warning',
      type: 'response_time',
      message: `Slow API response time: ${avgResponseTime}ms`,
      value: avgResponseTime,
      threshold: THRESHOLDS.API_RESPONSE_WARNING,
    });
    if (overallStatus === 'healthy') overallStatus = 'warning';
  }

  // Update metrics
  metrics.lastCheck = new Date().toISOString();
  metrics.status = overallStatus;
  metrics.alerts = alerts;

  return {
    status: overallStatus,
    timestamp: metrics.lastCheck,
    alerts,
    system: {
      cpu: cpuUsage,
      memory,
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    },
    database: {
      ...dbHealth,
      stats: await getDatabaseStats(),
    },
    api: {
      totalRequests: metrics.requests.total,
      successfulRequests: metrics.requests.success,
      failedRequests: metrics.requests.errors,
      errorRate,
      averageResponseTime: avgResponseTime,
    },
  };
};

/**
 * Get current health status (lightweight check)
 */
const getHealthStatus = () => {
  return {
    status: metrics.status,
    lastCheck: metrics.lastCheck,
    alerts: metrics.alerts.filter(a => a.severity === 'critical'),
  };
};

/**
 * Get full metrics
 */
const getMetrics = () => {
  return {
    ...metrics,
    errorRate: getErrorRate(),
    averageResponseTime: getAverageResponseTime(),
  };
};

/**
 * Reset metrics (for testing or maintenance)
 */
const resetMetrics = () => {
  metrics = {
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      responseTimes: [],
    },
    errors: [],
    lastCheck: null,
    status: 'healthy',
    alerts: [],
  };
};

export {
  THRESHOLDS,
  getCpuUsage,
  getMemoryUsage,
  checkDatabaseHealth,
  getDatabaseStats,
  recordRequest,
  getErrorRate,
  getAverageResponseTime,
  performHealthCheck,
  getHealthStatus,
  getMetrics,
  resetMetrics,
};
