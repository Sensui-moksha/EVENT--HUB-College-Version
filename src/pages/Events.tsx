import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEvents } from '../contexts/EventContext.tsx';
import { useAuth } from '../contexts/AuthContext';
import EventCard from '../components/EventCard';
import MultiEventRegistration from '../components/MultiEventRegistration';
import { Search, Filter, Calendar, Users, Trophy, Grid, List } from 'lucide-react';
import { pageVariants, staggerContainerVariants, listItemVariants } from '../utils/animations';

const Events: React.FC = () => {
  const { events } = useEvents();
  const { user } = useAuth();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'multi-register'>('grid');

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'technical', label: 'Technical' },
    { value: 'cultural', label: 'Cultural' },
    { value: 'sports', label: 'Sports' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'seminar', label: 'Seminar' },
    { value: 'other', label: 'Other' },
  ];

  const statuses = [
    { value: 'all', label: 'All Status' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
  ];

  const canUserSeeEvent = (event: any) => {
    // Admins/organizers see everything
    if (user?.role === 'admin' || user?.role === 'organizer' || userId === (event as any)?.organizerId) {
      return true;
    }
    const ac = (event as any)?.accessControl || { type: 'everyone' };
    if (!ac?.type || ac.type === 'everyone') return true;
    if (!user) return false; // guests can only see 'everyone'
    if (ac.type === 'students_only') return user.role === 'student';
    if (ac.type === 'faculty_only') return user.role === 'faculty';
    if (ac.type === 'custom') {
      if (Array.isArray(ac.allowedRoles) && ac.allowedRoles.length > 0 && !ac.allowedRoles.includes(user.role)) return false;
      if (Array.isArray(ac.allowedDepartments) && ac.allowedDepartments.length > 0 && user.department && !ac.allowedDepartments.includes(user.department)) return false;
      if (user.role === 'student' && Array.isArray(ac.allowedYears) && ac.allowedYears.length > 0 && user.year && !ac.allowedYears.includes(user.year)) return false;
      return true;
    }
    return true;
  };

  const filteredEvents = useMemo(() => {
    const filtered = events.filter(event => {
      if (!canUserSeeEvent(event)) return false;
      const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           event.description.toLowerCase().includes(searchTerm.toLowerCase());
      const isEventKnown = ['technical','cultural','sports','workshop','seminar'].includes(event.category as string);
      const eventCategoryKey = isEventKnown ? event.category : 'other';
      const matchesCategory = selectedCategory === 'all' || eventCategoryKey === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || event.status === selectedStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
    
    // Sort: active/upcoming events first, then by date (newest first)
    return filtered.sort((a, b) => {
      // Priority order: upcoming > ongoing > completed > cancelled
      const statusPriority: Record<string, number> = {
        'upcoming': 0,
        'ongoing': 1,
        'completed': 2,
        'cancelled': 3
      };
      
      const priorityA = statusPriority[a.status] ?? 4;
      const priorityB = statusPriority[b.status] ?? 4;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Within same status, sort by date (upcoming events: earliest first, completed: newest first)
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      if (a.status === 'upcoming' || a.status === 'ongoing') {
        return dateA - dateB; // Earliest upcoming events first
      }
      return dateB - dateA; // Most recent completed events first
    });
  }, [events, searchTerm, selectedCategory, selectedStatus, user]);

  const eventStats = {
    total: filteredEvents.length,
    upcoming: filteredEvents.filter(e => e.status === 'upcoming').length,
    participants: filteredEvents.reduce((sum, event) => sum + event.currentParticipants, 0),
  };

  const eventsRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  const scrollToEvents = () => {
    const nav = document.querySelector('nav');
    const navHeight = nav ? (nav as HTMLElement).getBoundingClientRect().height : 0;
    const target = eventsRef.current;
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 12;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  // Scroll to events section when navigated from Home page
  useEffect(() => {
    if (location.state?.scrollToEvents) {
      setTimeout(() => {
        scrollToEvents();
      }, 300);
    }
  }, [location.state]);

  const handleStatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToEvents();
    }
  };


  return (
    <motion.div 
      className="min-h-screen pt-16 sm:pt-20 lg:pt-24 pb-8"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Header */}
        <motion.div 
          className="text-center mb-8 sm:mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-3 shadow-sm border border-gray-200">
              <img 
                src="/logo-small.png" 
                alt="College Logo" 
                className="h-12 w-auto object-contain mx-auto"
              />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
            College Events
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4 sm:px-0">
            Discover amazing events happening at our college. From technical competitions to cultural festivals.
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8"
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <div
            role="button"
            tabIndex={0}
            onClick={scrollToEvents}
            onKeyDown={handleStatKeyDown}
            aria-label="Scroll to events list"
            className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="flex items-center">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{eventStats.total}</p>
                <p className="text-xs sm:text-sm text-gray-600">Total Events</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{eventStats.participants}</p>
                <p className="text-xs sm:text-sm text-gray-600">Total Participants</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow sm:col-span-2 lg:col-span-1">
            <div className="flex items-center">
              <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{eventStats.upcoming}</p>
                <p className="text-xs sm:text-sm text-gray-600">Upcoming Events</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 mb-6 sm:mb-8">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="w-full relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Category Filter */}
              <div className="relative flex-1 sm:flex-initial">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-8 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white text-sm sm:text-base sm:min-w-[160px]"
                  aria-label="Filter events by category"
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="relative flex-1 sm:flex-initial">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full pl-4 pr-8 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white text-sm sm:text-base sm:min-w-[140px]"
                  aria-label="Filter events by status"
                >
                  {statuses.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Browse</span>
                </button>
                <button
                  onClick={() => setViewMode('multi-register')}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    viewMode === 'multi-register'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Multi-Register</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content based on view mode */}
        {viewMode === 'grid' ? (
          <>
            {/* Events Grid */}
            {filteredEvents.length > 0 ? (
              <motion.div 
                ref={eventsRef}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8"
                variants={staggerContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {filteredEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: index * 0.1 }}
                  >
                    <EventCard event={event} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                className="text-center py-12 sm:py-16"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">No events found</h3>
                <p className="text-sm sm:text-base text-gray-500">Try adjusting your search criteria.</p>
              </motion.div>
            )}
          </>
        ) : (
          /* Multi-Event Registration */
          <MultiEventRegistration 
            availableEvents={filteredEvents.filter(event => 
              event.status === 'upcoming' && 
              event.currentParticipants < event.maxParticipants &&
              new Date() <= new Date(event.registrationDeadline)
            )}
            onRegistrationComplete={(result) => {
              // ...removed console log for production...
            }}
          />
        )}
      </div>
    </motion.div>
  );
};

export default Events;