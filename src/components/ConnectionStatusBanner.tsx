import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useConnection } from '../contexts/ConnectionContext';

const ConnectionStatusBanner: React.FC = () => {
  const { isOnline, isBackendConnected, lastError, checkConnection, clearError } = useConnection();
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkConnection();
    setIsRetrying(false);
  };

  const showBanner = !isOnline || !isBackendConnected || lastError;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 500 }}
          className="fixed top-16 left-0 right-0 z-50 px-4 py-2"
        >
          <div className={`max-w-4xl mx-auto rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 ${
            !isOnline 
              ? 'bg-red-500 text-white' 
              : !isBackendConnected 
              ? 'bg-orange-500 text-white'
              : 'bg-yellow-500 text-gray-900'
          }`}>
            {!isOnline ? (
              <WifiOff className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {!isOnline 
                  ? 'No internet connection' 
                  : !isBackendConnected 
                  ? 'Unable to connect to server'
                  : 'Connection issue'}
              </p>
              <p className="text-xs opacity-90 truncate">
                {lastError || 'Please check your network connection and try again.'}
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className={`p-2 rounded-lg transition-colors ${
                  !isOnline || !isBackendConnected
                    ? 'bg-white/20 hover:bg-white/30'
                    : 'bg-black/10 hover:bg-black/20'
                } disabled:opacity-50`}
                title="Retry connection"
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              </button>
              
              {lastError && (
                <button
                  onClick={clearError}
                  className={`p-2 rounded-lg transition-colors ${
                    !isOnline || !isBackendConnected
                      ? 'bg-white/20 hover:bg-white/30'
                      : 'bg-black/10 hover:bg-black/20'
                  }`}
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConnectionStatusBanner;
