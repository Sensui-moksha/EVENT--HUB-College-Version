import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../contexts/EventContext.tsx';
import EventCard from '../components/EventCard';
import { 
  Calendar, 
  Users, 
  Trophy, 
  Zap,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { pageVariants } from '../utils/animations';
import { COLLEGE_CONFIG } from '../config/college';

const Home: React.FC = () => {
  const { user } = useAuth();
  const { events, registrations } = useEvents();
  const navigate = useNavigate();

  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;

  const upcomingEvents = events
    .filter(event => event.status === 'upcoming')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const eventsRef = useRef<HTMLDivElement | null>(null);

  const scrollToEvents = () => {
    const el = eventsRef.current;
    if (!el) return;
    const navbar = document.querySelector('nav');
    const navbarHeight = navbar ? navbar.getBoundingClientRect().height : 80;
    const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight - 16;
    window.scrollTo({ top, left: 0, behavior: 'smooth' });
  };

  const handleStatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToEvents();
    }
  };

  // Get active event IDs (upcoming events)
  const activeEventIds = events.filter(e => e.status === 'upcoming').map(e => e.id);
  
  // Count registrations only for active events (only approved/registered, not pending)
  // Use registrations array when available, fall back to summing event.currentParticipants
  const activeRegistrationsFromRegs = registrations.filter(r => activeEventIds.includes(r.eventId) && (r.approvalStatus === 'approved' || r.status === 'registered')).length;
  const activeRegistrationsFromEvents = events
    .filter(e => e.status === 'upcoming')
    .reduce((sum, e) => sum + (e.currentParticipants || 0), 0);
  const activeRegistrationsCount = activeRegistrationsFromRegs > 0 ? activeRegistrationsFromRegs : activeRegistrationsFromEvents;

  // Compute participant counts from registrations (more authoritative than event.currentParticipants)
  const approvedOrRegistered = (r: { approvalStatus?: string; status?: string }) => r.approvalStatus === 'approved' || r.status === 'registered';
  const totalParticipantsFromRegistrations = registrations.filter(approvedOrRegistered).length;

  const stats = [
    {
      icon: Zap,
      label: 'Active Events',
      value: events.filter(e => e.status === 'upcoming').length,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      icon: TrendingUp,
      label: 'Active Registrations',
      value: activeRegistrationsCount,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      icon: Users,
      label: 'Total Participants',
      value: totalParticipantsFromRegistrations > 0 ? totalParticipantsFromRegistrations : events.reduce((sum, event) => sum + event.currentParticipants, 0),
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      icon: Trophy,
      label: 'Completed Events',
      value: events.filter(e => e.status === 'completed').length,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      icon: Calendar,
      label: 'Total Events',
      value: events.length,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
  ];

  const navigateToEvents = () => {
    navigate('/events', { state: { scrollToEvents: true } });
  };

  const handleEventsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateToEvents();
    }
  };

  const renderStat = (stat: any) => {
    const isClickable = stat.label === 'Total Events' || stat.label === 'Active Events';

    return (
      <div
        key={stat.label}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? navigateToEvents : undefined}
        onKeyDown={isClickable ? handleEventsKeyDown : undefined}
        className={`text-center p-4 sm:p-6 lg:p-8 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:shadow-lg transition-all duration-300 ${isClickable ? 'cursor-pointer' : ''}`}
      >
        <div className={`inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-lg ${stat.bgColor} mb-3 sm:mb-4`}>
          <stat.icon className={`w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 ${stat.color}`} />
        </div>
        <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
          {stat.value.toLocaleString()}
        </div>
        <div className="text-xs sm:text-sm lg:text-base text-gray-600 font-medium">
          {stat.label}
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      className="min-h-screen w-full overflow-x-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Hero Section */}
      <section className="relative w-full bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white py-8 xs:py-10 sm:py-14 md:py-16 lg:py-20 xl:py-24">
        <div className="absolute inset-0 bg-black/20"></div>
        <motion.div 
          className="relative w-full max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 md:px-8 lg:px-8 xl:px-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-full text-center">
            {/* College Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="bg-[#eaeaea] backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-gray-300 shadow-2xl hover:bg-[#e0e0e0] transition-all duration-300">
                <img 
                  src="/logo-mic.png" 
                  alt={COLLEGE_CONFIG.logoAlt} 
                  className="h-12 sm:h-16 lg:h-20 w-auto object-contain mx-auto max-w-sm sm:max-w-md lg:max-w-lg"
                />
              </div>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                EventHub
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 text-blue-100 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
              Your gateway to amazing college events, workshops, and competitions. 
              Discover, register, and participate in events that shape your future.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
              <Link
                to="/events"
                className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl group text-sm sm:text-base"
              >
                <span>Explore Events</span>
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </Link>
              {!user && (
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-transparent border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-all duration-200 text-sm sm:text-base"
                >
                  Join EventHub
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-white">
        <motion.div 
          className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
            {stats.map(renderStat)}
          </div>
        </motion.div>
      </section>

      {/* Featured Events */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <motion.div 
          className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Upcoming Events
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4 sm:px-0">
              Don't miss out on these exciting opportunities to learn, compete, and connect.
            </p>
          </div>

          {upcomingEvents.length > 0 ? (
            <div ref={eventsRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 mb-8 sm:mb-12">
              {upcomingEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 sm:py-12">
              <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">No Upcoming Events</h3>
              <p className="text-sm sm:text-base text-gray-500">Check back soon for new events!</p>
            </div>
          )}

          <div className="text-center">
            <Link
              to="/events"
              className="inline-flex items-center px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl group text-sm sm:text-base"
            >
              <span>View All Events</span>
              <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </Link>
          </div>
        </motion.div>
      </section>


    </motion.div>
  );
};

export default Home;