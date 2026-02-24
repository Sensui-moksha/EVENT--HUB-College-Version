import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import {
  Users,
  UserCheck,
  UserX,
  Bell,
  ArrowLeft,
  Clock,
  Mail,
  CreditCard,
  GraduationCap,
  Building
} from 'lucide-react';

interface WaitlistUser {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    regId: string;
    department: string;
    year: string;
  };
  position: number;
  joinedAt: string;
}

const WaitlistManagement: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;

  const [waitlistUsers, setWaitlistUsers] = useState<WaitlistUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState('');

  useEffect(() => {
    if (eventId && userId) {
      fetchWaitlistUsers();
      fetchEventDetails();
    }
  }, [eventId, userId]);

  const fetchEventDetails = async () => {
    try {
      const response = await fetch(`/api/events`);
      if (response.ok) {
        const events = await response.json();
        const event = events.find((e: any) => e.id === eventId || e._id === eventId);
        if (event) {
          setEventTitle(event.title);
        }
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
    }
  };

  const fetchWaitlistUsers = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/waitlist`);

      if (response.ok) {
        const data = await response.json();
        setWaitlistUsers(data.waitlist || []);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load waitlist.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWaitlistUser = async (waitlistUserId: string, userName: string) => {
    if (!window.confirm(`Approve ${userName} from waitlist? This will add them to the event even if at capacity.`)) return;

    try {
      const response = await fetch(`/api/events/${eventId}/waitlist/${waitlistUserId}/approve`, {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok) {
        addToast({
          type: 'success',
          title: 'User Approved!',
          message: `${userName} has been added to the event.`,
        });
        // Refresh waitlist
        fetchWaitlistUsers();
      } else {
        addToast({
          type: 'error',
          title: 'Approval Failed',
          message: data.error || 'Could not approve user.',
        });
      }
    } catch (error) {
      console.error('Error approving waitlist user:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to approve user.',
      });
    }
  };

  const handleRemoveFromWaitlist = async (waitlistUserId: string, userName: string) => {
    if (!window.confirm(`Remove ${userName} from waitlist?`)) return;

    try {
      const response = await fetch(`/api/events/${eventId}/waitlist/${waitlistUserId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        addToast({
          type: 'success',
          title: 'User Removed',
          message: `${userName} has been removed from the waitlist.`,
        });
        fetchWaitlistUsers();
      } else {
        const data = await response.json();
        addToast({
          type: 'error',
          title: 'Removal Failed',
          message: data.error || 'Could not remove user.',
        });
      }
    } catch (error) {
      console.error('Error removing from waitlist:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to remove user.',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-20 pb-8 px-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-20 pb-8 px-4 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <motion.button
          onClick={() => navigate(`/events/${eventId}`)}
          className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Event</span>
        </motion.button>

        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl shadow-lg">
              <Users className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Waitlist Management</h1>
              {eventTitle && (
                <p className="text-gray-600 text-lg mt-1">
                  Event: {eventTitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>
              {waitlistUsers.length} {waitlistUsers.length === 1 ? 'person' : 'people'} waiting
            </span>
          </div>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-start space-x-3">
            <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Waitlist Management Works:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Approving a user will register them even if the event is at capacity</li>
                <li>Approved users will receive a notification automatically</li>
                <li>Removing a user will delete them from the waitlist without notification</li>
                <li>Users are listed in the order they joined (position #1 joined first)</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Waitlist Content */}
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-6 sm:p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {waitlistUsers.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Users on Waitlist</h3>
              <p className="text-gray-600">
                There are currently no users waiting for this event.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {waitlistUsers.map((waitlistUser, index) => (
                <motion.div
                  key={waitlistUser._id}
                  className="p-5 bg-gradient-to-r from-gray-50 to-yellow-50 rounded-xl border-2 border-yellow-200 hover:border-yellow-400 transition-all hover:shadow-md"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md">
                          #{waitlistUser.position}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-lg font-bold text-gray-900 truncate">
                            {waitlistUser.user.name}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3.5 h-3.5" />
                            <p className="truncate">{waitlistUser.user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* User Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-700">
                            {waitlistUser.user.regId}
                          </span>
                        </div>
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-700">
                            {waitlistUser.user.department}
                          </span>
                        </div>
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-700">
                            Year {waitlistUser.user.year}
                          </span>
                        </div>
                        <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-700">
                            {format(new Date(waitlistUser.joinedAt), 'MMM dd')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-row lg:flex-col gap-3 w-full lg:w-auto">
                      <button
                        onClick={() => handleApproveWaitlistUser(waitlistUser._id, waitlistUser.user.name)}
                        className="flex-1 lg:flex-none px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg font-medium flex items-center justify-center space-x-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRemoveFromWaitlist(waitlistUser._id, waitlistUser.user.name)}
                        className="flex-1 lg:flex-none px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg font-medium flex items-center justify-center space-x-2"
                      >
                        <UserX className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Statistics Card */}
        {waitlistUsers.length > 0 && (
          <motion.div
            className="mt-6 bg-white rounded-xl shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Waitlist Statistics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-gray-600 mb-1">Total Waiting</p>
                <p className="text-3xl font-bold text-yellow-700">{waitlistUsers.length}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Earliest Join Date</p>
                <p className="text-lg font-bold text-blue-700">
                  {waitlistUsers.length > 0 
                    ? format(new Date(waitlistUsers[0].joinedAt), 'MMM dd, yyyy')
                    : 'N/A'
                  }
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                <p className="text-sm text-gray-600 mb-1">Latest Join Date</p>
                <p className="text-lg font-bold text-purple-700">
                  {waitlistUsers.length > 0 
                    ? format(new Date(waitlistUsers[waitlistUsers.length - 1].joinedAt), 'MMM dd, yyyy')
                    : 'N/A'
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default WaitlistManagement;
