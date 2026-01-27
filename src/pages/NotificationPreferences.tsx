import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { 
  Settings, Bell, Calendar, Users, MessageSquare, 
  TrendingUp, AlertTriangle, Mail, ClipboardList
} from 'lucide-react';
import { NotificationPreferences as NotificationPrefsType } from '../types';

const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [preferences, setPreferences] = useState<NotificationPrefsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, [userId]);

  const fetchPreferences = async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/notification-preferences/${userId}`);
      const data = await response.json();
      setPreferences(data);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, subKey?: string) => {
    if (!preferences) return;

    const newPreferences = (() => {
      if (subKey) {
        return {
          ...preferences,
          preferences: {
            ...preferences.preferences,
            [subKey]: !preferences.preferences[subKey as keyof typeof preferences.preferences]
          }
        };
      } else {
        return {
          ...preferences,
          [key]: !preferences[key as keyof NotificationPrefsType]
        };
      }
    })();

    setPreferences(newPreferences);

    // Auto-save immediately
    try {
      if (userId) {
        await fetch(`/api/notification-preferences/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPreferences)
        });
      }
    } catch (error) {
      console.error('Error auto-saving preferences:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-20 pb-8 px-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!preferences) return null;

  const isOrganizerOrAdmin = user?.role === 'organizer' || user?.role === 'admin';

  const preferenceGroups: Array<{
    title: string;
    icon: JSX.Element;
    color: string;
    comingSoon?: boolean;
    items: Array<{ key: string; label: string; description: string }>;
  }> = [
    {
      title: 'Event Notifications',
      icon: <Calendar className="w-5 h-5" />,
      color: 'from-blue-500 to-cyan-500',
      items: [
        { key: 'eventCreated', label: 'New Events Created', description: 'Get notified when new events are posted' },
        { key: 'eventUpdated', label: 'Event Updates', description: 'Notified when event details change' },
        { key: 'eventCancelled', label: 'Cancellations & Postponements', description: 'Critical updates about event status' }
      ]
    },
    {
      title: 'Reminders',
      icon: <Bell className="w-5 h-5" />,
      color: 'from-purple-500 to-pink-500',
      items: [
        { key: 'reminders', label: 'Event Reminders', description: '24-hour and 1-hour before event starts' }
      ]
    },
    {
      title: 'Capacity & Availability',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'from-yellow-500 to-orange-500',
      items: [
        { key: 'capacityAlerts', label: 'Capacity Alerts', description: 'When events are filling up or spots open' },
        { key: 'waitlistUpdates', label: 'Waitlist Updates', description: 'When a spot opens up and you move up the waitlist' }
      ]
    },
    {
      title: 'Comments & Discussions',
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'from-green-500 to-emerald-500',
      items: [
        { key: 'comments', label: 'Comments & Replies', description: 'When someone comments or replies to you' }
      ]
    },
    {
      title: 'Social Activity',
      icon: <Users className="w-5 h-5" />,
      color: 'from-pink-500 to-rose-500',
      comingSoon: true,
      items: [
        { key: 'friendActivity', label: 'Friend Activity', description: 'When friends register for events' }
      ]
    },
    {
      title: 'Announcements',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'from-indigo-500 to-purple-500',
      items: [
        { key: 'announcements', label: 'Custom Announcements', description: 'Important messages from organizers' }
      ]
    }
  ];

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-20 pb-8 px-4 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg">
              <Settings className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Notification Preferences</h1>
              <p className="text-gray-600 text-lg">Customize which notifications you want to receive</p>
            </div>
          </div>
        </motion.div>

        {/* Email Notifications Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">Email Notifications</h3>
                </div>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('emailNotifications')}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                preferences.emailNotifications ? 'bg-green-500' : 'bg-gray-300'
              }`}
              title="Toggle email notifications"
              aria-label="Toggle email notifications"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  preferences.emailNotifications ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </motion.div>

        {/* Organizer/Admin Email Preferences */}
        {isOrganizerOrAdmin && preferences.emailPreferences && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-purple-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg text-white">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Event Management Notifications</h2>
              <span className="ml-auto px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-md">
                {user?.role === 'organizer' ? 'Organizer' : 'Admin'}
              </span>
            </div>

            <div className="space-y-4">
              {[
                { key: 'registrations', label: 'Registration Updates', description: 'New registrations, approvals, and rejections' },
                { key: 'waitlist', label: 'Waitlist Notifications', description: 'When users join the waitlist or are promoted' },
                { key: 'eventUpdates', label: 'Event Updates', description: 'Changes to event details, cancellations, postponements' },
                { key: 'teamNotifications', label: 'Team Notifications', description: 'Team invitations and team-related updates' }
              ].map((item) => {
                const isEnabled = preferences.emailPreferences?.[item.key as keyof typeof preferences.emailPreferences] ?? false;
                
                return (
                  <div key={item.key} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">{item.label}</h3>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    </div>
                    <button
                      onClick={() => {
                        const currentEmailPrefs = preferences.emailPreferences || {
                          registrations: true,
                          waitlist: true,
                          eventUpdates: true,
                          teamNotifications: true
                        };
                        const newPrefs = {
                          ...preferences,
                          emailPreferences: {
                            ...currentEmailPrefs,
                            [item.key]: !isEnabled
                          }
                        };
                        setPreferences(newPrefs as NotificationPrefsType);
                        // Auto-save
                        if (userId) {
                          fetch(`/api/notification-preferences/${userId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newPrefs)
                          }).catch(err => console.error('Error saving preferences:', err));
                        }
                      }}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ml-4 flex-shrink-0 ${
                        isEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={`Toggle ${item.label}`}
                      aria-label={`Toggle ${item.label}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Preference Groups */}
        {preferenceGroups.map((group, groupIndex) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.1 }}
            className={`bg-white rounded-2xl shadow-lg p-6 mb-6 ${group.comingSoon ? 'opacity-60 relative' : ''}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 bg-gradient-to-br ${group.color} rounded-lg text-white`}>
                {group.icon}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{group.title}</h2>
              {group.comingSoon && (
                <span className="ml-auto px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-md">
                  Coming Soon
                </span>
              )}
            </div>

            <div className="space-y-4">
              {group.items.map((item) => {
                const isEnabled = !group.comingSoon && preferences.preferences[item.key as keyof typeof preferences.preferences];
                
                return (
                  <div key={item.key} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">{item.label}</h3>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    </div>
                    <button
                      onClick={() => !group.comingSoon && handleToggle('preferences', item.key)}
                      disabled={group.comingSoon}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ml-4 flex-shrink-0 ${
                        group.comingSoon 
                          ? 'bg-gray-300 cursor-not-allowed'
                          : isEnabled
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                      title={`Toggle ${item.label}`}
                      aria-label={`Toggle ${item.label}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          isEnabled && !group.comingSoon
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default NotificationPreferences;
