import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { useEvents } from '../contexts/EventContext';
import { useToast } from '../components/ui/Toast';
import { 
  Bell, Check, Trash2, Plus, Edit, CheckCircle, XCircle, 
  Clock, AlertTriangle, Users, MessageSquare, Calendar, 
  MapPin, TrendingUp
} from 'lucide-react';

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, clearAllNotifications } = useNotifications();
  const { events } = useEvents();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const displayedNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    for (const notification of unreadNotifications) {
      await markAsRead(notification._id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'event_created':
        return <Plus className="w-4 h-4" />;
      case 'event_deleted':
        return <Trash2 className="w-4 h-4" />;
      case 'event_updated':
        return <Edit className="w-4 h-4" />;
      case 'registered':
        return <CheckCircle className="w-4 h-4" />;
      case 'unregistered':
        return <XCircle className="w-4 h-4" />;
      case 'registration_deleted':
        return <Trash2 className="w-4 h-4" />;
      case 'reminder_24h':
      case 'reminder_1h':
        return <Clock className="w-4 h-4" />;
      case 'capacity_alert':
      case 'spot_available':
        return <AlertTriangle className="w-4 h-4" />;
      case 'waitlist_added':
      case 'waitlist_promoted':
        return <Users className="w-4 h-4" />;
      case 'comment_added':
      case 'comment_reply':
        return <MessageSquare className="w-4 h-4" />;
      case 'event_cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'event_postponed':
        return <Calendar className="w-4 h-4" />;
      case 'venue_changed':
        return <MapPin className="w-4 h-4" />;
      case 'friend_registered':
        return <Users className="w-4 h-4" />;
      case 'trending_event':
        return <TrendingUp className="w-4 h-4" />;
      case 'announcement':
      case 'custom_announcement':
        return <Bell className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string, priority?: string) => {
    if (priority === 'urgent') {
      return 'from-red-500 to-rose-500';
    }
    if (priority === 'high') {
      return 'from-orange-500 to-amber-500';
    }
    if (priority === 'critical') {
      return 'from-red-600 to-rose-600';
    }
    
    switch (type) {
      case 'event_created':
        return 'from-green-500 to-emerald-500';
      case 'event_deleted':
        return 'from-red-500 to-rose-500';
      case 'event_updated':
        return 'from-blue-500 to-indigo-500';
      case 'registered':
        return 'from-blue-500 to-cyan-500';
      case 'unregistered':
        return 'from-orange-500 to-amber-500';
      case 'registration_deleted':
        return 'from-purple-500 to-pink-500';
      case 'reminder_24h':
      case 'reminder_1h':
        return 'from-purple-500 to-indigo-500';
      case 'capacity_alert':
        return 'from-yellow-500 to-orange-500';
      case 'waitlist_added':
        return 'from-gray-500 to-slate-500';
      case 'waitlist_promoted':
        return 'from-green-500 to-emerald-500';
      case 'comment_added':
      case 'comment_reply':
        return 'from-blue-500 to-cyan-500';
      case 'event_cancelled':
        return 'from-red-500 to-rose-500';
      case 'event_postponed':
        return 'from-orange-500 to-amber-500';
      case 'venue_changed':
        return 'from-purple-500 to-pink-500';
      case 'friend_registered':
        return 'from-green-500 to-teal-500';
      case 'trending_event':
        return 'from-pink-500 to-rose-500';
      case 'spot_available':
        return 'from-green-500 to-emerald-500';
      case 'announcement':
      case 'custom_announcement':
        return 'from-indigo-500 to-purple-500';
      default:
        return 'from-gray-500 to-slate-500';
    }
  };

  // Normalize/resolve image URLs similar to the drawer
  const resolveImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
    return `/${url.replace(/^\.?\//, '')}`;
  };

  // Inline media (image with graceful fallback to icon)
  const NotificationMedia: React.FC<{ n: any }> = ({ n }) => {
    const [errored, setErrored] = React.useState(false);
    const src = resolveImageUrl(n.data?.eventImage);
    if (src && !errored) {
      return (
        <img
          src={src}
          alt={n.data?.eventTitle || 'Event'}
          onError={() => setErrored(true)}
          className="w-16 h-16 rounded-2xl object-cover shadow-lg border border-gray-200 bg-gray-100"
          loading="lazy"
        />
      );
    }
    return (
      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getNotificationColor(n.type, n.priority)} flex items-center justify-center text-white shadow-lg`}>
        {getNotificationIcon(n.type)}
      </div>
    );
  };

  const handleNotificationClick = async (notification: any) => {
    // Mark as read if unread
    if (!notification.read) {
      await markAsRead(notification._id);
    }
    
    // If eventId exists, navigate only if event still exists; otherwise show toast
    const eventId = notification.data?.eventId;
    if (eventId) {
      const exists = events.find((e: any) => e.id === eventId || e._id === eventId);
      if (exists) {
        navigate(`/events/${eventId}`);
      } else {
        addToast({
          type: 'warning',
          title: 'Event deleted',
          message: 'This event is no longer available.',
          duration: 4000,
        });
      }
    }
  };

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-20 pb-8 px-4 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
              <Bell className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600 text-lg">Stay updated with your events</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Check className="w-5 h-5" />
              <span>Mark all as read</span>
            </button>
            <button
              onClick={clearAllNotifications}
              disabled={notifications.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Trash2 className="w-5 h-5" />
              <span>Clear All</span>
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-8 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 shadow-md'
              }`}
            >
              All
              {notifications.length > 0 && (
                <span className={`ml-2 px-2.5 py-0.5 text-sm rounded-full ${
                  activeTab === 'all' ? 'bg-white/30' : 'bg-purple-100 text-purple-700'
                }`}>
                  {notifications.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-8 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'unread'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 shadow-md'
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className={`ml-2 px-2.5 py-0.5 text-sm rounded-full ${
                  activeTab === 'unread' ? 'bg-white/30' : 'bg-purple-100 text-purple-700'
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* Notifications List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {displayedNotifications.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-16 text-center">
              <div className="text-7xl mb-4">🔔</div>
              <h3 className="text-2xl font-bold text-gray-700 mb-2">
                {activeTab === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </h3>
              <p className="text-gray-500 text-lg">
                {activeTab === 'unread' 
                  ? 'You have no unread notifications'
                  : 'When you get notifications, they will appear here'}
              </p>
            </div>
          ) : (
            displayedNotifications.map((notification, index) => (
              <motion.div
                key={notification._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden cursor-pointer ${
                  !notification.read ? 'ring-2 ring-blue-400' : ''
                } ${
                  notification.priority === 'critical' ? 'border-l-4 border-red-500' : 
                  notification.priority === 'urgent' ? 'border-l-4 border-orange-500' : ''
                }`}
              >
                <div className="flex items-center gap-5 p-6">
                  {/* Image or Icon (with fallback) */}
                  <div className="flex-shrink-0">
                    <NotificationMedia n={notification} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <div className="flex-1">
                        {notification.title && (
                          <p className="text-gray-900 font-bold text-lg leading-tight mb-1">
                            {notification.title}
                          </p>
                        )}
                        <p className={`text-gray-${notification.title ? '700' : '800'} ${notification.title ? 'font-medium text-base' : 'font-semibold text-lg'} leading-relaxed`}>
                          {notification.message}
                        </p>
                      </div>
                      {notification.type === 'announcement' && notification.data?.priority && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                          notification.data.priority === 'urgent'
                            ? 'bg-red-100 text-red-700'
                            : notification.data.priority === 'high'
                            ? 'bg-orange-100 text-orange-700'
                            : notification.data.priority === 'normal'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {notification.data.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(notification.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  {!notification.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification._id);
                      }}
                      className="flex-shrink-0 p-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-6 h-6" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </motion.div>

        {/* View All Button (for pagination in future) */}
        {displayedNotifications.length > 10 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <button className="px-10 py-4 bg-white text-gray-700 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all">
              Load More
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Notifications;
