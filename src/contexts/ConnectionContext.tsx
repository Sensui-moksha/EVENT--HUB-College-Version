import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../utils/api';

interface ConnectionContextType {
  isOnline: boolean;
  isBackendConnected: boolean;
  lastError: string | null;
  hasCheckedOnce: boolean;
  checkConnection: () => Promise<boolean>;
  clearError: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
};

interface ConnectionProviderProps {
  children: ReactNode;
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBackendConnected, setIsBackendConnected] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  const checkInProgress = useRef(false);
  const lastCheckTime = useRef(0);

  // Check backend connectivity
  const checkConnection = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous checks and rate limit to every 5 seconds
    const now = Date.now();
    if (checkInProgress.current || now - lastCheckTime.current < 5000) {
      return isBackendConnected;
    }
    
    checkInProgress.current = true;
    lastCheckTime.current = now;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(`${API_BASE_URL || ''}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        setIsBackendConnected(true);
        setLastError(null);
        setHasCheckedOnce(true);
        checkInProgress.current = false;
        return true;
      } else {
        setIsBackendConnected(false);
        setLastError('Server returned an error. Please try again later.');
        setHasCheckedOnce(true);
        checkInProgress.current = false;
        return false;
      }
    } catch (error: any) {
      setIsBackendConnected(false);
      
      if (error.name === 'AbortError') {
        setLastError('Connection timed out. Server may be slow or unavailable due to poor internet connection.');
      } else if (!navigator.onLine) {
        setLastError('No internet connection. Please check your network.');
      } else {
        setLastError('Unable to connect to server. Database may be unavailable due to slow internet.');
      }
      
      setHasCheckedOnce(true);
      checkInProgress.current = false;
      return false;
    }
  }, [isBackendConnected]);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Check backend when coming back online
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsBackendConnected(false);
      setLastError('No internet connection. Please check your network.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (navigator.onLine) {
      checkConnection();
    }

    // Periodic health check every 30 seconds
    const interval = setInterval(() => {
      if (navigator.onLine) {
        checkConnection();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  const value = {
    isOnline,
    isBackendConnected,
    lastError,
    hasCheckedOnce,
    checkConnection,
    clearError,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};
