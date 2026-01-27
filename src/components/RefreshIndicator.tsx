import React from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshIndicatorProps {
  isRefreshing: boolean;
  className?: string;
}

const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({ isRefreshing, className = '' }) => {
  if (!isRefreshing) return null;

  return (
    <div className={`flex items-center space-x-2 text-blue-600 text-sm ${className}`}>
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      <span>Refreshing data...</span>
    </div>
  );
};

export default RefreshIndicator;