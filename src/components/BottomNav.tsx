import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationDrawer from './NotificationDrawer';
import { 
  Calendar, 
  Home, 
  User, 
  LogOut, 
  Bell, 
  Plus,
  QrCode,
  BarChart3,
  Megaphone,
  Shield,
  UserCog,
  Images
} from 'lucide-react';

const BottomNav: React.FC = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, clearAllNotifications } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setShowMoreMenu(false);
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  // Main navigation items (max 5 for bottom nav)
  const mainNavItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/events', label: 'Events', icon: Calendar },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    { path: '/gallery', label: 'Gallery', icon: Images },
  ];

  if (user) {
    mainNavItems.push({ path: '/dashboard', label: 'Dashboard', icon: User });
  }

  // Additional menu items (shown in more menu)
  const moreMenuItems = [];
  
  if (user) {
    if (user.role === 'organizer' || user.role === 'admin') {
      moreMenuItems.push(
        { path: '/create-event', label: 'Create Event', icon: Plus },
        { path: '/qr-scanner', label: 'QR Scanner', icon: QrCode },
        { path: '/event-analytics', label: 'Event Analytics', icon: BarChart3 },
        { path: '/send-announcement', label: 'Send Announcement', icon: Megaphone }
      );
    }
    if (user.role === 'admin') {
      moreMenuItems.push({ path: '/admin-users', label: 'Manage Users', icon: UserCog });
    }
    moreMenuItems.push(
      { path: '/profile', label: 'My Profile', icon: User },
      { path: '/notification-preferences', label: 'Notification Settings', icon: Bell },
      { path: '/privacy-settings', label: 'Privacy Settings', icon: Shield }
    );
  }

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Bottom Navigation Bar - Only visible on mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-xl safe-area-bottom">
        <div className="flex justify-around items-center h-20 px-1 xs:px-2">
          {/* Main Nav Items */}
          {mainNavItems.slice(0, 4).map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-all duration-200 min-h-[64px] touch-target ${
                isActive(path)
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
              title={label}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="relative"
              >
                <Icon className={`w-5 xs:w-6 h-5 xs:h-6 ${isActive(path) ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {path === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </motion.div>
              <span className={`text-xs mt-1 font-medium ${isActive(path) ? 'text-blue-600' : 'text-gray-600'}`}>
                {label}
              </span>
            </Link>
          ))}

          {/* More Menu Button */}
          {user ? (
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-all duration-200 ${
                showMoreMenu
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="relative"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </motion.div>
              <span className={`text-xs mt-1 font-medium ${showMoreMenu ? 'text-blue-600' : 'text-gray-600'}`}>
                More
              </span>
            </button>
          ) : (
            <Link
              to="/login"
              className="flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg text-gray-600 hover:text-blue-600 transition-all duration-200"
            >
              <motion.div whileTap={{ scale: 0.9 }}>
                <User className="w-6 h-6" />
              </motion.div>
              <span className="text-xs mt-1 font-medium">Login</span>
            </Link>
          )}
        </div>

        {/* Notification Drawer */}
        <NotificationDrawer
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onClearAll={clearAllNotifications}
        />
      </nav>

      {/* More Menu Overlay */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoreMenu(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            />
            
            {/* Menu Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              {/* Handle Bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* User Info */}
              {user && (
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{user.name}</h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Button */}
              {user && (
                <div className="px-4 py-2 border-b border-gray-200">
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      toggleNotifications();
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Bell className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-base font-medium text-gray-900">Notifications</span>
                    </div>
                    {unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2.5 py-1 font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Menu Items */}
              <div className="px-4 py-3 space-y-1">
                {moreMenuItems.map(({ path, label, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setShowMoreMenu(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                      isActive(path)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive(path) ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-base font-medium">{label}</span>
                  </Link>
                ))}
              </div>

              {/* Logout Button */}
              {user && (
                <div className="px-4 py-4 border-t border-gray-200">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span className="text-base font-medium">Logout</span>
                  </button>
                </div>
              )}

              {/* Safe area padding for iOS */}
              <div className="h-safe-area-inset-bottom" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default BottomNav;
