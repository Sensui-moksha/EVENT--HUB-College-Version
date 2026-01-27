import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { API_BASE_URL } from '../utils/api';
import EmailSettings from '../components/EmailSettings';

const PrivacySettings: React.FC = () => {
  const { user, refreshUserData } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [privacySettings, setPrivacySettings] = useState({
    showEmail: true,
    showMobile: true,
    showSection: true,
    showYear: true,
    showRegId: true,
    showDepartment: true,
    showAdmissionYear: true,
    showRoomNo: true,
    showStatistics: true
  });

  useEffect(() => {
    if (user?.privacySettings) {
      setPrivacySettings({
        showEmail: user.privacySettings.showEmail ?? true,
        showMobile: user.privacySettings.showMobile ?? true,
        showSection: user.privacySettings.showSection ?? true,
        showYear: user.privacySettings.showYear ?? true,
        showRegId: user.privacySettings.showRegId ?? true,
        showDepartment: user.privacySettings.showDepartment ?? true,
        showAdmissionYear: user.privacySettings.showAdmissionYear ?? true,
        showRoomNo: user.privacySettings.showRoomNo ?? true,
        showStatistics: user.privacySettings.showStatistics ?? true
      });
    }
  }, [user]);

  const handleToggle = async (setting: keyof typeof privacySettings) => {
    if (!user || loading) return;
    
    const newValue = !privacySettings[setting];
    
    // Optimistically update UI
    setPrivacySettings(prev => ({
      ...prev,
      [setting]: newValue
    }));
    
    // Save to backend
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const updatedSettings = {
        ...privacySettings,
        [setting]: newValue
      };
      
      const response = await fetch(`${API_BASE_URL}/api/user/${user._id || user.id}/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ privacySettings: updatedSettings })
      });

      if (!response.ok) {
        throw new Error('Failed to update privacy settings');
      }

      await response.json(); // Consume response
      
      addToast({
        type: 'success',
        title: 'Privacy Updated',
        message: `${setting.replace('show', '').replace(/([A-Z])/g, ' $1').trim()} visibility updated.`
      });

      // Refresh user data to get updated privacy settings
      await refreshUserData();
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      
      // Revert on error
      setPrivacySettings(prev => ({
        ...prev,
        [setting]: !newValue
      }));
      
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update privacy settings'
      });
    } finally {
      setLoading(false);
    }
  };

  const fadeInVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const PrivacyToggle = ({ 
    label, 
    description, 
    setting, 
    icon: Icon 
  }: { 
    label: string; 
    description: string; 
    setting: keyof typeof privacySettings;
    icon: React.ElementType;
  }) => (
    <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
      <div className="flex items-start gap-3 flex-1">
        <Icon className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <h3 className="font-semibold text-gray-900">{label}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
      <button
        onClick={() => handleToggle(setting)}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          privacySettings[setting] ? 'bg-green-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            privacySettings[setting] ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 pt-20 pb-24 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          variants={fadeInVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Privacy Settings</h1>
          </div>
          <p className="text-gray-600">
            Control what information is visible to other users when they view your profile
          </p>
        </motion.div>

        {/* Important Notice */}
        <motion.div
          className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3"
          variants={fadeInVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
        >
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Changes are saved automatically when you toggle any setting</li>
              <li>Admins and event organizers can always see all information</li>
              <li>You will always see your complete profile</li>
              <li>These settings only affect what other regular users can see</li>
            </ul>
          </div>
        </motion.div>

        {/* Contact Information */}
        <motion.div
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          variants={fadeInVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Contact Information
          </h2>
          <div className="space-y-3">
            <PrivacyToggle
              label="Email Address"
              description="Show your email address on your profile"
              setting="showEmail"
              icon={Eye}
            />
            <PrivacyToggle
              label="Mobile Number"
              description="Show your phone number on your profile"
              setting="showMobile"
              icon={Eye}
            />
          </div>
        </motion.div>

        {/* Academic/Professional Information */}
        <motion.div
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          variants={fadeInVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Academic/Professional Details
          </h2>
          <div className="space-y-3">
            <PrivacyToggle
              label="Department"
              description="Show your department on your profile"
              setting="showDepartment"
              icon={Eye}
            />
            
            {user?.role === 'student' && (
              <>
                <PrivacyToggle
                  label="Section"
                  description="Show your section on your profile"
                  setting="showSection"
                  icon={Eye}
                />
                <PrivacyToggle
                  label="Current Year"
                  description="Show your current year of study"
                  setting="showYear"
                  icon={Eye}
                />
                <PrivacyToggle
                  label="Registration ID"
                  description="Show your registration ID"
                  setting="showRegId"
                  icon={Eye}
                />
                <PrivacyToggle
                  label="Admission Year"
                  description="Show your admission year"
                  setting="showAdmissionYear"
                  icon={Eye}
                />
              </>
            )}

            {user?.role === 'faculty' && (
              <PrivacyToggle
                label="Room Number"
                description="Show your room number"
                setting="showRoomNo"
                icon={Eye}
              />
            )}
          </div>
        </motion.div>

        {/* Event Statistics */}
        <motion.div
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          variants={fadeInVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Event Activity
          </h2>
          <div className="space-y-3">
            <PrivacyToggle
              label="Event Statistics"
              description="Show your event registration, attendance, and organization statistics"
              setting="showStatistics"
              icon={Eye}
            />
          </div>
        </motion.div>

        {/* Email Notification Settings - Only for Organizers */}
        {user?.role === 'organizer' && user._id && (
          <EmailSettings userId={user._id} />
        )}
      </div>
    </motion.div>
  );
};

export default PrivacySettings;
