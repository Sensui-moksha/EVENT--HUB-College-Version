import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Loader2,
  UserPlus,
  Mail,
} from 'lucide-react';
import { API_BASE_URL } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';

interface TeamMember {
  userId: string;
  role: string;
  joinedAt: string;
}

interface InvitationData {
  _id: string;
  team: {
    _id: string;
    name: string;
    members: TeamMember[];
    maxMembers: number;
    status: string;
  };
  event: {
    _id: string;
    title: string;
    date: string;
    venue?: string;
    registrationDeadline: string;
  };
  invitedBy: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  invitedEmail: string;
  inviteType: 'platform_user' | 'non_platform';
  message?: string;
  expiresAt: string;
}

const JoinTeam: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [success, setSuccess] = useState(false);

  const isAuthenticated = !!user;

  const validateToken = useCallback(async () => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/validate-token/${token}`);
      const data = await response.json();

      if (data.valid) {
        setInvitation(data.invitation);
      } else {
        setError(data.error || 'Invalid invitation');
      }
    } catch (err) {
      setError('Failed to validate invitation');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const handleAcceptInvitation = async () => {
    if (!invitation || !user) return;

    setAccepting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/accept-token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id || user.id }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        addToast({
          type: 'success',
          title: 'Welcome to the team!',
          message: `You have joined ${invitation.team.name}`,
        });
        // Redirect to event details after 2 seconds
        setTimeout(() => {
          navigate(`/events/${invitation.event._id}`);
        }, 2000);
      } else {
        if (data.requiresEventRegistration) {
          addToast({
            type: 'info',
            title: 'Registration Required',
            message: 'Please register for the event first',
          });
          // Redirect to event page to register
          navigate(`/events/${data.eventId}`);
        } else {
          setError(data.error || 'Failed to accept invitation');
        }
      }
    } catch (err) {
      setError('Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleLoginRedirect = () => {
    // Store the current URL to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', `/join-team/${token}`);
    navigate('/login');
  };

  const handleRegisterRedirect = () => {
    // Store the current URL to redirect back after registration
    sessionStorage.setItem('redirectAfterLogin', `/join-team/${token}`);
    navigate('/register');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <Loader2 className="w-12 h-12 mx-auto text-purple-600 animate-spin mb-4" />
          <p className="text-gray-600">Validating invitation...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Go to Home
          </button>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4"
          >
            <CheckCircle className="w-10 h-10 text-green-600" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the Team!</h1>
          <p className="text-gray-600 mb-2">
            You have successfully joined <strong>{invitation?.team.name}</strong>
          </p>
          <p className="text-sm text-gray-500">Redirecting to event page...</p>
        </motion.div>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg w-full"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-8 text-white text-center">
          <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Team Invitation</h1>
          <p className="text-purple-200">You've been invited to join a team!</p>
        </div>

        {/* Invitation Details */}
        <div className="p-6 space-y-6">
          {/* Invited by */}
          <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-xl">
            <div className="w-14 h-14 rounded-full bg-purple-200 flex items-center justify-center overflow-hidden">
              {invitation.invitedBy.avatar ? (
                <img
                  src={invitation.invitedBy.avatar}
                  alt={invitation.invitedBy.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-purple-600">
                  {invitation.invitedBy.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Invited by</p>
              <p className="font-semibold text-gray-900">{invitation.invitedBy.name}</p>
              <p className="text-xs text-gray-500">{invitation.invitedBy.email}</p>
            </div>
          </div>

          {/* Team Info */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Team</p>
                <p className="font-bold text-gray-900">{invitation.team.name}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Members</span>
              <span className="font-medium">
                {invitation.team.members.length}/{invitation.team.maxMembers}
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                style={{
                  width: `${(invitation.team.members.length / invitation.team.maxMembers) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Event Info */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Event</p>
                <p className="font-bold text-gray-900">{invitation.event.title}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{new Date(invitation.event.date).toLocaleDateString()}</span>
              </div>
              {invitation.event.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{invitation.event.venue}</span>
                </div>
              )}
            </div>
          </div>

          {/* Personal message */}
          {invitation.message && (
            <div className="p-4 bg-gray-50 rounded-xl italic text-gray-600">
              "{invitation.message}"
            </div>
          )}

          {/* Expiration warning */}
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            <Clock className="w-4 h-4" />
            <span>
              Expires on {new Date(invitation.expiresAt).toLocaleDateString()}
            </span>
          </div>

          {/* Actions */}
          {isAuthenticated ? (
            <button
              onClick={handleAcceptInvitation}
              disabled={accepting}
              className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Joining Team...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Accept & Join Team
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>You need to sign in to accept this invitation</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleLoginRedirect}
                  className="py-2.5 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRegisterRedirect}
                  className="py-2.5 px-4 border-2 border-purple-600 text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Register
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default JoinTeam;
