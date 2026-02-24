import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { format, formatDistanceToNow } from 'date-fns';
import { exportAnalyticsToExcel, exportSingleEventAnalyticsToExcel } from '../utils/excelExport';
import {
  Calendar,
  TrendingUp,
  Users,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  Award,
  Clock,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Target,
  RefreshCw,
  Filter,
  Flame,
  UserPlus,
  CalendarCheck,
  CalendarX,
  ArrowUpRight,
  Trophy,
  Medal,
  Crown,
  Star,
  Sparkles,
} from 'lucide-react';
import { pageVariants } from '../utils/animations';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
};

const cardHover = {
  scale: 1.02,
  y: -5,
  transition: { type: "spring" as const, stiffness: 300, damping: 20 }
};

interface EventAnalytics {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  totalRegistrations: number;
  totalParticipants: number;
  averageRegistrationsPerEvent: number;
  categoryBreakdown: { category: string; count: number }[];
  registrationTrends: { date: string; count: number }[];
  topEvents: Array<{
    _id: string;
    title: string;
    image: string;
    registrations: number;
    capacity: number;
    date: string;
    status: string;
  }>;
  recentRegistrations: Array<{
    eventTitle: string;
    userName: string;
    registeredAt: string;
    fromWaitlist: boolean;
  }>;
}

const EventAnalytics: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [events, setEvents] = useState<Array<{ _id: string; title: string }>>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'registrations'>('overview');

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/events');

      if (response.ok) {
        const data = await response.json();
        const userEvents = user?.role === 'admin' 
          ? data 
          : data.filter((e: any) => e.organizerId === userId);
        setEvents(userEvents);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, [user?.role, userId]);

  const fetchAnalytics = useCallback(async (opts: { background?: boolean } = {}) => {
    const { background = false } = opts;
    if (!background) setLoading(true);
    if (background) setIsRefreshing(true);
    
    try {
      const url = selectedEvent === 'all'
        ? '/api/analytics/events'
        : `/api/analytics/events/${selectedEvent}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics((prev) => ({ ...(prev || {}), ...data } as EventAnalytics));
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      if (!background) setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedEvent, userId]);

  const pollRef = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const motionDur = shouldReduceMotion ? 0.2 : 0.8;

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'organizer') {
      fetchEvents();
    }
  }, [user?.role, fetchEvents]);

  // Fetch analytics whenever selectedEvent changes
  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'organizer') {
      fetchAnalytics();
    }
  }, [selectedEvent, user?.role, fetchAnalytics]);

  useEffect(() => {
    if (!(user?.role === 'admin' || user?.role === 'organizer')) return;

    const POLL_INTERVAL = 30000;

    pollRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAnalytics({ background: true });
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [user?.role, fetchAnalytics]);

  // Calculate derived metrics
  const getInsights = () => {
    if (!analytics) return null;
    
    const fillRate = analytics.topEvents.length > 0
      ? (analytics.topEvents.reduce((sum, e) => sum + e.registrations, 0) / 
         analytics.topEvents.reduce((sum, e) => sum + e.capacity, 1)) * 100
      : 0;
    
    const successRate = analytics.totalEvents > 0
      ? ((analytics.completedEvents / analytics.totalEvents) * 100)
      : 0;
    
    const attendanceRate = analytics.totalRegistrations > 0
      ? ((analytics.totalParticipants / analytics.totalRegistrations) * 100)
      : 0;
    
    const fullyBookedEvents = analytics.topEvents.filter(e => e.registrations >= e.capacity).length;
    
    const mostPopularCategory = analytics.categoryBreakdown.length > 0
      ? analytics.categoryBreakdown.sort((a, b) => b.count - a.count)[0]
      : null;

    return {
      fillRate,
      successRate,
      attendanceRate,
      fullyBookedEvents,
      mostPopularCategory
    };
  };

  const insights = analytics ? getInsights() : null;

  const exportToExcel = async () => {
    if (!analytics) {
      addToast({ type: 'error', title: 'No Data', message: 'No analytics data available to export.' });
      return;
    }

    try {
      if (selectedEvent === 'all') {
        // Export overall analytics for all events
        await exportAnalyticsToExcel(analytics, 'All Events');
        addToast({ type: 'success', title: 'Export Successful! 📊', message: 'Overall analytics exported with professional styling' });
      } else {
        // Export analytics for the specific selected event
        const eventName = events.find(e => e._id === selectedEvent)?.title || 'Unknown Event';
        await exportSingleEventAnalyticsToExcel(analytics, eventName);
        addToast({ type: 'success', title: 'Export Successful! 📊', message: `${eventName} analytics exported` });
      }
    } catch (error) {
      console.error('Export failed:', error);
      addToast({ type: 'error', title: 'Export Failed', message: 'Failed to export analytics data.' });
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'organizer') {
    return (
      <div className="min-h-screen pt-20 pb-8 px-4 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only admins and organizers can view analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen pt-20 pb-24 px-4 bg-gradient-to-br from-slate-50 via-white to-blue-50"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-indigo-800 to-purple-800 bg-clip-text text-transparent">
                    Analytics Dashboard
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">
                    Real-time insights into your events and registrations
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Refresh Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fetchAnalytics({ background: true })}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium text-gray-700">Refresh</span>
              </motion.button>
              
              {/* Export Button */}
              {analytics && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/30"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="font-semibold text-sm">Export Report</span>
                  <Download className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Event Filter & Tabs */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-gray-200 shadow-sm">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700 pr-8 cursor-pointer"
              >
                <option value="all">All Events</option>
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
              {['overview', 'events', 'registrations'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {loading ? (
          // Loading Skeleton
          <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100"
                >
                  <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse mb-4" />
                  <div className="h-8 bg-gray-200 rounded-lg w-20 animate-pulse mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : analytics ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="space-y-6"
            >
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <>
                  {/* Key Metrics Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Total Events */}
                    <motion.div
                      variants={itemVariants}
                      whileHover={cardHover}
                      className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                            <Calendar className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                            Events
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                          {analytics.totalEvents}
                        </div>
                        <p className="text-sm text-gray-500">Total Events</p>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            {analytics.upcomingEvents} upcoming
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Total Registrations */}
                    <motion.div
                      variants={itemVariants}
                      whileHover={cardHover}
                      className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg shadow-emerald-500/30">
                            <UserPlus className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            Sign-ups
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                          {analytics.totalRegistrations}
                        </div>
                        <p className="text-sm text-gray-500">Total Registrations</p>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          <span className="flex items-center text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {analytics.averageRegistrationsPerEvent.toFixed(1)}/event
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Success Rate */}
                    <motion.div
                      variants={itemVariants}
                      whileHover={cardHover}
                      className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/30">
                            <Target className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                            Success
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                          {insights?.successRate.toFixed(1) || 0}%
                        </div>
                        <p className="text-sm text-gray-500">Completion Rate</p>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {analytics.completedEvents} completed
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Quick Stats Row */}
                  <motion.div
                    variants={itemVariants}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                  >
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/30">
                      <div className="flex items-center gap-3">
                        <CalendarCheck className="w-8 h-8 opacity-80" />
                        <div>
                          <div className="text-2xl font-bold">{analytics.upcomingEvents}</div>
                          <div className="text-blue-100 text-sm">Upcoming</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/30">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 opacity-80" />
                        <div>
                          <div className="text-2xl font-bold">{analytics.completedEvents}</div>
                          <div className="text-emerald-100 text-sm">Completed</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-500/30">
                      <div className="flex items-center gap-3">
                        <CalendarX className="w-8 h-8 opacity-80" />
                        <div>
                          <div className="text-2xl font-bold">{analytics.cancelledEvents}</div>
                          <div className="text-red-100 text-sm">Cancelled</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-500/30">
                      <div className="flex items-center gap-3">
                        <Flame className="w-8 h-8 opacity-80" />
                        <div>
                          <div className="text-2xl font-bold">{insights?.fullyBookedEvents || 0}</div>
                          <div className="text-purple-100 text-sm">Fully Booked</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Category Breakdown */}
                    <motion.div
                      variants={itemVariants}
                      whileHover={{ scale: 1.01 }}
                      className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                            <PieChart className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Events by Category</h3>
                        </div>
                      </div>

                      {analytics.categoryBreakdown.length > 0 ? (
                        <div className="space-y-4">
                          {/* Donut Chart */}
                          <div className="flex justify-center mb-6">
                            <div className="relative w-48 h-48">
                              <svg viewBox="0 0 200 200" className="transform -rotate-90">
                                {(() => {
                                  let currentAngle = 0;
                                  const colors = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];
                                  return analytics.categoryBreakdown.map((item, index) => {
                                    const percentage = analytics.totalEvents > 0 ? (item.count / analytics.totalEvents) : 0;
                                    const angle = percentage * 360;
                                    const startAngle = currentAngle;
                                    currentAngle += angle;
                                    
                                    const startRad = (startAngle * Math.PI) / 180;
                                    const endRad = ((startAngle + angle) * Math.PI) / 180;
                                    const x1 = 100 + 85 * Math.cos(startRad);
                                    const y1 = 100 + 85 * Math.sin(startRad);
                                    const x2 = 100 + 85 * Math.cos(endRad);
                                    const y2 = 100 + 85 * Math.sin(endRad);
                                    const largeArc = angle > 180 ? 1 : 0;
                                    
                                    return (
                                      <path
                                        key={index}
                                        d={`M 100 100 L ${x1} ${y1} A 85 85 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                        fill={colors[index % colors.length]}
                                        className="hover:opacity-80 transition-opacity cursor-pointer"
                                      />
                                    );
                                  });
                                })()}
                                <circle cx="100" cy="100" r="55" fill="white" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-3xl font-bold text-gray-900">{analytics.totalEvents}</div>
                                  <div className="text-xs text-gray-500">Total</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Category List */}
                          <div className="space-y-3">
                            {analytics.categoryBreakdown.map((item, index) => {
                              const percentage = analytics.totalEvents > 0 ? (item.count / analytics.totalEvents) * 100 : 0;
                              const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-purple-500', 'bg-cyan-500'];
                              return (
                                <div key={index} className="group">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="flex items-center text-sm font-medium text-gray-700">
                                      <span className={`w-3 h-3 rounded-full ${colors[index % colors.length]} mr-2`}></span>
                                      {item.category}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-900">
                                      {item.count} <span className="text-gray-400">({percentage.toFixed(0)}%)</span>
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${percentage}%` }}
                                      transition={{ duration: motionDur, delay: index * 0.1 }}
                                      className={`${colors[index % colors.length]} h-2 rounded-full`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <PieChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>No category data available</p>
                        </div>
                      )}
                    </motion.div>

                    {/* Top Events */}
                    <motion.div
                      variants={itemVariants}
                      whileHover={{ scale: 1.01 }}
                      className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                            <Trophy className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Top Performing Events</h3>
                        </div>
                      </div>

                      {analytics.topEvents.length > 0 ? (
                        <div className="space-y-3">
                          {analytics.topEvents.slice(0, 5).map((event, index) => {
                            const fillRate = event.capacity > 0 ? (event.registrations / event.capacity) * 100 : 0;
                            const rankIcons = [Crown, Medal, Award, Star, Star];
                            const rankColors = ['text-amber-500', 'text-gray-400', 'text-amber-700', 'text-gray-500', 'text-gray-500'];
                            const RankIcon = rankIcons[index] || Star;
                            
                            return (
                              <motion.div
                                key={event._id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group"
                              >
                                <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${index === 0 ? 'bg-amber-100' : index === 1 ? 'bg-gray-100' : index === 2 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                                  <RankIcon className={`w-5 h-5 ${rankColors[index]}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                                    {event.title}
                                  </h4>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-gray-500">
                                      <Users className="w-3 h-3 inline mr-1" />
                                      {event.registrations}/{event.capacity}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      event.status === 'upcoming' ? 'bg-blue-50 text-blue-600' :
                                      event.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {event.status}
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(fillRate, 100)}%` }}
                                      transition={{ duration: motionDur, delay: 0.3 + index * 0.1 }}
                                      className={`h-1.5 rounded-full ${fillRate >= 90 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : fillRate >= 70 ? 'bg-gradient-to-r from-blue-500 to-blue-400' : 'bg-gradient-to-r from-gray-400 to-gray-300'}`}
                                    />
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-lg font-bold ${fillRate >= 90 ? 'text-emerald-600' : fillRate >= 70 ? 'text-blue-600' : 'text-gray-600'}`}>
                                    {fillRate.toFixed(0)}%
                                  </div>
                                  <div className="text-xs text-gray-400">filled</div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>No events available</p>
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* Recent Activity */}
                  <motion.div
                    variants={itemVariants}
                    className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl">
                          <Activity className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                      </div>
                      <span className="text-sm text-gray-500">{analytics.recentRegistrations.length} registrations</span>
                    </div>

                    {analytics.recentRegistrations.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {analytics.recentRegistrations.slice(0, 6).map((reg, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/30">
                              {reg.userName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 text-sm truncate">{reg.userName}</h4>
                              <p className="text-xs text-gray-500 truncate">{reg.eventTitle}</p>
                              <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(reg.registeredAt), { addSuffix: true })}</p>
                            </div>
                            {reg.fromWaitlist && (
                              <span className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full">
                                <Clock className="w-3 h-3 inline mr-1" />
                                WL
                              </span>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No recent registrations</p>
                      </div>
                    )}
                  </motion.div>
                </>
              )}

              {/* Events Tab */}
              {activeTab === 'events' && (
                <motion.div
                  variants={itemVariants}
                  className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">All Events Performance</h3>
                    </div>
                    <span className="text-sm text-gray-500">{analytics.topEvents.length} events</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registrations</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Capacity</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fill Rate</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {analytics.topEvents.map((event, index) => {
                          const fillRate = event.capacity > 0 ? (event.registrations / event.capacity) * 100 : 0;
                          return (
                            <motion.tr
                              key={event._id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm">
                                    #{index + 1}
                                  </div>
                                  <span className="font-medium text-gray-900 truncate max-w-[200px]">{event.title}</span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className="font-semibold text-gray-900">{event.registrations}</span>
                              </td>
                              <td className="py-4 px-4 text-center text-gray-600">{event.capacity}</td>
                              <td className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-gray-100 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${fillRate >= 90 ? 'bg-emerald-500' : fillRate >= 70 ? 'bg-blue-500' : fillRate >= 50 ? 'bg-amber-500' : 'bg-gray-400'}`}
                                      style={{ width: `${Math.min(fillRate, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-sm font-semibold ${fillRate >= 90 ? 'text-emerald-600' : fillRate >= 70 ? 'text-blue-600' : 'text-gray-600'}`}>
                                    {fillRate.toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  event.status === 'upcoming' ? 'bg-blue-50 text-blue-700' :
                                  event.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                  event.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {event.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center text-sm text-gray-500">
                                {format(new Date(event.date), 'MMM dd, yyyy')}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {analytics.topEvents.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No events found</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Registrations Tab */}
              {activeTab === 'registrations' && (
                <motion.div
                  variants={itemVariants}
                  className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 ring-1 ring-gray-100"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl">
                        <UserPlus className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">All Registrations</h3>
                    </div>
                    <span className="text-sm text-gray-500">{analytics.recentRegistrations.length} registrations</span>
                  </div>

                  {analytics.recentRegistrations.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.recentRegistrations.map((reg, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/30">
                              {reg.userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{reg.userName}</h4>
                                {reg.fromWaitlist && (
                                  <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-medium rounded-full">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Waitlist
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5">{reg.eventTitle}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {format(new Date(reg.registeredAt), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-gray-400">
                              {format(new Date(reg.registeredAt), 'h:mm a')}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {formatDistanceToNow(new Date(reg.registeredAt), { addSuffix: true })}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No registrations found</p>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-2xl p-12 text-center shadow-md border border-gray-200 ring-1 ring-gray-100"
          >
            <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">Start creating events to see analytics here.</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default EventAnalytics;
