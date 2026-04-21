import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Bell, AlertCircle, CheckCircle, X } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

interface EmailPreferences {
  registrations: boolean;
  waitlist: boolean;
  eventUpdates: boolean;
  teamNotifications: boolean;
}

interface EmailSettingsProps {
  userId: string;
  onUpdate?: (preferences: EmailPreferences) => void;
}

export default function EmailSettings({ userId, onUpdate }: EmailSettingsProps) {
  const [preferences, setPreferences] = useState<EmailPreferences>({
    registrations: true,
    waitlist: true,
    eventUpdates: true,
    teamNotifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch email settings on component mount
  useEffect(() => {
    const fetchEmailSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/users/me/email-settings?userId=${userId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch email settings: ${response.statusText}`);
        }

        const data = await response.json();
        setPreferences(data.emailPreferences || preferences);
      } catch (error) {
        console.error('Error fetching email settings:', error);
        setToast({ 
          message: 'Failed to load email settings. Using defaults.', 
          type: 'error' 
        });
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchEmailSettings();
    }
  }, [userId]);

  const handleToggle = async (key: keyof EmailPreferences) => {
    try {
      setSaving(true);
      const updatedPreferences = {
        ...preferences,
        [key]: !preferences[key]
      };

      const response = await fetch(`${API_BASE_URL}/api/users/me/email-settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          emailPreferences: updatedPreferences
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update email settings: ${response.statusText}`);
      }

      const data = await response.json();
      setPreferences(data.emailPreferences);
      
      setToast({ 
        message: 'Email settings updated successfully!', 
        type: 'success' 
      });

      if (onUpdate) {
        onUpdate(data.emailPreferences);
      }
    } catch (error) {
      console.error('Error updating email settings:', error);
      setToast({ 
        message: 'Failed to update email settings. Please try again.', 
        type: 'error' 
      });
      // Revert the toggle
      setPreferences(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    } finally {
      setSaving(false);
    }
  };

  const settingsList = [
    {
      key: 'registrations' as keyof EmailPreferences,
      label: 'Event Registrations',
      description: 'Receive emails when someone registers for your events',
      icon: Mail
    },
    {
      key: 'waitlist' as keyof EmailPreferences,
      label: 'Waitlist Updates',
      description: 'Get notified about waitlist status and cancellations',
      icon: Bell
    },
    {
      key: 'eventUpdates' as keyof EmailPreferences,
      label: 'Event Updates',
      description: 'Receive announcements and updates about your events',
      icon: AlertCircle
    },
    {
      key: 'teamNotifications' as keyof EmailPreferences,
      label: 'Team Notifications',
      description: 'Get emails about team-related activities and changes',
      icon: Bell
    }
  ];

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6"
      >
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Loading email settings...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Email Notifications</h2>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Control which email notifications you receive from the platform. All notifications are enabled by default.
      </p>

      <div className="space-y-4">
        {settingsList.map((setting) => {
          const Icon = setting.icon;
          const isEnabled = preferences[setting.key];

          return (
            <motion.div
              key={setting.key}
              whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.02)' }}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors duration-200"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="flex-shrink-0">
                  <Icon className={`w-5 h-5 ${isEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    {setting.label}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {setting.description}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => handleToggle(setting.key)}
                disabled={saving}
                className={`ml-4 flex-shrink-0 relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  isEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                aria-label={`Toggle ${setting.label}`}
              >
                <motion.span
                  layout
                  className="inline-block h-6 w-6 transform bg-white rounded-full shadow-lg"
                  animate={{ x: isEnabled ? 28 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-3"
      >
        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Changes are saved instantly. Disable any notification type to stop receiving those emails.
        </p>
      </motion.div>

      {/* Toast Notifications */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`mt-4 p-4 rounded-lg flex items-center justify-between ${
            toast.type === 'success' 
              ? 'bg-green-100 border border-green-300 text-green-800' 
              : 'bg-red-100 border border-red-300 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="flex-shrink-0 text-current hover:opacity-70"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
