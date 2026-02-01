import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { Notification } from '../types';
import { getSocketUrl, apiRequest } from '../utils/api';

// Background job types
interface BackgroundJob {
  jobId: string;
  type: string;
  progress: number;
  completed: number;
  total: number;
  message: string;
  status: 'started' | 'in-progress' | 'completed' | 'failed';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  // Background jobs
  backgroundJobs: BackgroundJob[];
  socket: Socket | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [backgroundJobs, setBackgroundJobs] = useState<BackgroundJob[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiRequest(`/api/notifications/${userId}`);
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchNotifications();

      // Connect to the socket on the backend server with enhanced reconnection settings
      const newSocket = io(getSocketUrl(), {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: Infinity, // Keep trying to reconnect
        timeout: 20000, // Connection timeout
        transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
        forceNew: false,
        autoConnect: true
      });

      socketRef.current = newSocket;

      newSocket.emit('join', userId);

      // Regular notifications
      newSocket.on('notification', (newNotification: Notification) => {
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });

      // Background job events
      newSocket.on('backgroundJobStarted', (job: BackgroundJob) => {
        // ...removed console log for production...
        setBackgroundJobs(prev => {
          const existing = prev.find(j => j.jobId === job.jobId);
          if (existing) {
            return prev.map(j => j.jobId === job.jobId ? { ...j, ...job, status: 'started' } : j);
          }
          return [...prev, { ...job, status: 'started', progress: 0 }];
        });
      });

      newSocket.on('backgroundJobProgress', (job: BackgroundJob) => {
        // ...removed console log for production...
        setBackgroundJobs(prev => 
          prev.map(j => j.jobId === job.jobId 
            ? { ...j, ...job, status: 'in-progress' } 
            : j
          )
        );
      });

      newSocket.on('backgroundJobComplete', (job: BackgroundJob) => {
        // ...removed console log for production...
        setBackgroundJobs(prev => 
          prev.map(j => j.jobId === job.jobId 
            ? { ...j, ...job, status: job.status === 'failed' ? 'failed' : 'completed', progress: 100 } 
            : j
          )
        );
        
        // Auto-remove completed jobs after 5 seconds
        setTimeout(() => {
          setBackgroundJobs(prev => prev.filter(j => j.jobId !== job.jobId));
        }, 5000);
      });

      return () => {
        newSocket.off('notification');
        newSocket.off('backgroundJobStarted');
        newSocket.off('backgroundJobProgress');
        newSocket.off('backgroundJobComplete');
        newSocket.disconnect();
        socketRef.current = null;
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setBackgroundJobs([]);
    }
  }, [userId, fetchNotifications]);

  const clearAllNotifications = async () => {
    if (!userId) return;
    try {
      await apiRequest(`/api/notifications/${userId}`, {
        method: 'DELETE',
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      if (response.ok) {
        const updatedNotification = await response.json();
        setNotifications(prev => 
          prev.map(n => n._id === notificationId ? updatedNotification : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    clearAllNotifications,
    backgroundJobs,
    socket: socketRef.current,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};