import { useNavigate } from 'react-router-dom';
import { SubEvent } from '../types/subEvent';
import AccessControlBadge from './AccessControlBadge';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, MapPin, Users, Tag, Trophy, Edit3, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface SubEventCardProps {
  subEvent: SubEvent;
  showEditButton?: boolean;
}

export default function SubEventCard({ subEvent, showEditButton = true }: SubEventCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getStatusStyles = () => {
    switch (subEvent.status) {
      case 'upcoming':
        return { bg: 'bg-gradient-to-r from-green-500 to-emerald-600', text: 'text-white', icon: '🎯' };
      case 'ongoing':
        return { bg: 'bg-gradient-to-r from-blue-500 to-indigo-600', text: 'text-white', icon: '🔴' };
      case 'completed':
        return { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white', icon: '✅' };
      case 'cancelled':
        return { bg: 'bg-gradient-to-r from-red-500 to-rose-600', text: 'text-white', icon: '❌' };
      default:
        return { bg: 'bg-gradient-to-r from-yellow-500 to-amber-600', text: 'text-white', icon: '⏳' };
    }
  };

  const isOrganizer = user?.role === 'admin' || user?.role === 'organizer' || 
    userId === subEvent.organizerId;

  const statusStyles = getStatusStyles();
  const registeredCount = subEvent.currentParticipants || subEvent.registeredCount || 0;
  const maxParticipants = subEvent.maxParticipants || subEvent.capacity || 0;
  const progressPercent = maxParticipants > 0 ? Math.min((registeredCount / maxParticipants) * 100, 100) : 0;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/sub-events/${subEvent._id}/edit`);
  };

  return (
    <motion.div
      whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(59, 130, 246, 0.2)' }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-lg hover:shadow-2xl cursor-pointer transition-all group relative"
      onClick={() => navigate(`/sub-events/${subEvent._id}`)}
    >
      {/* Gradient Overlay Top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

      {/* Image Section */}
      {(subEvent.imageUrl || subEvent.image) ? (
        <div className="relative h-52 overflow-hidden">
          <img
            src={subEvent.imageUrl || subEvent.image}
            alt={subEvent.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
          
          {/* Floating Status Badge */}
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusStyles.bg} ${statusStyles.text} shadow-lg`}>
              <span>{statusStyles.icon}</span>
              <span className="capitalize">{subEvent.status}</span>
            </span>
          </div>

          {/* Edit Button */}
          {showEditButton && isOrganizer && (
            <button
              onClick={handleEdit}
              className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
              title="Edit Sub-Event"
            >
              <Edit3 className="w-4 h-4 text-gray-700" />
            </button>
          )}

          {/* Bottom Info Overlay */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-xl font-bold text-white mb-1 line-clamp-2 drop-shadow-lg">
              {subEvent.title}
            </h3>
            <div className="flex items-center gap-2">
              {subEvent.isTeamEvent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/90 text-white rounded-full text-xs font-medium">
                  <Users className="w-3 h-3" />
                  Team ({subEvent.minTeamSize || 2}-{subEvent.maxTeamSize || 4})
                </span>
              )}
              <AccessControlBadge accessControl={subEvent.accessControl} size="sm" />
            </div>
          </div>
        </div>
      ) : (
        /* No Image Fallback */
        <div className="relative h-36 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-5">
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm text-white shadow-lg`}>
              <span>{statusStyles.icon}</span>
              <span className="capitalize">{subEvent.status}</span>
            </span>
          </div>
          
          {showEditButton && isOrganizer && (
            <button
              onClick={handleEdit}
              className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/40 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
              title="Edit Sub-Event"
            >
              <Edit3 className="w-4 h-4 text-white" />
            </button>
          )}

          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-xl font-bold text-white mb-1 line-clamp-2">
              {subEvent.title}
            </h3>
            <div className="flex items-center gap-2">
              {subEvent.isTeamEvent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white rounded-full text-xs font-medium">
                  <Users className="w-3 h-3" />
                  Team ({subEvent.minTeamSize || 2}-{subEvent.maxTeamSize || 4})
                </span>
              )}
              <AccessControlBadge accessControl={subEvent.accessControl} size="sm" />
            </div>
          </div>
        </div>
      )}

      {/* Content Section */}
      <div className="p-5 space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {subEvent.description}
        </p>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg">
            <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-medium text-blue-900 truncate">
              {formatDate(subEvent.date)}
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-purple-50 rounded-lg">
            <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span className="text-xs font-medium text-purple-900 truncate">
              {subEvent.time || 'TBA'}
            </span>
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg col-span-2">
            <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-xs font-medium text-green-900 truncate">
              {subEvent.venue || 'Venue TBA'}
            </span>
          </div>
        </div>

        {/* Registration Progress */}
        {maxParticipants > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600 font-medium flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Registration Progress
              </span>
              <span className="font-bold text-gray-900">
                {registeredCount} / {maxParticipants}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  progressPercent >= 90 ? 'bg-gradient-to-r from-red-500 to-orange-500' :
                  progressPercent >= 70 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                  'bg-gradient-to-r from-blue-500 to-indigo-600'
                }`}
              />
            </div>
            {progressPercent >= 90 && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Almost full! Register now
              </p>
            )}
          </div>
        )}

        {/* Tags & Prizes */}
        <div className="flex flex-wrap gap-2">
          {subEvent.category && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
              <Tag className="w-3 h-3" />
              {subEvent.category}
            </span>
          )}
          {subEvent.prizes && subEvent.prizes.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
              <Trophy className="w-3 h-3" />
              Prizes Available
            </span>
          )}
        </div>

        {/* Tags */}
        {subEvent.tags && subEvent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {subEvent.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium"
              >
                #{tag}
              </span>
            ))}
            {subEvent.tags.length > 3 && (
              <span className="text-xs px-2 py-0.5 text-gray-500">
                +{subEvent.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* View Details Button */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-600 font-semibold group-hover:text-blue-700 flex items-center gap-1">
              View Details
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
            {subEvent.status === 'completed' && (
              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <Trophy className="w-3.5 h-3.5" />
                View Winners
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
