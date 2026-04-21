import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  Bell,
  Lock,
  Heart,
  Users,
  Home,
  Calendar,
  Check,
  Zap,
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TutorialStep {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface UserSettings {
  emailNotifications: boolean;
  eventReminders: boolean;
  onlyOwnEvents: boolean;
  showProfile: boolean;
}

const OnboardingTutorial: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);
  const [isLaptop, setIsLaptop] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    emailNotifications: true,
    eventReminders: true,
    onlyOwnEvents: false,
    showProfile: true,
  });

  useEffect(() => {
    const seen = localStorage.getItem(`tutorial-seen-${user?._id}`);
    setHasSeenTutorial(!!seen);
  }, [user]);

  // Detect device type on mount and window resize
  useEffect(() => {
    const checkDeviceType = () => {
      // Consider laptop if screen width > 1024px AND it's not a touch device
      const isWide = window.innerWidth > 1024;
      const isTouchDevice = () => {
        return (
          (typeof window !== 'undefined' && 'ontouchstart' in window) ||
          (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
        );
      };
      setIsLaptop(isWide && !isTouchDevice());
    };

    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    return () => window.removeEventListener('resize', checkDeviceType);
  }, []);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: 'Welcome to EventHub! 🎉',
      description: 'Your all-in-one event management platform',
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Discover, register, and manage events all in one place. Get the latest updates on campus activities and networking opportunities.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              ✨ Tip: Check back regularly for new events and announcements!
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Explore Events',
      description: 'Find events that match your interests',
      icon: Calendar,
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Browse Events</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">View all upcoming events in the Events section</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-yellow-500 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Quick Registration</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Register for events with a single click</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Get Notifications</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Receive reminders for upcoming events</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Your Dashboard',
      description: 'Track your registrations and activities',
      icon: Home,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Your personal dashboard shows:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-600" />
              <span>Registered events</span>
            </li>
            <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-600" />
              <span>Upcoming registrations</span>
            </li>
            <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-600" />
              <span>Event history</span>
            </li>
            <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-600" />
              <span>Quick statistics</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Gallery & Media',
      description: 'View event photos and memories',
      icon: Heart,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Browse beautiful photos from past events. Share your experiences and connect with other attendees.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg"
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Photo gallery preview
          </p>
        </div>
      ),
    },
    {
      id: 5,
      title: 'Your Profile',
      description: 'Customize your presence',
      icon: Users,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Make your profile more discoverable:
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Profile Visibility</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Control who can see your profile</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-red-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Interests</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Add your interests to find like-minded people</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 6,
      title: 'Notification Preferences',
      description: 'Stay informed your way',
      icon: Bell,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Choose what notifications you want to receive. You have full control!
          </p>
          <div className="space-y-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            {[
              { label: 'Event Reminders', value: 'eventReminders' },
              { label: 'Email Notifications', value: 'emailNotifications' },
              { label: 'Show Profile Publicly', value: 'showProfile' },
            ].map((pref) => (
              <label key={pref.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[pref.value as keyof UserSettings]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      [pref.value]: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{pref.label}</span>
              </label>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 7,
      title: 'Privacy Settings',
      description: 'Keep your data secure',
      icon: Lock,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Your privacy matters. Control how your data is used:
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">End-to-end encrypted data</span>
            </li>
            <li className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Control data sharing</span>
            </li>
            <li className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Export your data anytime</span>
            </li>
          </ul>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-800 dark:text-green-200">
              ✓ Your data is protected by industry standards
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 8,
      title: 'You\'re All Set! 🚀',
      description: 'Ready to explore EventHub',
      icon: Zap,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Welcome aboard, {user?.name?.split(' ')[0]}! You're all set to start exploring events.
          </p>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Quick tips to get started:
            </p>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <li>• Go to Events to browse upcoming activities</li>
              <li>• Check your Dashboard for registrations</li>
              <li>• Customize your preferences in Settings</li>
              <li>• Connect with other event enthusiasts</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`tutorial-seen-${user?._id}`, 'true');
    setHasSeenTutorial(true);
    onClose();
  };

  const handleFinish = () => {
    localStorage.setItem(`tutorial-seen-${user?._id}`, 'true');
    localStorage.setItem(
      `user-settings-${user?._id}`,
      JSON.stringify(settings)
    );
    setHasSeenTutorial(true);
    onClose();
  };

  if (!isOpen || !user || hasSeenTutorial) {
    return null;
  }

  const currentTutorial = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  // Laptop Layout (Side-by-side)
  if (isLaptop) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center gap-4">
              {React.createElement(currentTutorial.icon, {
                className: 'w-8 h-8 text-blue-600',
              })}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {currentTutorial.title}
                </h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">
                  {currentTutorial.description}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-gray-200 dark:bg-gray-800">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Main Content Area - Two Columns */}
          <div className="flex-1 overflow-hidden flex">
            {/* Left Side - Content */}
            <div className="flex-1 overflow-y-auto p-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentTutorial.content as React.ReactElement}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Side - Sidebar with Steps Overview */}
            <div className="w-56 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracked">
                Tutorial Steps
              </h3>
              <div className="space-y-2">
                {tutorialSteps.map((step, idx) => (
                  <motion.button
                    key={step.id}
                    onClick={() => setCurrentStep(idx)}
                    whileHover={{ x: 4 }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                      currentStep === idx
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {React.createElement(step.icon, {
                        className: `w-4 h-4 flex-shrink-0 ${
                          currentStep === idx ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                        } mt-0.5`,
                      })}
                      <div>
                        <p className={`text-sm font-medium ${currentStep === idx ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                          {step.title}
                        </p>
                        <p className={`text-xs ${currentStep === idx ? 'text-blue-100' : 'text-gray-600 dark:text-gray-500'}`}>
                          Step {idx + 1}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-8 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="flex items-center gap-2 px-6 py-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              <SkipForward className="w-4 h-4" />
              Skip All
            </button>

            <div className="flex items-center gap-6">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {currentStep + 1} / {tutorialSteps.length}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="p-3 text-gray-600 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {currentStep === tutorialSteps.length - 1 ? (
                  <button
                    onClick={handleFinish}
                    className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold text-base"
                  >
                    <span>Get Started</span>
                    <Check className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold text-base"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Mobile Layout (Full-screen)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            {React.createElement(currentTutorial.icon, {
              className: 'w-6 h-6 text-blue-600',
            })}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentTutorial.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentTutorial.description}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-200 dark:bg-gray-800">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentTutorial.content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span className="text-sm font-medium">Skip All</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentStep + 1} / {tutorialSteps.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="p-2 text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {currentStep === tutorialSteps.length - 1 ? (
                <button
                  onClick={handleFinish}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-shadow font-medium"
                >
                  <span>Get Started</span>
                  <Check className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-shadow font-medium"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingTutorial;
