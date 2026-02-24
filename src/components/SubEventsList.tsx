import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubEvent } from '../types/subEvent';
import SubEventCard from './SubEventCard';
import { Plus, Calendar, Grid, List } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../utils/api';

interface SubEventsListProps {
  eventId: string;
  canCreateSubEvent?: boolean;
}

export default function SubEventsList({ eventId, canCreateSubEvent = false }: SubEventsListProps) {
  const navigate = useNavigate();
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchSubEvents();
  }, [eventId]);

  const fetchSubEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/sub-events`);

      if (response.ok) {
        const data = await response.json();
        // Backend returns { subEvents: [...] }
        setSubEvents(data.subEvents || []);
      } else {
        setSubEvents([]);
      }
    } catch (error) {
      console.error('Error fetching sub-events:', error);
      setSubEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubEvents = filterStatus === 'all' 
    ? subEvents 
    : subEvents.filter(se => se.status === filterStatus);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Don't show the section at all if there are no sub-events and user can't create them
  if (subEvents.length === 0 && !canCreateSubEvent) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">
            Sub-Events ({filteredSubEvents.length})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-500 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-blue-500 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Create Button */}
          {canCreateSubEvent && (
            <button
              onClick={() => navigate(`/events/${eventId}/create-sub-event`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Create Sub-Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Events Grid/List */}
      {filteredSubEvents.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-gray-300">
          <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Sub-Events Yet
          </h3>
          <p className="text-gray-600 mb-6">
            {filterStatus === 'all' 
              ? 'Create your first sub-event to get started!'
              : `No sub-events with status: ${filterStatus}`
            }
          </p>
          {canCreateSubEvent && filterStatus === 'all' && (
            <button
              onClick={() => navigate(`/events/${eventId}/create-sub-event`)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Create Sub-Event</span>
            </button>
          )}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {filteredSubEvents.map((subEvent) => (
            <motion.div key={subEvent._id} variants={itemVariants}>
              <SubEventCard subEvent={subEvent} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
