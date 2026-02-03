import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Trophy,
  ChevronRight,
  Lock,
  Info,
  CheckCircle
} from 'lucide-react';
import { Event } from '../types';
import { useEvents } from '../contexts/EventContext';
import { cardHoverVariants } from '../utils/animations';
import { displayCategoryLabel, getCategoryColor as getCategoryColorUtil } from '../utils/categories';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../utils/api';

interface EventCardProps {
  event: Event;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const { user } = useAuth();
  const getCategoryColor = (category?: string) => getCategoryColorUtil(category);

  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;

  // State for pending registrations count
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingPending, setLoadingPending] = useState(false);

  // Check if user is organizer or admin
  const isOrganizer = (event as any).organizerId === userId;
  const isAdmin = user?.role === 'admin';
  const canManageEvent = isOrganizer || isAdmin;

  // Fetch pending count for organizers/admins
  useEffect(() => {
    if (!canManageEvent || !event || event.autoApproval) return;

    const fetchPendingCount = async () => {
      try {
        setLoadingPending(true);
        const eventId = event.id || (event as any)._id;
        const response = await fetch(
          `${API_BASE_URL}/api/events/${eventId}/registrations/pending?userId=${userId}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setPendingCount(data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching pending count:', error);
      } finally {
        setLoadingPending(false);
      }
    };

    fetchPendingCount();
  }, [canManageEvent, event, userId]);

  const getStatusColor = (status: Event['status']) => {
    switch (status) {
      case 'upcoming':
        return 'bg-green-100 text-green-800';
      case 'ongoing':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-600 text-white font-semibold shadow-md';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isRegistrationOpen = new Date() < event.registrationDeadline && event.status === 'upcoming';
  const isFull = event.currentParticipants >= event.maxParticipants;
  
  // Check if event date has passed (event should be completed)
  const eventDatePassed = new Date() > new Date(event.date);

  // Detect if event has sub-events using several possible shapes from backend
  const subEventCount: number =
    (event as any)?.subEvents?.length ??
    (event as any)?.subevents?.length ??
    (event as any)?.children?.length ??
    (event as any)?.subEventCount ??
    (event as any)?.sub_events_count ??
    0;
  const hasSubEvents = subEventCount > 0;
  
  // Check if sub-event count is being fetched (undefined means not yet fetched vs 0 means fetched and none exist)
  const subEventCountLoading = 
    (event as any)?.subEventCount === undefined &&
    (event as any)?.subEvents === undefined &&
    (event as any)?.subevents === undefined &&
    (event as any)?.children === undefined &&
    (event as any)?.sub_events_count === undefined;

  // Access control badge (only for admins/organizers/owner)
  const ac: any = (event as any)?.accessControl || { type: 'everyone' };
  const isRestricted = !!ac?.type && ac.type !== 'everyone';
  const isPrivileged = user?.role === 'admin' || user?.role === 'organizer' || userId === (event as any)?.organizerId;
  
  // Check if user can register for this event
  const canUserRegister = (() => {
    if (!isRestricted) return true;
    if (!user) return false;
    if (ac.type === 'students_only') return user.role === 'student';
    if (ac.type === 'faculty_only') return user.role === 'faculty';
    if (ac.type === 'custom') {
      if (Array.isArray(ac.allowedRoles) && ac.allowedRoles.length > 0 && !ac.allowedRoles.includes(user.role)) return false;
      if (Array.isArray(ac.allowedDepartments) && ac.allowedDepartments.length > 0 && user.department && !ac.allowedDepartments.includes(user.department)) return false;
      if (user.role === 'student' && Array.isArray(ac.allowedYears) && ac.allowedYears.length > 0 && user.year && !ac.allowedYears.includes(user.year)) return false;
      return true;
    }
    return true;
  })();

  const buildRequirementText = (acObj: any) => {
    if (!acObj?.type || acObj.type === 'everyone') return 'Open to everyone';
    if (acObj.type === 'students_only') return 'Students only';
    if (acObj.type === 'faculty_only') return 'Faculty only';
    if (acObj.type === 'custom') {
      const parts: string[] = [];
      if (Array.isArray(acObj.allowedRoles) && acObj.allowedRoles.length > 0) parts.push(`Roles: ${acObj.allowedRoles.join(', ')}`);
      if (Array.isArray(acObj.allowedDepartments) && acObj.allowedDepartments.length > 0) parts.push(`Departments: ${acObj.allowedDepartments.join(', ')}`);
      if (Array.isArray(acObj.allowedYears) && acObj.allowedYears.length > 0) parts.push(`Years: ${acObj.allowedYears.join(', ')}`);
      return parts.length ? parts.join(' • ') : 'Custom access';
    }
    return 'Restricted access';
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Allow text selection - only navigate if not selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      e.preventDefault();
      return;
    }
  };

  // Use registrations from context as a more authoritative source for current participant count
  const { registrations } = useEvents();
  const backendEventId = (event as any)._id || event.id;
  const countedParticipants = registrations
    ? registrations.filter((r: any) => String(r.eventId) === String(backendEventId) && r.approvalStatus === 'approved').length
    : 0;

  // Prefer the counted value when available (i.e., registrations loaded). Fallback to event.currentParticipants.
  const displayedParticipants = countedParticipants > 0 ? countedParticipants : (event.currentParticipants || 0);
  const displayedProgress = event.maxParticipants ? Math.round((displayedParticipants / event.maxParticipants) * 100) : 0;
  const displayedProgressWidth = event.maxParticipants ? Math.min((displayedParticipants / event.maxParticipants) * 100, 100) : 0;

  return (
    <Link 
      to={`/events/${event.id || (event as any)._id}`}
      onClick={handleCardClick}
      className="block"
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      <motion.div
        variants={cardHoverVariants}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300 group cursor-pointer"
      >
      {/* Event Image */}
      {event.image && (() => {
        // Check if image is portrait (tall) - show full image for posters
        const isPortrait = event.imageWidth && event.imageHeight && event.imageHeight > event.imageWidth;
        
        return (
          <div className={`relative overflow-hidden ${isPortrait ? '' : 'aspect-[4/3]'} bg-gray-100`}>
            <img
              src={event.image}
              alt={event.title}
              loading="lazy"
              className={`w-full group-hover:scale-105 transition-transform duration-300 ${
                isPortrait 
                  ? 'h-auto object-contain' 
                  : 'h-full object-cover'
              }`}
            />
            <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex flex-wrap gap-2">
              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(event.category)}`}>
                  {displayCategoryLabel(event.category)}
              </span>
              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
              {canManageEvent && !event.autoApproval && pendingCount > 0 && !loadingPending && (
                <span
                  className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-yellow-500 text-white border border-yellow-600 shadow-sm"
                  title={`${pendingCount} registration${pendingCount > 1 ? 's' : ''} pending approval`}
                >
                  <Clock className="w-3 h-3" /> {pendingCount} Pending
                </span>
            )}
            {isPrivileged && isRestricted && (
              <span
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-red-100 text-red-700 border border-red-200"
                title={buildRequirementText(ac)}
              >
                <Lock className="w-3 h-3" /> Restricted
              </span>
            )}
            {/* Show restricted badge for non-privileged users who can't register */}
            {!isPrivileged && isRestricted && !canUserRegister && (
              <span
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200"
                title={`Registration restricted: ${buildRequirementText(ac)}`}
              >
                <Lock className="w-3 h-3" /> {buildRequirementText(ac)}
              </span>
            )}
            {subEventCountLoading && (
              <span
                className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 animate-pulse"
                title="Loading sub-events..."
              >
                Sub Events (...)
              </span>
            )}
            {hasSubEvents && !subEventCountLoading && (
              <span
                className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                title={`${subEventCount} sub-event${subEventCount > 1 ? 's' : ''}`}
              >
                {`Sub Events (${subEventCount})`}
              </span>
            )}
            </div>
          </div>
        );
      })()}

      <div className="p-4 sm:p-6">
        {/* Event Title */}
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
          {event.title}
        </h3>

        {/* Event Description */}
        <p className="text-gray-600 text-sm mb-3 sm:mb-4 line-clamp-2">
          {event.description}
        </p>

        {/* Event Details */}
        <div className="space-y-2 mb-3 sm:mb-4">
          <div className="flex items-center text-xs sm:text-sm text-gray-600">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-blue-500 flex-shrink-0" />
            <span className="truncate">{format(new Date(event.date), 'MMM dd, yyyy')}</span>
          </div>
          <div className="flex items-center text-xs sm:text-sm text-gray-600">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-blue-500 flex-shrink-0" />
            <span className="truncate">{event.time}</span>
          </div>
          <div className="flex items-center text-xs sm:text-sm text-gray-600">
            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-blue-500 flex-shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>
          <div className="flex items-center text-xs sm:text-sm text-gray-600">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-blue-500 flex-shrink-0" />
            <span className="truncate">{displayedParticipants} / {event.maxParticipants} participants</span>
          </div>
          {(event as any).isTeamEvent && (
            <div className="flex items-center text-xs sm:text-sm text-gray-600">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-purple-500 flex-shrink-0" />
              <span className="truncate">
                <span className="font-medium text-purple-700">Team Event</span>
                <span className="text-gray-400 mx-1">•</span>
                {(event as any).minTeamSize || 2}-{(event as any).maxTeamSize || 4} members
              </span>
            </div>
          )}
          <div className="flex items-center text-xs sm:text-sm text-gray-600">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-yellow-500 flex-shrink-0" />
            <span className="truncate">Reg. Deadline: {event.registrationDeadline ? format(new Date(event.registrationDeadline), 'MMM dd, yyyy hh:mm a') : '-'}</span>
          </div>
        </div>

        {/* Prizes */}
        {event.prizes && event.prizes.length > 0 && (
          <div className="flex items-center text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
            <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-yellow-500 flex-shrink-0" />
            <span className="truncate">Prizes: {event.prizes.join(', ')}</span>
          </div>
        )}

        {/* Eligibility (admin/organizer/owner only) */}
        {isPrivileged && (
          <div className="mb-3 sm:mb-4 text-[11px] sm:text-xs text-gray-600 flex items-start gap-1.5">
            {isRestricted ? (
              <Lock className="w-3.5 h-3.5 text-red-600 mt-0.5" />
            ) : (
              <Info className="w-3.5 h-3.5 text-green-600 mt-0.5" />
            )}
            <div className="leading-snug">
              <span className="font-semibold">Eligibility:</span>{' '}
              <span title={buildRequirementText(ac)}>{buildRequirementText(ac)}</span>
            </div>
          </div>
        )}

        {/* Registration Status */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center space-x-2">
            {event.status === 'completed' ? (
              <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded-full flex items-center gap-1 border border-blue-200">
                <CheckCircle className="w-3.5 h-3.5 text-blue-600" /> Event Completed
              </span>
            ) : event.status === 'cancelled' ? (
              <span className="text-xs text-red-600 font-medium">Cancelled</span>
            ) : event.status === 'ongoing' ? (
              <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-1 rounded-full flex items-center gap-1 border border-yellow-200">
                <Clock className="w-3.5 h-3.5 text-yellow-600" /> Event Ongoing
              </span>
            ) : eventDatePassed ? (
              <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-1 rounded-full flex items-center gap-1 border border-gray-200">
                <CheckCircle className="w-3.5 h-3.5 text-gray-500" /> Event Ended
              </span>
            ) : isFull ? (
              <span className="text-xs text-orange-600 font-medium">Event Full</span>
            ) : isRegistrationOpen ? (
              <span className="text-xs text-green-600 font-medium">Registration Open</span>
            ) : (
              <span className="text-xs text-red-600 font-medium">Registration Closed</span>
            )}
          </div>
          <span
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium text-xs sm:text-sm group-hover:translate-x-1 transition-all"
          >
            <span>View Details</span>
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
          </span>
        </div>

        {/* Progress Bar / Attendance for completed events */}
        {event.status === 'completed' ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-green-600" />
              <span className="font-medium">Total Attendees:</span>
            </span>
            <span className="font-bold text-green-700">{displayedParticipants}</span>
          </div>
        ) : (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Registration Progress</span>
              <span>{displayedProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                style={{ width: `${displayedProgressWidth}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
    </Link>
  );
};

export default EventCard;