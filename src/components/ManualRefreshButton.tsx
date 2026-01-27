import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useImmediateRefresh } from '../hooks/useImmediateRefresh';

interface ManualRefreshButtonProps {
  className?: string;
  showText?: boolean;
}

const ManualRefreshButton: React.FC<ManualRefreshButtonProps> = ({ 
  className = '', 
  showText = true 
}) => {
  const { triggerImmediateRefresh, isRefreshing } = useImmediateRefresh();

  const handleRefresh = async () => {
    await triggerImmediateRefresh();
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Refresh data"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {showText && <span className="text-sm">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>}
    </button>
  );
};

export default ManualRefreshButton;