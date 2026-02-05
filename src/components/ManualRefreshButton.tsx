import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useImmediateRefresh } from '../hooks/useImmediateRefresh';
import { useEvents } from '../contexts/EventContext.tsx';

interface ManualRefreshButtonProps {
  className?: string;
  showText?: boolean;
}

const ManualRefreshButton: React.FC<ManualRefreshButtonProps> = ({ 
  className = '', 
  showText = true 
}) => {
  const { triggerImmediateRefresh, isRefreshing: isManualRefreshing } = useImmediateRefresh();
  const { isRefreshing: isAutoRefreshing, loading: eventsLoading } = useEvents();
  
  // Combine manual refresh, auto refresh, and general loading states
  const isRefreshing = isManualRefreshing || isAutoRefreshing || eventsLoading;

  const handleRefresh = async () => {
    await triggerImmediateRefresh();
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Refresh data"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {showText && <span className="text-xs sm:text-sm hidden xs:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>}
    </button>
  );
};

export default ManualRefreshButton;