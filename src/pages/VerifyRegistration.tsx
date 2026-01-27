import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Calendar, MapPin, Clock, User, Mail, Building2, BookOpen, IdCard, Loader2, ArrowLeft, Home } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

interface RegistrationData {
  valid: boolean;
  message?: string;
  registration?: {
    registrationId: string;
    status: string;
    approvalStatus: string;
    registeredAt: string;
    user: {
      name: string;
      email: string;
      regId: string;
      department: string;
      section: string;
      year: number;
      role: string;
    } | null;
    event: {
      id: string;
      title: string;
      venue: string;
      date: string;
      time: string;
      status: string;
    } | null;
  };
}

const VerifyRegistration = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RegistrationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyRegistration = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/verify-registration/${registrationId}?event=${eventId || ''}`);
        const result = await response.json();
        
        if (!response.ok) {
          setData({ valid: false, message: result.message || 'Failed to verify registration' });
        } else {
          setData(result);
        }
      } catch (err) {
        setError('Failed to connect to server. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (registrationId) {
      verifyRegistration();
    }
  }, [registrationId, eventId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Verifying Registration...</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Please wait while we verify your registration</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Connection Error</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{error}</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!data?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Invalid Registration</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{data?.message || 'Registration not found'}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-4 font-mono">ID: {registrationId}</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </Link>
        </motion.div>
      </div>
    );
  }

  const { registration } = data;
  const user = registration?.user;
  const event = registration?.event;
  const isApproved = registration?.approvalStatus === 'approved';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto"
      >
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Status Banner */}
          <div className={`p-6 text-center ${isApproved ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'}`}>
            {isApproved ? (
              <CheckCircle className="w-16 h-16 text-white mx-auto mb-3" />
            ) : (
              <Clock className="w-16 h-16 text-white mx-auto mb-3" />
            )}
            <h1 className="text-2xl font-bold text-white">
              {isApproved ? 'Registration Verified' : 'Pending Approval'}
            </h1>
            <p className="text-white/80 mt-1">
              {isApproved ? 'This registration is valid and approved' : 'Waiting for organizer approval'}
            </p>
          </div>

          {/* Registration Details */}
          <div className="p-6 space-y-6">
            {/* Event Info */}
            {event && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Event Details
                </h2>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">{event.title}</p>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{event.venue}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{event.time}</span>
                  </div>
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      event.status === 'upcoming' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      event.status === 'ongoing' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                    }`}>
                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* User Info */}
            {user && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-500" />
                  Attendee Details
                </h2>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-gray-800 dark:text-white">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{user.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <IdCard className="w-4 h-4 text-gray-400" />
                    <span>{user.regId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span>{user.department}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    <span>Year {user.year}, Section {user.section}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Registration Info */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <IdCard className="w-5 h-5 text-orange-500" />
                Registration Info
              </h2>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Registration ID</span>
                  <span className="font-mono text-sm text-gray-800 dark:text-white truncate max-w-[180px]">{registration?.registrationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Status</span>
                  <span className={`font-medium ${isApproved ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {registration?.approvalStatus ? registration.approvalStatus.charAt(0).toUpperCase() + registration.approvalStatus.slice(1) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Registered At</span>
                  <span className="text-gray-800 dark:text-white">
                    {registration?.registeredAt ? new Date(registration.registeredAt).toLocaleString() : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">EventHub - College Event Management</p>
              <Link
                to="/"
                className="mt-4 inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go to EventHub
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyRegistration;
