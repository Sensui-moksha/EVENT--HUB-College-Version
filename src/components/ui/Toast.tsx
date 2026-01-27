import React, { useState, useRef, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'progress';
  title: string;
  message?: string;
  duration?: number;
  progress?: number; // 0-100
  completed?: number;
  total?: number;
  jobId?: string;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  removeToast: (id: string) => void;
  getToastByJobId: (jobId: string) => Toast | undefined;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};


let toastCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<{ [id: string]: NodeJS.Timeout }>({});

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = toast.jobId || (++toastCounter).toString();
    const newToast = { ...toast, id };
    
    setToasts(prev => {
      // If this jobId already exists, update instead
      if (toast.jobId) {
        const existing = prev.find(t => t.jobId === toast.jobId);
        if (existing) {
          return prev.map(t => t.jobId === toast.jobId ? { ...t, ...toast } : t);
        }
      }
      return [...prev, newToast];
    });
    
    // Only auto-remove non-progress toasts
    if (toast.type !== 'progress') {
      timers.current[id] = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        delete timers.current[id];
      }, toast.duration || 5000);
    }
    
    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => prev.map(t => {
      if (t.id === id || t.jobId === id) {
        const updated = { ...t, ...updates };
        
        // If completed (progress type converted to success), set auto-remove timer
        if (updates.type && updates.type !== 'progress' && t.type === 'progress') {
          const toastId = t.id;
          setTimeout(() => {
            setToasts(p => p.filter(toast => toast.id !== toastId));
          }, 5000);
        }
        
        return updated;
      }
      return t;
    }));
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id && t.jobId !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const getToastByJobId = useCallback((jobId: string) => {
    return toasts.find(t => t.jobId === jobId);
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ addToast, updateToast, removeToast, getToastByJobId }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const ToastContainer: React.FC<{ toasts: Toast[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      case 'progress':
        return <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />;
    }
  };

  const getStyles = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'progress':
        return 'bg-purple-50 border-purple-200 text-purple-800';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`max-w-sm w-full border rounded-lg p-4 shadow-lg transform transition-all duration-300 ${getStyles(toast.type)}`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {getIcon(toast.type)}
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.message && (
                <p className="mt-1 text-sm opacity-90">{toast.message}</p>
              )}
              {/* Progress bar for progress type */}
              {toast.type === 'progress' && typeof toast.progress === 'number' && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{toast.completed !== undefined && toast.total !== undefined 
                      ? `${toast.completed}/${toast.total}` 
                      : `${toast.progress}%`}</span>
                    <span>{toast.progress}%</span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(toast.progress, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            {toast.type !== 'progress' && (
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                title="Dismiss notification"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};