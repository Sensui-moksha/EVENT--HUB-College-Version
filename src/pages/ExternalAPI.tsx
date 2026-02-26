import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../utils/api';
import {
  KeyRound, LogOut, Users, Calendar, Trophy, Activity,
  Search, ChevronLeft, ChevronRight, Eye, Loader2,
  GraduationCap, BarChart3, Hash, Building2, BookOpen,
  ArrowLeft, AlertCircle, CheckCircle2, Clock, Award
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface ApiUser {
  id: string;
  name: string;
  email: string;
  regId?: string;
  department: string;
  year?: number;
  section?: string;
  college: string;
}

interface ApiEvent {
  id: string;
  title: string;
  description?: string;
  category?: string;
  date: string;
  time?: string;
  venue?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  status: string;
  prizes?: string[];
}

interface UserDetail {
  user: ApiUser;
  stats: {
    totalRegistered: number;
    totalAttended: number;
    totalUpcoming: number;
    totalPrizes: number;
  };
  registeredEvents: any[];
  attendedEvents: any[];
  upcomingEvents: any[];
  prizes: any[];
  subEventPrizes: any[];
}

interface StatsData {
  users: number;
  events: { total: number; upcoming: number; completed: number };
  totalRegistrations: number;
  departments: string[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    upcoming: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Clock className="w-3 h-3" /> },
    ongoing: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <Activity className="w-3 h-3" /> },
    completed: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <AlertCircle className="w-3 h-3" /> },
    attended: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> },
    registered: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', icon: <Activity className="w-3 h-3" /> },
  };
  const s = map[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.icon} {status}
    </span>
  );
}

function Spinner() {
  return <Loader2 className="w-5 h-5 animate-spin text-blue-400" />;
}

// ─── Main Component ──────────────────────────────────────────────────
const ExternalAPI: React.FC = () => {
  // Auth state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [credentialName, setCredentialName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // View state
  type View = 'dashboard' | 'users' | 'user-detail' | 'events' | 'event-registrations' | 'event-winners';
  const [view, setView] = useState<View>('dashboard');

  // Data state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [usersPagination, setUsersPagination] = useState<Pagination | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [eventsPagination, setEventsPagination] = useState<Pagination | null>(null);
  const [eventRegistrations, setEventRegistrations] = useState<any>(null);
  const [eventWinners, setEventWinners] = useState<any>(null);

  // Filter/search state
  const [userSearch, setUserSearch] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userYearFilter, setUserYearFilter] = useState('');
  const [eventsStatusFilter, setEventsStatusFilter] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── API Fetch ──────────────────────────────────────────────
  const apiFetch = useCallback(async (path: string) => {
    if (!authToken) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Basic ${authToken}` },
    });
    if (res.status === 401) {
      setAuthToken(null);
      throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }, [authToken]);

  // ─── Auth ───────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const token = btoa(`${username}:${password}`);
      const res = await fetch(`${API_BASE_URL}/api/external/health`, {
        headers: { Authorization: `Basic ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Invalid credentials');
      }
      const data = await res.json();
      setAuthToken(token);
      setCredentialName(data.credential?.name || username);
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCredentialName('');
    setView('dashboard');
    setStats(null);
    setUsers([]);
    setEvents([]);
    setUserDetail(null);
    setEventRegistrations(null);
    setEventWinners(null);
    setUsername('');
    setError('');
  };

  // ─── Data Fetchers ──────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/external/stats');
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (userSearch) params.set('search', userSearch);
      if (userDeptFilter) params.set('department', userDeptFilter);
      if (userYearFilter) params.set('year', userYearFilter);
      const data = await apiFetch(`/api/external/users?${params}`);
      setUsers(data.users);
      setUsersPagination(data.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, userSearch, userDeptFilter, userYearFilter]);

  const fetchUserDetail = useCallback(async (userId: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/external/users/${userId}`);
      setUserDetail(data);
      setView('user-detail');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const fetchEvents = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (eventsStatusFilter) params.set('status', eventsStatusFilter);
      const data = await apiFetch(`/api/external/events?${params}`);
      setEvents(data.events);
      setEventsPagination(data.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, eventsStatusFilter]);

  const fetchEventRegistrations = useCallback(async (eventId: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/external/events/${eventId}/registrations`);
      setEventRegistrations(data);
      setView('event-registrations');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const fetchEventWinners = useCallback(async (eventId: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/external/events/${eventId}/winners`);
      setEventWinners(data);
      setView('event-winners');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Load dashboard stats on auth
  useEffect(() => {
    if (authToken && view === 'dashboard') fetchStats();
  }, [authToken, view, fetchStats]);

  // Load users when view changes or filters change
  useEffect(() => {
    if (authToken && view === 'users') fetchUsers(usersPage);
  }, [authToken, view, usersPage, fetchUsers]);

  // Load events when view changes
  useEffect(() => {
    if (authToken && view === 'events') fetchEvents(eventsPage);
  }, [authToken, view, eventsPage, fetchEvents]);

  // ─── LOGIN SCREEN ──────────────────────────────────────────
  if (!authToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1a2e] to-[#16213e] flex items-center justify-center px-4 pt-20">
        <motion.div
          {...fadeIn}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
              <KeyRound className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Mentors API</h1>
            <p className="text-gray-400 text-sm mt-1">Read-only access to student data for external applications</p>
          </div>

          <form onSubmit={handleLogin} className="bg-[#16213e]/80 backdrop-blur border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
            {authError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {authError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="API username"
                required
                className="w-full px-4 py-2.5 bg-[#0f0c29]/60 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="API password"
                required
                className="w-full px-4 py-2.5 bg-[#0f0c29]/60 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white font-medium transition"
            >
              {authLoading ? <Spinner /> : <KeyRound className="w-4 h-4" />}
              {authLoading ? 'Authenticating...' : 'Login'}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Credentials are created by admins in the API Credentials panel.
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  // ─── AUTHENTICATED LAYOUT ──────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1a2e] to-[#16213e] pt-20 pb-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Mentors API Explorer</h1>
              <p className="text-xs text-gray-500">Logged in as <span className="text-blue-400">{credentialName}</span></p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { key: 'dashboard' as View, label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
            { key: 'users' as View, label: 'Students', icon: <Users className="w-4 h-4" /> },
            { key: 'events' as View, label: 'Events', icon: <Calendar className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setView(tab.key); setError(''); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                view === tab.key || (tab.key === 'users' && view === 'user-detail') || (tab.key === 'events' && (view === 'event-registrations' || view === 'event-winners'))
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Views */}
        <AnimatePresence mode="wait">
          {/* ─── DASHBOARD ─── */}
          {view === 'dashboard' && (
            <motion.div key="dashboard" {...fadeIn}>
              {loading && !stats ? (
                <div className="flex items-center justify-center py-20"><Spinner /></div>
              ) : stats ? (
                <div className="space-y-6">
                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard icon={<Users className="w-5 h-5" />} label="Students" value={stats.users} color="blue" />
                    <StatCard icon={<Calendar className="w-5 h-5" />} label="Total Events" value={stats.events.total} color="purple" />
                    <StatCard icon={<Activity className="w-5 h-5" />} label="Upcoming" value={stats.events.upcoming} color="green" />
                    <StatCard icon={<Hash className="w-5 h-5" />} label="Registrations" value={stats.totalRegistrations} color="orange" />
                  </div>

                  {/* Departments */}
                  <div className="bg-[#16213e]/60 border border-white/5 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Departments ({stats.departments.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {stats.departments.map(d => (
                        <span key={d} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300">{d}</span>
                      ))}
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="bg-[#16213e]/60 border border-white/5 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Available Endpoints (Read-Only)</h3>
                    <div className="space-y-2 text-xs font-mono">
                      {[
                        { method: 'GET', path: '/api/external/health', desc: 'Test credentials' },
                        { method: 'GET', path: '/api/external/stats', desc: 'Summary statistics' },
                        { method: 'GET', path: '/api/external/users', desc: 'List students (paginated, searchable)' },
                        { method: 'GET', path: '/api/external/users/:id', desc: 'Student detail + events + prizes' },
                        { method: 'GET', path: '/api/external/events', desc: 'List events (filterable)' },
                        { method: 'GET', path: '/api/external/events/:id/registrations', desc: 'Event participants' },
                        { method: 'GET', path: '/api/external/events/:id/winners', desc: 'Event winners & prizes' },
                      ].map(ep => (
                        <div key={ep.path} className="flex items-start gap-2 p-2 bg-white/[0.02] rounded-lg">
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-bold">{ep.method}</span>
                          <span className="text-blue-300 flex-1">{ep.path}</span>
                          <span className="text-gray-500 text-right">{ep.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* ─── STUDENTS LIST ─── */}
          {view === 'users' && (
            <motion.div key="users" {...fadeIn}>
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or Reg ID..."
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setUsersPage(1); }}
                    className="w-full pl-9 pr-4 py-2 bg-[#16213e]/60 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                  />
                </div>
                {stats?.departments && (
                  <select
                    value={userDeptFilter}
                    onChange={e => { setUserDeptFilter(e.target.value); setUsersPage(1); }}
                    className="px-3 py-2 bg-[#16213e]/60 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="">All Departments</option>
                    {stats.departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
                <select
                  value={userYearFilter}
                  onChange={e => { setUserYearFilter(e.target.value); setUsersPage(1); }}
                  className="px-3 py-2 bg-[#16213e]/60 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">All Years</option>
                  {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>

              {loading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
              ) : users.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No students found</p>
                </div>
              ) : (
                <>
                  {/* Table */}
                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/5 text-gray-400 text-left">
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Reg ID</th>
                          <th className="px-4 py-3 font-medium hidden md:table-cell">Department</th>
                          <th className="px-4 py-3 font-medium hidden sm:table-cell">Year</th>
                          <th className="px-4 py-3 font-medium hidden lg:table-cell">Section</th>
                          <th className="px-4 py-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-white/[0.03] transition">
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{u.name}</div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-mono">
                                {u.regId || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-300 hidden md:table-cell">{u.department}</td>
                            <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">{u.year || '—'}</td>
                            <td className="px-4 py-3 text-gray-300 hidden lg:table-cell">{u.section || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => fetchUserDetail(u.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition"
                              >
                                <Eye className="w-3 h-3" /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {usersPagination && usersPagination.totalPages > 1 && (
                    <PaginationBar
                      pagination={usersPagination}
                      onPageChange={p => setUsersPage(p)}
                    />
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ─── STUDENT DETAIL ─── */}
          {view === 'user-detail' && (
            <motion.div key="user-detail" {...fadeIn}>
              <button
                onClick={() => setView('users')}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Students
              </button>

              {loading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
              ) : userDetail ? (
                <div className="space-y-4">
                  {/* Profile Header */}
                  <div className="bg-[#16213e]/60 border border-white/5 rounded-xl p-5">
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xl font-bold text-blue-400">
                        {userDetail.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-white">{userDetail.user.name}</h2>
                        <p className="text-sm text-gray-400">{userDetail.user.email}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {userDetail.user.regId && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-mono">
                              <Hash className="w-3 h-3" /> {userDetail.user.regId}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">
                            <Building2 className="w-3 h-3" /> {userDetail.user.department}
                          </span>
                          {userDetail.user.year && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">
                              <GraduationCap className="w-3 h-3" /> Year {userDetail.user.year}
                            </span>
                          )}
                          {userDetail.user.section && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded text-xs">
                              <BookOpen className="w-3 h-3" /> Section {userDetail.user.section}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mini Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      <MiniStat label="Registered" value={userDetail.stats.totalRegistered} color="blue" />
                      <MiniStat label="Attended" value={userDetail.stats.totalAttended} color="green" />
                      <MiniStat label="Upcoming" value={userDetail.stats.totalUpcoming} color="purple" />
                      <MiniStat label="Prizes" value={userDetail.stats.totalPrizes} color="yellow" />
                    </div>
                  </div>

                  {/* Prizes */}
                  {(userDetail.prizes.length > 0 || userDetail.subEventPrizes.length > 0) && (
                    <div className="bg-[#16213e]/60 border border-yellow-500/10 rounded-xl p-4">
                      <h3 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4" /> Prizes & Awards ({userDetail.stats.totalPrizes})
                      </h3>
                      <div className="space-y-2">
                        {userDetail.prizes.map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-white/[0.03] rounded-lg">
                            <div>
                              <div className="text-sm text-white font-medium">{p.eventTitle}</div>
                              {p.eventDate && <div className="text-xs text-gray-500">{new Date(p.eventDate).toLocaleDateString()}</div>}
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs font-medium">
                                <Award className="w-3 h-3" /> #{p.position}
                              </span>
                              {p.prize && <div className="text-xs text-gray-400 mt-0.5">{p.prize}</div>}
                            </div>
                          </div>
                        ))}
                        {userDetail.subEventPrizes.map((p, i) => (
                          <div key={`sub-${i}`} className="flex items-center justify-between p-2.5 bg-white/[0.03] rounded-lg">
                            <div>
                              <div className="text-sm text-white font-medium">{p.subEventTitle}</div>
                              <div className="text-xs text-gray-500">{p.parentEventTitle}</div>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs font-medium">
                                <Award className="w-3 h-3" /> #{p.position}
                              </span>
                              {p.prize && <div className="text-xs text-gray-400 mt-0.5">{p.prize}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Registered Events */}
                  {userDetail.registeredEvents.length > 0 && (
                    <div className="bg-[#16213e]/60 border border-white/5 rounded-xl p-4">
                      <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Registered Events ({userDetail.registeredEvents.length})
                      </h3>
                      <div className="space-y-2">
                        {userDetail.registeredEvents.map((ev, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-white/[0.03] rounded-lg">
                            <div>
                              <div className="text-sm text-white">{ev.title}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {ev.date && <span className="text-xs text-gray-500">{new Date(ev.date).toLocaleDateString()}</span>}
                                {ev.category && <span className="text-xs text-gray-600">• {ev.category}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {ev.attendanceStatus && <StatusBadge status={ev.attendanceStatus} />}
                              {ev.status && <StatusBadge status={ev.status} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attended Events */}
                  {userDetail.attendedEvents.length > 0 && (
                    <div className="bg-[#16213e]/60 border border-white/5 rounded-xl p-4">
                      <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Attended Events ({userDetail.attendedEvents.length})
                      </h3>
                      <div className="space-y-2">
                        {userDetail.attendedEvents.map((ev, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-white/[0.03] rounded-lg">
                            <div>
                              <div className="text-sm text-white">{ev.title}</div>
                              <div className="text-xs text-gray-500">
                                {ev.date && new Date(ev.date).toLocaleDateString()}
                                {ev.venue && ` • ${ev.venue}`}
                              </div>
                            </div>
                            {ev.category && <span className="text-xs text-gray-500">{ev.category}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          )}

          {/* ─── EVENTS LIST ─── */}
          {view === 'events' && (
            <motion.div key="events" {...fadeIn}>
              {/* Filters */}
              <div className="flex gap-2 mb-4">
                <select
                  value={eventsStatusFilter}
                  onChange={e => { setEventsStatusFilter(e.target.value); setEventsPage(1); }}
                  className="px-3 py-2 bg-[#16213e]/60 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">All Statuses</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {loading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
              ) : events.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No events found</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {events.map(ev => (
                      <div key={ev.id} className="bg-[#16213e]/60 border border-white/5 rounded-xl p-4 hover:border-white/10 transition">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-sm font-semibold text-white leading-tight">{ev.title}</h3>
                          <StatusBadge status={ev.status} />
                        </div>
                        {ev.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{ev.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 mb-3">
                          {ev.date && <span>{new Date(ev.date).toLocaleDateString()}</span>}
                          {ev.venue && <span>📍 {ev.venue}</span>}
                          {ev.category && <span>🏷️ {ev.category}</span>}
                          {ev.currentParticipants !== undefined && (
                            <span>👥 {ev.currentParticipants}{ev.maxParticipants ? `/${ev.maxParticipants}` : ''}</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => fetchEventRegistrations(ev.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition"
                          >
                            <Users className="w-3 h-3" /> Registrations
                          </button>
                          <button
                            onClick={() => fetchEventWinners(ev.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-medium transition"
                          >
                            <Trophy className="w-3 h-3" /> Winners
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {eventsPagination && eventsPagination.totalPages > 1 && (
                    <PaginationBar
                      pagination={eventsPagination}
                      onPageChange={p => setEventsPage(p)}
                    />
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ─── EVENT REGISTRATIONS ─── */}
          {view === 'event-registrations' && (
            <motion.div key="event-regs" {...fadeIn}>
              <button
                onClick={() => setView('events')}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Events
              </button>

              {loading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
              ) : eventRegistrations ? (
                <div>
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-white">{eventRegistrations.event?.title}</h2>
                    <p className="text-xs text-gray-500">
                      {eventRegistrations.event?.date && new Date(eventRegistrations.event.date).toLocaleDateString()}
                      {' • '}{eventRegistrations.registrations?.length || 0} registrations
                    </p>
                  </div>

                  {eventRegistrations.registrations?.length === 0 ? (
                    <p className="text-center text-gray-500 py-10">No registrations for this event</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/5 text-gray-400 text-left">
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Reg ID</th>
                            <th className="px-4 py-3 font-medium hidden md:table-cell">Department</th>
                            <th className="px-4 py-3 font-medium hidden sm:table-cell">Year</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {eventRegistrations.registrations.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-white/[0.03] transition">
                              <td className="px-4 py-3">
                                <div className="text-white">{r.userName}</div>
                                <div className="text-xs text-gray-500">{r.userEmail}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-mono">
                                  {r.userRegId || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-300 hidden md:table-cell">{r.department || '—'}</td>
                              <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">{r.year || '—'}</td>
                              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          )}

          {/* ─── EVENT WINNERS ─── */}
          {view === 'event-winners' && (
            <motion.div key="event-winners" {...fadeIn}>
              <button
                onClick={() => setView('events')}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Events
              </button>

              {loading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
              ) : eventWinners ? (
                <div>
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-white">{eventWinners.event?.title}</h2>
                    <p className="text-xs text-gray-500">
                      {eventWinners.event?.date && new Date(eventWinners.event.date).toLocaleDateString()}
                      {' • '}{eventWinners.winners?.length || 0} winners
                    </p>
                  </div>

                  {eventWinners.winners?.length === 0 ? (
                    <p className="text-center text-gray-500 py-10">No winners declared for this event</p>
                  ) : (
                    <div className="space-y-2">
                      {eventWinners.winners.map((w: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 p-3 bg-[#16213e]/60 border border-white/5 rounded-xl">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            w.position === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            w.position === 2 ? 'bg-gray-300/20 text-gray-300 border border-gray-400/30' :
                            w.position === 3 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                            'bg-white/10 text-gray-400 border border-white/10'
                          }`}>
                            #{w.position}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white font-medium">{w.participantName}</div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {w.userRegId && <span className="font-mono text-blue-400">{w.userRegId}</span>}
                              {w.department && <span>{w.department}</span>}
                              {w.userEmail && <span>{w.userEmail}</span>}
                            </div>
                          </div>
                          {w.prize && (
                            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">
                              {w.prize}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/10 text-blue-400',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/10 text-purple-400',
    green: 'from-green-500/10 to-green-500/5 border-green-500/10 text-green-400',
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/10 text-orange-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1 opacity-70">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
  };
  return (
    <div className="text-center p-2.5 bg-white/[0.03] rounded-lg">
      <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function PaginationBar({ pagination, onPageChange }: { pagination: Pagination; onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-gray-500">
        Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg transition"
        >
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg transition"
        >
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

export default ExternalAPI;
