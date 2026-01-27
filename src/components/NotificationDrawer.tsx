import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../contexts/EventContext';
import { useToast } from './ui/Toast';
import { 
  X, 
  Bell, 
  CheckCheck, 
  Trash2,
  Calendar,
  UserCheck,
  AlertCircle,
  Info,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Notification } from '../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (notificationId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onClearAll,
}) => {
  const navigate = useNavigate();
  const { events, loading } = useEvents();
  const { addToast } = useToast();

  // Close drawer on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getNotificationIcon = (type: string) => {
    if (type === 'registration_approved') {
      return <CheckCheck className="w-5 h-5 text-green-600" />;
    } else if (type === 'registration_rejected') {
      return <X className="w-5 h-5 text-red-600" />;
    } else if (type === 'waiting_list' || type === 'new_waitlist_entry') {
      return <Clock className="w-5 h-5 text-yellow-600" />;
    } else if (type.includes('registered') || type.includes('waitlist')) {
      return <UserCheck className="w-5 h-5 text-purple-600" />;
    } else if (type.includes('event') || type.includes('venue') || type.includes('postponed')) {
      return <Calendar className="w-5 h-5 text-blue-600" />;
    } else if (type.includes('reminder')) {
      return <Clock className="w-5 h-5 text-amber-600" />;
    } else if (type.includes('cancelled') || type.includes('deleted') || type.includes('alert')) {
      return <AlertCircle className="w-5 h-5 text-orange-600" />;
    } else if (type.includes('announcement')) {
      return <CheckCheck className="w-5 h-5 text-green-600" />;
    }
    return <Info className="w-5 h-5 text-gray-600" />;
  };

  const getNotificationColor = (type: string) => {
    if (type === 'registration_approved') {
      return 'bg-green-50 border-green-200';
    } else if (type === 'registration_rejected') {
      return 'bg-red-50 border-red-200';
    } else if (type === 'waiting_list' || type === 'new_waitlist_entry') {
      return 'bg-yellow-50 border-yellow-200';
    } else if (type.includes('registered') || type.includes('waitlist')) {
      return 'bg-purple-50 border-purple-200';
    } else if (type.includes('event') || type.includes('venue') || type.includes('postponed')) {
      return 'bg-blue-50 border-blue-200';
    } else if (type.includes('reminder')) {
      return 'bg-amber-50 border-amber-200';
    } else if (type.includes('cancelled') || type.includes('deleted') || type.includes('alert')) {
      return 'bg-orange-50 border-orange-200';
    } else if (type.includes('announcement')) {
      return 'bg-green-50 border-green-200';
    }
    return 'bg-gray-50 border-gray-200';
  };

  // Resolve relative/absolute event image URLs
  const resolveImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
    return `/${url.replace(/^\.?\//, '')}`; // normalize to absolute path
  };

  // Inline component to render event image with graceful fallback to icon
  const NotificationMedia: React.FC<{ n: Notification }> = ({ n }) => {
    const [errored, setErrored] = React.useState(false);
    const src = resolveImageUrl(n.data?.eventImage);

    if (src && !errored) {
      return (
        <img
          src={src}
          alt={n.data?.eventTitle || 'Event'}
          onError={() => setErrored(true)}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-cover shadow-sm border border-gray-200 bg-gray-100"
          loading="lazy"
        />
      );
    }
    return getNotificationIcon(n.type);
  };

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    for (const notification of unreadNotifications) {
      await onMarkAsRead(notification._id);
    }
  };

  const handleViewAll = () => {
    onClose();
    navigate('/notifications');
  };

  // Click on a notification card: mark read, navigate to event if exists; else warn
  const handleCardClick = async (n: Notification) => {
    if (!n.read) await onMarkAsRead(n._id);
    const eventId = n.data?.eventId;
    if (!eventId) return; // Some notifications may not be event-linked
    const exists = events.find((e: any) => e.id === eventId || e._id === eventId);
    if (exists || loading) {
      onClose();
      navigate(`/events/${eventId}`);
    } else {
      addToast({
        type: 'warning',
        title: 'Event deleted',
        message: 'This event is no longer available.',
        duration: 4000,
      });
    }
  };

  // Drawer animation variants
  const drawerVariants = {
    hidden: {
      x: '100%',
      transition: {
        type: 'tween',
        duration: 0.3,
        ease: 'easeInOut',
      },
    },
    visible: {
      x: 0,
      transition: {
        type: 'tween',
        duration: 0.3,
        ease: 'easeInOut',
      },
    },
  };

  // Backdrop animation
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  // Notification item animation
  const itemVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: 'easeOut',
      },
    }),
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Drawer - Standard width across breakpoints */}
          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[600px] lg:w-[650px] bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header - Made more compact */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg backdrop-blur-sm">
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">Notifications</h2>
                    <p className="text-xs sm:text-sm text-blue-100">
                      {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up! 🎉'}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close notifications"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </motion.button>
              </div>

              {/* Action Buttons - More compact */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm text-white font-medium px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-all touch-manipulation min-h-[40px] text-xs sm:text-sm"
                >
                  <CheckCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Mark all read</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClearAll}
                  disabled={notifications.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm text-white font-medium px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-all touch-manipulation min-h-[40px] text-xs sm:text-sm"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Clear all</span>
                </motion.button>
              </div>
            </div>

            {/* Notifications List - Expanded area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-2 sm:space-y-3">
              {notifications.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center py-8 sm:py-12"
                >
                  <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-4 sm:p-6 rounded-full mb-3 sm:mb-4">
                    <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                    No notifications yet
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 max-w-sm">
                    When you get notifications, they'll show up here. Stay tuned!
                  </p>
                </motion.div>
              ) : (
                notifications.map((notification, index) => (
                  <motion.div
                    key={notification._id}
                    custom={index}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={{ scale: 1.02, x: 4 }}
                    className={`relative p-3 sm:p-4 rounded-xl border-l-4 ${getNotificationColor(
                      notification.type
                    )} ${
                      !notification.read ? 'shadow-md' : 'opacity-75'
                    } transition-all duration-300 cursor-pointer group`}
                    onClick={() => handleCardClick(notification)}
                  >
                    {/* Unread indicator */}
                    {!notification.read && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3 right-3 w-3 h-3 bg-blue-600 rounded-full"
                      />
                    )}

                    <div className="flex gap-3">
                      {/* Image or Icon */}
                      <motion.div
                        whileHover={{ rotate: 2, scale: 1.03 }}
                        className="flex-shrink-0 mt-1"
                      >
                        <NotificationMedia n={notification} />
                      </motion.div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base pr-4">
                          {notification.title || 'Notification'}
                        </h4>
                        <p className="text-gray-700 text-sm mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>
                            {format(new Date(notification.createdAt), 'MMM dd, yyyy - h:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hover effect indicator */}
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileHover={{ scaleX: 1 }}
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 origin-left"
                    />
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer with View All Button - More compact */}
            <div className="flex-shrink-0 border-t bg-gradient-to-r from-gray-50 to-blue-50 px-4 sm:px-6 py-3 sm:py-4 space-y-2 sm:space-y-3">
              {notifications.length > 0 && (
                <p className="text-center text-xs sm:text-sm text-gray-600">
                  Showing <span className="font-semibold">{notifications.length}</span>{' '}
                  notification{notifications.length !== 1 ? 's' : ''}
                </p>
              )}
              
              {/* View All Notifications Button */}
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleViewAll}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-4 py-2.5 sm:py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 touch-manipulation min-h-[44px] text-sm sm:text-base group"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 group-hover:animate-wiggle" />
                <span>View All Notifications</span>
                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default NotificationDrawer;
