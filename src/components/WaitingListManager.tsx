import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, X, Mail, BookOpen, Calendar, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/Toast';
import { Registration } from '../types';

interface WaitingListManagerProps {
  eventId: string;
  eventTitle?: string;
  onUpdate?: () => void;
  renderRegistrationExtra?: (reg: any) => React.ReactNode;
}

const WaitingListManager: React.FC<WaitingListManagerProps> = ({ eventId, onUpdate, renderRegistrationExtra }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [pendingRegistrations, setPendingRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  // allow multiple concurrent processing states (approve/reject per registration)
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchPendingRegistrations();
    }
  }, [eventId, userId]);

  const fetchPendingRegistrations = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/events/${eventId}/registrations/pending?userId=${userId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch pending registrations');
      }
      
      const data = await response.json();
      setPendingRegistrations(data.registrations || []);
    } catch (error: any) {
      console.error('Error fetching pending registrations:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to load waiting list',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (registrationId: string) => {
    try {
      setProcessingIds(prev => [...prev, registrationId]);
      const response = await fetch(
        `${API_BASE_URL}/api/events/${eventId}/registrations/${registrationId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve registration');
      }
      
      addToast({
        type: 'success',
        title: 'Approved',
        message: 'Registration approved successfully. User can now access their QR code.',
      });
      
      // Refresh the list
      await fetchPendingRegistrations();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error approving registration:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to approve registration',
      });
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== registrationId));
    }
  };

  const handleReject = async (registrationId: string) => {
    try {
      setProcessingIds(prev => [...prev, registrationId]);
      const response = await fetch(
        `${API_BASE_URL}/api/events/${eventId}/registrations/${registrationId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            reason: rejectionReason || 'No reason provided'
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject registration');
      }
      
      addToast({
        type: 'info',
        title: 'Rejected',
        message: 'Registration rejected and user has been notified.',
      });
      
      // Refresh the list
      await fetchPendingRegistrations();
      setShowRejectModal(null);
      setRejectionReason('');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error rejecting registration:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to reject registration',
      });
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== registrationId));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 sm:py-12">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (pendingRegistrations.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-lg border border-gray-200">
        <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-3 sm:mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 px-4">No Pending Registrations</h3>
        <p className="text-sm sm:text-base text-gray-500 px-4">All registrations have been processed or auto-approved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Waiting List</h3>
          <p className="text-xs sm:text-sm text-gray-600">
            {pendingRegistrations.length} {pendingRegistrations.length === 1 ? 'student' : 'students'} waiting for approval
          </p>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {pendingRegistrations.map((registration) => {
          const registrationUser = registration.user || registration.userId;
          const regId = (registration as any)._id || registration.id;
          const isProcessing = processingIds.includes(regId as string);

          return (
            <motion.div
              key={regId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                      {typeof registrationUser === 'object' && registrationUser.name 
                        ? registrationUser.name.charAt(0).toUpperCase()
                        : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                        {typeof registrationUser === 'object' ? registrationUser.name : 'Unknown User'}
                      </h4>
                      <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{typeof registrationUser === 'object' ? registrationUser.email : ''}</span>
                      </div>
                      {/* Show student's roll number (user.regId) when available, otherwise show registration id */}
                      <div className="mt-2 text-xs text-gray-500">
                        {typeof registrationUser === 'object' && (registrationUser as any).regId ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">
                            Roll No: {(registrationUser as any).regId}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">
                            Reg ID: {(registration as any).registrationId || regId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                    {typeof registrationUser === 'object' && (
                      <>
                        <div className="flex items-center gap-1 sm:gap-2 text-gray-600">
                          <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{registrationUser.department} - Year {registrationUser.year}</span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 text-gray-600">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>
                            {new Date(registration.registeredAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </>
                    )}
                    {/* Optional extra renderer provided by parent for additional registration info */}
                    {renderRegistrationExtra && (
                      <div className="col-span-1 sm:col-span-2 mt-2">
                        {renderRegistrationExtra(registration)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto sm:ml-4">
                  <button
                    onClick={() => handleApprove(regId)}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    title="Approve registration"
                  >
                    <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{isProcessing ? 'Processing...' : 'Approve'}</span>
                    <span className="sm:hidden">✓</span>
                  </button>
                  <button
                    onClick={() => setShowRejectModal(regId)}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    title="Reject registration"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Reject</span>
                    <span className="sm:hidden">✗</span>
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4"
            onClick={() => setShowRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full mx-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Reject Registration</h3>
                  <p className="text-xs sm:text-sm text-gray-600">Provide a reason for rejection (optional)</p>
                </div>
              </div>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm sm:text-base"
                rows={4}
              />

              <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
                <button
                  onClick={() => {
                    setShowRejectModal(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(showRejectModal!)}
                  disabled={showRejectModal == null || processingIds.includes(showRejectModal)}
                  className="flex-1 px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {showRejectModal != null && processingIds.includes(showRejectModal) ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WaitingListManager;
