/**
 * Background Job Service
 * 
 * Handles long-running tasks in the background:
 * - Email notifications (with progress tracking)
 * - Cache warming
 * - Data aggregation
 * - Cleanup tasks
 * 
 * Uses event emitter pattern for job status updates via WebSocket
 */

import { EventEmitter } from 'events';

class BackgroundJobService extends EventEmitter {
  constructor() {
    super();
    this.activeJobs = new Map();
    this.jobHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Create a new background job
   */
  createJob(type, metadata = {}) {
    const jobId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job = {
      id: jobId,
      type,
      status: 'pending',
      progress: 0,
      total: 0,
      completed: 0,
      failed: 0,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      errors: []
    };
    this.activeJobs.set(jobId, job);
    return job;
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId, completed, failed = 0) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.completed = completed;
    job.failed = failed;
    job.progress = job.total > 0 ? Math.round((completed / job.total) * 100) : 0;
    job.updatedAt = new Date();

    // Emit progress update
    this.emit('jobProgress', {
      jobId,
      type: job.type,
      progress: job.progress,
      completed: job.completed,
      failed: job.failed,
      total: job.total,
      metadata: job.metadata
    });

    return job;
  }

  /**
   * Set job total
   */
  setJobTotal(jobId, total) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    job.total = total;
    job.status = 'running';
    job.updatedAt = new Date();
    return job;
  }

  /**
   * Complete a job
   */
  completeJob(jobId, status = 'completed') {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.progress = 100;
    job.completedAt = new Date();
    job.updatedAt = new Date();

    // Move to history
    this.jobHistory.unshift(job);
    if (this.jobHistory.length > this.maxHistorySize) {
      this.jobHistory.pop();
    }
    this.activeJobs.delete(jobId);

    // Emit completion
    this.emit('jobComplete', {
      jobId,
      type: job.type,
      status: job.status,
      completed: job.completed,
      failed: job.failed,
      total: job.total,
      duration: job.completedAt - job.createdAt,
      metadata: job.metadata
    });

    return job;
  }

  /**
   * Add error to job
   */
  addJobError(jobId, error) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    job.errors.push({
      message: error.message || error,
      timestamp: new Date()
    });
    job.updatedAt = new Date();
  }

  /**
   * Get job status
   */
  getJob(jobId) {
    return this.activeJobs.get(jobId) || this.jobHistory.find(j => j.id === jobId);
  }

  /**
   * Get all active jobs
   */
  getActiveJobs() {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get job history
   */
  getJobHistory(limit = 20) {
    return this.jobHistory.slice(0, limit);
  }
}

// Singleton instance
export const backgroundJobs = new BackgroundJobService();

/**
 * Send emails in background with progress tracking
 * 
 * @param {Object} params - Email job parameters
 * @param {Array} params.recipients - Array of { email, name } objects
 * @param {Function} params.sendEmail - Email sending function
 * @param {Object} params.emailData - Data to pass to email function
 * @param {Object} params.io - Socket.IO instance for real-time updates
 * @param {string} params.initiatorId - User ID who initiated the job
 * @param {string} params.jobType - Type of email job (e.g., 'event_notification', 'announcement')
 */
export async function sendEmailsInBackground({
  recipients,
  sendEmail,
  emailData,
  io,
  initiatorId,
  jobType = 'email_notification',
  metadata = {}
}) {
  const job = backgroundJobs.createJob(jobType, {
    ...metadata,
    initiatorId,
    recipientCount: recipients.length
  });

  backgroundJobs.setJobTotal(job.id, recipients.length);

  // Emit job started
  if (io && initiatorId) {
    io.to(`user_${initiatorId}`).emit('backgroundJobStarted', {
      jobId: job.id,
      type: jobType,
      total: recipients.length,
      message: `Sending emails to ${recipients.length} recipients...`
    });
  }

  // Process emails in batches for efficiency
  const batchSize = 10;
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    // Send batch in parallel
    const results = await Promise.allSettled(
      batch.map(recipient => 
        sendEmail(recipient.email, recipient.name, emailData)
          .catch(err => {
            backgroundJobs.addJobError(job.id, err);
            throw err;
          })
      )
    );

    // Count successes and failures
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        completed++;
      } else {
        failed++;
      }
    });

    // Update progress
    backgroundJobs.updateJobProgress(job.id, completed, failed);

    // Emit progress to initiator
    if (io && initiatorId) {
      io.to(`user_${initiatorId}`).emit('backgroundJobProgress', {
        jobId: job.id,
        type: jobType,
        progress: Math.round((completed / recipients.length) * 100),
        completed,
        failed,
        total: recipients.length,
        message: `Sent ${completed}/${recipients.length} emails`
      });
    }

    // Small delay between batches to avoid overwhelming mail server
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Complete job
  const finalStatus = failed === recipients.length ? 'failed' : 
                      failed > 0 ? 'partial' : 'completed';
  backgroundJobs.completeJob(job.id, finalStatus);

  // Emit completion to initiator
  if (io && initiatorId) {
    io.to(`user_${initiatorId}`).emit('backgroundJobComplete', {
      jobId: job.id,
      type: jobType,
      status: finalStatus,
      completed,
      failed,
      total: recipients.length,
      message: failed > 0 
        ? `Sent ${completed} emails, ${failed} failed` 
        : `Successfully sent ${completed} emails`
    });
  }

  return { jobId: job.id, completed, failed, total: recipients.length };
}

/**
 * Send notifications in background
 */
export async function sendNotificationsInBackground({
  users,
  notifyUser,
  req,
  notificationType,
  message,
  data,
  io,
  initiatorId
}) {
  const job = backgroundJobs.createJob('bulk_notification', {
    initiatorId,
    userCount: users.length,
    notificationType
  });

  backgroundJobs.setJobTotal(job.id, users.length);

  const batchSize = 50;
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    const results = await Promise.allSettled(
      batch.map(user => 
        notifyUser(req, user._id, notificationType, message, data)
      )
    );

    results.forEach(result => {
      if (result.status === 'fulfilled') completed++;
      else failed++;
    });

    backgroundJobs.updateJobProgress(job.id, completed, failed);
  }

  backgroundJobs.completeJob(job.id, failed === users.length ? 'failed' : 'completed');
  
  return { jobId: job.id, completed, failed, total: users.length };
}

/**
 * Warm cache in background
 */
export async function warmCacheInBackground(cacheService, tasks) {
  const job = backgroundJobs.createJob('cache_warming', { taskCount: tasks.length });
  backgroundJobs.setJobTotal(job.id, tasks.length);

  let completed = 0;

  for (const task of tasks) {
    try {
      await task();
      completed++;
      backgroundJobs.updateJobProgress(job.id, completed);
    } catch (err) {
      backgroundJobs.addJobError(job.id, err);
    }
  }

  backgroundJobs.completeJob(job.id);
  return { jobId: job.id, completed, total: tasks.length };
}

export default backgroundJobs;
