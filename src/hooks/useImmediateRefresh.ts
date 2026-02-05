import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../contexts/EventContext.tsx';

// Custom hook for triggering immediate data refresh
export const useImmediateRefresh = () => {
  const { refreshUserData } = useAuth();
  const { isRefreshing } = useEvents();

  const triggerImmediateRefresh = useCallback(async () => {
    // Trigger immediate user data refresh
    await refreshUserData();
    
    // Trigger immediate events refresh by calling the context directly
    // This will be handled by the auto-refresh system
    window.dispatchEvent(new Event('forceRefresh'));
  }, [refreshUserData]);

  return {
    triggerImmediateRefresh,
    isRefreshing
  };
};

export default useImmediateRefresh;