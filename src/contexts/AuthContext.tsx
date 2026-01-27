import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (userData: Omit<User, 'id' | 'createdAt'> & { password: string }) => Promise<{ success: boolean; error?: string; pendingApproval?: boolean; message?: string }>;
  updateProfile: (userData: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ success: boolean; avatarUrl?: string; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshUserData: () => Promise<void>;
  logout: () => void;
  loading: boolean;
  // Admin privilege: delete user
  deleteUser?: (userId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const parseResponse = async (res: Response) => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      return { _rawText: text };
    }
  };

  // Function to refresh user data from server
  const refreshUserData = async () => {
    if (!user || !user._id) return;
    try {
      const res = await fetch(`/api/users/${user._id}`, { credentials: 'include' });
      const data = await parseResponse(res);
      
      // Check if session is invalid (401/403)
      if (res.status === 401 || res.status === 403) {
        console.warn('Session expired or invalid. Logging out.');
        setUser(null);
        localStorage.removeItem('user');
        return;
      }
      
      if (res.ok && data.user) {
        // Check if user account is still approved
        if (data.user.accountStatus === 'pending' || data.user.accountStatus === 'rejected') {
          // User account is no longer approved, log them out
          console.warn('User account is not approved. Logging out.');
          setUser(null);
          localStorage.removeItem('user');
          return;
        }
        
        const updatedUser = { ...data.user };
        if (!updatedUser.id) updatedUser.id = updatedUser._id;
        if (!updatedUser._id) updatedUser._id = updatedUser.id;
        if (updatedUser.createdAt) {
          updatedUser.createdAt = new Date(updatedUser.createdAt);
        }
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.createdAt) {
        parsed.createdAt = new Date(parsed.createdAt);
      }
      setUser(parsed);
    }
    setLoading(false);
  }, []);

  // Separate useEffect for auto-refresh to avoid stale closures
  useEffect(() => {
    if (!user?._id) return;

    // Set up auto-refresh for user data every 10 seconds (10000ms)
    const userRefreshInterval = setInterval(() => {
      refreshUserData();
    }, 10000);

    // Set up visibility change listener to refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshUserData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(userRefreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?._id]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Login API error:', res.status, data);
        return { success: false, error: data?.error || 'Login failed' };
      }
      if (data && data.user) {
        // Map _id to id for frontend compatibility, but keep _id for backend ops
        const user = { ...data.user };
        if (!user.id) user.id = user._id;
        if (!user._id) user._id = user.id;
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
        // Immediate refresh after login to get latest user data
        setTimeout(() => refreshUserData(), 100);
        return { success: true };
      }
      console.warn('Login response unexpected:', data);
      return { success: false, error: 'Unexpected response from server' };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: 'Network error. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: Omit<User, 'id' | 'createdAt'> & { password: string }): Promise<{ success: boolean; error?: string; pendingApproval?: boolean; message?: string }> => {
    setLoading(true);
    try {
  const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Register API error:', res.status, data);
        // Return the actual error from the backend (email, name, or regId duplicate)
        return { success: false, error: data?.error || 'Registration failed.' };
      }
      if (data && data.user) {
        // Check if account needs approval
        if (data.pendingApproval) {
          // Don't log user in - just return success with pending flag
          return { 
            success: true, 
            pendingApproval: true, 
            message: data.message || 'Your account is pending admin approval.' 
          };
        }
        
        const user = { ...data.user };
        if (!user.id) user.id = user._id;
        if (!user._id) user._id = user.id;
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
        // Immediate refresh after registration to get latest user data
        setTimeout(() => refreshUserData(), 100);
        return { success: true };
      }
      console.warn('Register response unexpected:', data);
      return { success: false, error: 'Registration failed.' };
    } catch (error) {
      console.error('Registration failed:', error);
      return { success: false, error: 'Registration failed.' };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (userData: Partial<User>): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'No user logged in.' };
    setLoading(true);
    try {
      const userId = user._id || user.id;
      const res = await fetch(`/api/user/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (res.ok && data.user) {
        const updatedUser = { ...data.user };
        if (!updatedUser.id) updatedUser.id = updatedUser._id;
        if (!updatedUser._id) updatedUser._id = updatedUser.id;
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        // Auto-refresh user data after successful update
        await refreshUserData();
        return { success: true };
      }
      return { success: false, error: data.error || 'Profile update failed.' };
    } catch (error) {
      console.error('Profile update failed:', error);
      return { success: false, error: 'Profile update failed.' };
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (file: File): Promise<{ success: boolean; avatarUrl?: string; error?: string }> => {
    if (!user) return { success: false, error: 'No user logged in.' };
    setLoading(true);
    try {
      const userId = user._id || user.id;
      // If an avatar already exists, attempt to delete it first so GridFS doesn't keep orphaned files
      try {
        if ((user as any).avatar) {
          await fetch(`/api/user/${userId}/avatar`, { method: 'DELETE' });
        }
      } catch (delErr) {
        // don't block upload if delete fails; log for debugging
        console.warn('Previous avatar deletion failed (continuing with upload):', delErr);
      }

      const fd = new FormData();
      fd.append('avatar', file);

      const res = await fetch(`/api/user/${userId}/avatar`, {
        method: 'POST',
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // If backend returns updated user or avatar URL
        if (data.user) {
          const updatedUser = { ...data.user };
          if (!updatedUser.id) updatedUser.id = updatedUser._id;
          if (!updatedUser._id) updatedUser._id = updatedUser.id;
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          await refreshUserData();
          return { success: true, avatarUrl: updatedUser.avatar };
        }
        if (data.avatarUrl) {
          // update local user object minimally
          const updated = { ...(user as any), avatar: data.avatarUrl };
          setUser(updated as User);
          localStorage.setItem('user', JSON.stringify(updated));
          await refreshUserData();
          return { success: true, avatarUrl: data.avatarUrl };
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Upload failed.' };
    } catch (error) {
      console.error('Avatar upload failed:', error);
      return { success: false, error: 'Avatar upload failed.' };
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'No user logged in.' };
    setLoading(true);
    try {
      const userId = user._id || user.id;
      const res = await fetch(`/api/user/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Immediate refresh after password change to get latest user data
        setTimeout(() => refreshUserData(), 100);
        return { success: true };
      }
      return { success: false, error: data.error || 'Password change failed.' };
    } catch (error) {
      console.error('Password change failed:', error);
      return { success: false, error: 'Password change failed.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Call server logout endpoint to destroy session
    fetch('/api/logout', {
      method: 'POST',
      credentials: 'include'
    }).catch(err => console.error('Logout error:', err));
    
    setUser(null);
    localStorage.removeItem('user');
  };

  // Admin privilege: delete user
  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
  const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        // Optionally, remove user from local state if needed
        return true;
      }
      return false;
    } catch (error) {
      console.error('Delete user failed:', error);
      return false;
    }
  };

  const value = {
    user,
    login,
    register,
    updateProfile,
    uploadAvatar,
    changePassword,
    refreshUserData,
    logout,
    loading,
    deleteUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};