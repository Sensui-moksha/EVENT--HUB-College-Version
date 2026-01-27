import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { CheckCircle, AlertCircle, Loader2, Send, Bell, Users } from 'lucide-react';

/**
 * BackgroundJobToast - Displays real-time progress for background jobs
 * Shows email/notification sending progress with animated progress bars
 */
const BackgroundJobToast: React.FC = () => {
  const { backgroundJobs } = useNotifications();

  if (backgroundJobs.length === 0) return null;

  const getJobIcon = (type: string, status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (status === 'failed') {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    
    // In progress icons
    switch (type) {
      case 'event_notifications':
      case 'event_update_notifications':
        return <Bell className="w-5 h-5 text-purple-500 animate-pulse" />;
      case 'bulk_email':
        return <Send className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'bulk_notifications':
        return <Users className="w-5 h-5 text-indigo-500 animate-pulse" />;
      default:
        return <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />;
    }
  };

  const getJobTitle = (type: string) => {
    switch (type) {
      case 'event_notifications':
        return 'Sending Event Notifications';
      case 'event_update_notifications':
        return 'Notifying Registered Users';
      case 'bulk_email':
        return 'Sending Emails';
      case 'bulk_notifications':
        return 'Sending Notifications';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-purple-50 border-purple-200';
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gradient-to-r from-purple-500 to-indigo-500';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {backgroundJobs.map(job => (
        <div
          key={job.jobId}
          className={`w-full border rounded-xl p-4 shadow-lg transform transition-all duration-500 animate-slide-in ${getStatusColor(job.status)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getJobIcon(job.type, job.status)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                {getJobTitle(job.type)}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 truncate">
                {job.message}
              </p>
              
              {/* Progress section */}
              <div className="mt-3">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-medium text-gray-700">
                    {job.completed !== undefined && job.total !== undefined ? (
                      <>
                        <span className="text-purple-600 font-bold">{job.completed}</span>
                        <span className="text-gray-400"> / </span>
                        <span>{job.total}</span>
                        <span className="text-gray-400 ml-1">
                          {job.type.includes('email') ? 'emails' : 'users'}
                        </span>
                      </>
                    ) : (
                      `${job.progress}%`
                    )}
                  </span>
                  <span className={`font-semibold ${
                    job.status === 'completed' ? 'text-green-600' : 
                    job.status === 'failed' ? 'text-red-600' : 
                    'text-purple-600'
                  }`}>
                    {job.status === 'completed' ? '✓ Done' : 
                     job.status === 'failed' ? '✗ Failed' : 
                     `${job.progress}%`}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ease-out ${getProgressBarColor(job.status)}`}
                    style={{ 
                      width: `${Math.min(job.progress || 0, 100)}%`,
                      transition: 'width 0.5s ease-out'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* CSS for slide-in animation */}
      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default BackgroundJobToast;
