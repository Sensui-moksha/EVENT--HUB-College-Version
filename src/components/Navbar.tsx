import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import ManualRefreshButton from './ManualRefreshButton';
import NotificationDrawer from './NotificationDrawer';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Home, 
  User, 
  LogOut, 
  Bell, 
  Plus,
  Menu,
  X,
  QrCode,
  MoreHorizontal,
  Settings,
  BarChart3,
  Megaphone,
  Shield,
  Images
} from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, clearAllNotifications } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [visibleItems, setVisibleItems] = useState<number>(0);
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0);
  const navRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  // Fetch pending users count for admin
  useEffect(() => {
    const fetchPendingUsersCount = async () => {
      if (user?.role === 'admin') {
        try {
          const response = await fetch('/api/admin/users/pending');
          const data = await response.json();
          if (response.ok) {
            setPendingUsersCount(data.count || 0);
          }
        } catch (error) {
          console.error('Failed to fetch pending users count');
        }
      }
    };
    
    fetchPendingUsersCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingUsersCount, 30000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const navItems: { path: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/events', label: 'Events', icon: Calendar },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    { path: '/gallery', label: 'Gallery', icon: Images }
  ];

  if (user) {
    navItems.push({ path: '/dashboard', label: 'Dashboard', icon: User });
    if (user.role === 'organizer' || user.role === 'admin') {
      navItems.push({ path: '/create-event', label: 'Create Event', icon: Plus });
    }
    if (user.role === 'admin') {
      navItems.push({ path: '/admin-users', label: 'Users', icon: User, badge: pendingUsersCount });
    }
  }

  // Calculate how many nav items can fit
  useEffect(() => {
    const calculateVisibleItems = () => {
      if (typeof window !== 'undefined') {
        const screenWidth = window.innerWidth;
        const totalItems = navItems.length;
        
        if (screenWidth >= 1280) { // xl screens
          setVisibleItems(totalItems); // Show all items
        } else if (screenWidth >= 1024) { // lg screens
          // Dynamically adjust based on available space and number of items
          const maxVisible = totalItems <= 6 ? totalItems : Math.max(4, totalItems - 2);
          setVisibleItems(Math.min(totalItems, maxVisible));
        } else {
          setVisibleItems(0); // Hide all, use mobile menu
        }
      }
    };

    calculateVisibleItems();
    window.addEventListener('resize', calculateVisibleItems);
    return () => window.removeEventListener('resize', calculateVisibleItems);
  }, [navItems.length]);

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setShowOverflowMenu(false);
      }
    };

    if (showOverflowMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOverflowMenu]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettingsMenu]);

  const visibleNavItems = navItems.slice(0, visibleItems);
  const hiddenNavItems = navItems.slice(visibleItems);

  // Use normal style on home page, glass style on all other pages
  const isHomePage = location.pathname === '/';
  const navbarClass = isHomePage 
    ? "hidden lg:flex fixed top-0 left-0 w-full z-50 bg-white shadow transition-all duration-300"
    : "hidden lg:flex fixed top-0 left-0 w-full z-50 navbar-glass transition-all duration-300";

  return (
    <nav className={navbarClass}>
      <div className="max-w-7xl mx-auto px-2 xs:px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 xs:h-16 sm:h-18 lg:h-20 gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group flex-shrink-0 min-w-0">
            {/* College Logo */}
            <div className="p-1 xs:p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 group-hover:shadow-md transition-all duration-200">
              <img 
                src="/logo-small.png" 
                alt="College Logo" 
                className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 object-contain"
              />
            </div>
            <span className="text-sm xs:text-base sm:text-lg lg:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
              EventHub
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div ref={navRef} className="hidden lg:flex items-center space-x-1 xl:space-x-3 flex-1 justify-center max-w-4xl">
            {/* Visible Navigation Items */}
            {visibleNavItems.map(({ path, label, icon: Icon, badge }) => (
              <Link
                key={path}
                to={path}
                title={badge ? `${label} (${badge} pending)` : label}
                className={`relative flex items-center space-x-1 px-1.5 xl:px-2 py-1.5 rounded-lg transition-colors text-xs xl:text-sm whitespace-nowrap ${
                  location.pathname === path 
                    ? 'text-blue-600 bg-blue-50 font-medium' 
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden xl:block font-medium">{label}</span>
                <span className="lg:block xl:hidden font-medium">
                  {label.length > 8 ? label.substring(0, 8) + '...' : label}
                </span>
                {badge !== undefined && badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg"
                  >
                    {badge > 9 ? '9+' : badge}
                  </motion.span>
                )}
              </Link>
            ))}
            
            {/* Overflow Menu - Only show when there are hidden items */}
            {hiddenNavItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                  title="More options"
                  className="flex items-center px-1.5 xl:px-2 py-1.5 rounded-lg transition-colors text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="hidden xl:block font-medium ml-1">More</span>
                </button>
                
                {/* Overflow Dropdown */}
                {showOverflowMenu && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border z-50 py-2">
                    {hiddenNavItems.map(({ path, label, icon: Icon, badge }) => (
                      <Link
                        key={path}
                        to={path}
                        onClick={() => setShowOverflowMenu(false)}
                        className={`flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 transition-colors ${
                          location.pathname === path
                            ? 'text-blue-600 bg-blue-50 font-medium'
                            : 'text-gray-700 hover:text-blue-600'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium flex-1">{label}</span>
                        {badge !== undefined && badge > 0 && (
                          <span className="bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Side Items */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {user ? (
              <>
                {/* Notifications - Bell Icon */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleNotifications}
                  title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                  className="relative p-2 sm:p-2.5 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-all duration-300 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-lg"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </motion.button>

                {/* Notification Drawer */}
                <NotificationDrawer
                  isOpen={showNotifications}
                  onClose={() => setShowNotifications(false)}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAsRead={markAsRead}
                  onClearAll={clearAllNotifications}
                />

                {/* Refresh Controls - Only show on larger screens */}
                <div className="hidden xl:flex items-center space-x-1">
                  <ManualRefreshButton showText={false} />
                </div>

                {/* Quick Actions for Admin/Organizer */}
                {(user.role === 'admin' || user.role === 'organizer') && (
                  <Link
                    to="/create-event"
                    title="Create Event"
                    className="p-1 sm:p-1.5 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Link>
                )}

                {/* Settings Menu */}
                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Settings"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs sm:text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                      {user.name}
                    </span>
                    <Settings className="w-4 h-4 text-gray-600" />
                  </button>

                  {/* Settings Dropdown */}
                  {showSettingsMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50">
                      {/* Menu Items */}
                      <div className="py-2">
                        {/* Profile */}
                        <button
                          onClick={() => {
                            setShowSettingsMenu(false);
                            navigate('/profile');
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                        >
                          <User className="w-4 h-4" />
                          <span>My Profile</span>
                        </button>

                        {/* Notification Settings */}
                        <button
                          onClick={() => {
                            setShowSettingsMenu(false);
                            navigate('/notification-preferences');
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                        >
                          <Bell className="w-4 h-4" />
                          <span>Notification Settings</span>
                        </button>

                        {/* Privacy Settings */}
                        <button
                          onClick={() => {
                            setShowSettingsMenu(false);
                            navigate('/privacy-settings');
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                        >
                          <Shield className="w-4 h-4" />
                          <span>Privacy Settings</span>
                        </button>

                        {/* QR Scanner (Admin/Organizer only) */}
                        {(user.role === 'admin' || user.role === 'organizer') && (
                          <button
                            onClick={() => {
                              setShowSettingsMenu(false);
                              navigate('/qr-scanner');
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>QR Scanner</span>
                          </button>
                        )}

                        {/* Send Announcement (Admin/Organizer only) */}
                        {(user.role === 'admin' || user.role === 'organizer') && (
                          <button
                            onClick={() => {
                              setShowSettingsMenu(false);
                              navigate('/send-announcement');
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                          >
                            <Megaphone className="w-4 h-4" />
                            <span>Send Announcement</span>
                          </button>
                        )}

                        {/* Event Analytics (Admin/Organizer only) */}
                        {(user.role === 'admin' || user.role === 'organizer') && (
                          <button
                            onClick={() => {
                              setShowSettingsMenu(false);
                              navigate('/event-analytics');
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                          >
                            <BarChart3 className="w-4 h-4" />
                            <span>Event Analytics</span>
                          </button>
                        )}
                      </div>

                      {/* Logout */}
                      <div className="border-t border-gray-200 pt-2">
                        <button
                          onClick={() => {
                            setShowSettingsMenu(false);
                            handleLogout();
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Link
                  to="/login"
                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors text-xs sm:text-sm"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs sm:text-sm"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title={isMenuOpen ? "Close menu" : "Open menu"}
              className="lg:hidden p-1.5 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden py-3 border-t border-gray-200">
            <div className="space-y-1">
              {navItems.map(({ path, label, icon: Icon, badge }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    location.pathname === path
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </Link>
              ))}
              
              {/* Mobile Refresh Controls */}
              {user && (
                <div className="flex items-center justify-between px-3 py-2 mt-4 pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Refresh Data</span>
                  <ManualRefreshButton showText={false} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;