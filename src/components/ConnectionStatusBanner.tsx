import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useConnection } from '../contexts/ConnectionContext';

const ConnectionStatusBanner: React.FC = () => {
  const { isOnline, isBackendConnected, lastError, checkConnection, clearError, hasCheckedOnce } = useConnection();
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);
  const prevStateRef = React.useRef({ isOnline, isBackendConnected });

  // Reset dismissed state when connection status genuinely changes
  React.useEffect(() => {
    const prev = prevStateRef.current;
    if (prev.isOnline !== isOnline || prev.isBackendConnected !== isBackendConnected) {
      // Only re-show banner if connection got worse (went from connected to disconnected)
      if ((!isOnline && prev.isOnline) || (!isBackendConnected && prev.isBackendConnected)) {
        setIsDismissed(false);
      }
      // If connection restored, also clear dismissed so future issues show
      if (isOnline && isBackendConnected) {
        setIsDismissed(false);
      }
      prevStateRef.current = { isOnline, isBackendConnected };
    }
  }, [isOnline, isBackendConnected]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setIsDismissed(false);
    await checkConnection();
    setIsRetrying(false);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    clearError();
  };

  // Don't show banner until first health check has completed
  // Don't show if user dismissed it
  const showBanner = hasCheckedOnce && !isDismissed && (!isOnline || !isBackendConnected || !!lastError);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 500 }}
          className="fixed top-14 sm:top-16 left-0 right-0 z-50 px-2 sm:px-4 py-1.5 sm:py-2"
        >
          <div className={`max-w-4xl mx-auto rounded-lg shadow-lg px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 ${
            !isOnline 
              ? 'bg-red-500 text-white' 
              : !isBackendConnected 
              ? 'bg-orange-500 text-white'
              : 'bg-yellow-500 text-gray-900'
          }`}>
            {!isOnline ? (
              <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium">
                {!isOnline 
                  ? 'No internet connection' 
                  : !isBackendConnected 
                  ? 'Unable to connect to server'
                  : 'Connection issue'}
              </p>
              <p className="text-[10px] sm:text-xs opacity-90 truncate">
                {lastError || 'Please check your network connection and try again.'}
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  !isOnline || !isBackendConnected
                    ? 'bg-white/20 hover:bg-white/30 active:bg-white/40'
                    : 'bg-black/10 hover:bg-black/20 active:bg-black/30'
                } disabled:opacity-50`}
                title="Retry connection"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                  onClick={handleDismiss}
                  className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                    !isOnline || !isBackendConnected
                      ? 'bg-white/20 hover:bg-white/30 active:bg-white/40'
                      : 'bg-black/10 hover:bg-black/20 active:bg-black/30'
                  }`}
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConnectionStatusBanner;
