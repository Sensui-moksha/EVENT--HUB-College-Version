import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Crown,
  ChevronDown,
  ChevronUp,
  Building,
  GraduationCap,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  X,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { API_BASE_URL } from '../utils/api';
import { Team } from '../types';
import { format } from 'date-fns';

interface TeamViewProps {
  eventId: string;
  refreshTrigger?: number;
}

const TeamView: React.FC<TeamViewProps> = ({ eventId, refreshTrigger }) => {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'forming' | 'complete' | 'registered' | 'disqualified'>('all');
  const [filterSize, setFilterSize] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'members' | 'created'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/teams`);
      const data = await response.json();

      if (data.success && Array.isArray(data.teams)) {
        setTeams(data.teams);
      } else {
        setTeams([]);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams, refreshTrigger]);

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const filteredTeams = (Array.isArray(teams) ? teams : []).filter((team) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        team.name?.toLowerCase().includes(query) ||
        team.leaderId?.name?.toLowerCase().includes(query) ||
        team.members?.some((m) => m.userId?.name?.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filterStatus !== 'all' && team.status !== filterStatus) return false;

    // Size filter
    if (filterSize !== 'all') {
      const memberCount = team.members.length;
      if (filterSize === 'small' && memberCount > 2) return false;
      if (filterSize === 'medium' && (memberCount <= 2 || memberCount > 4)) return false;
      if (filterSize === 'large' && memberCount <= 4) return false;
    }

    return true;
  }).sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'members':
        comparison = a.members.length - b.members.length;
        break;
      case 'created':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const getStatusBadge = (status: Team['status']) => {
    switch (status) {
      case 'complete':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Complete
          </span>
        );
      case 'forming':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Forming
          </span>
        );
      case 'registered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <CheckCircle className="w-3 h-3" />
            Registered
          </span>
        );
      case 'disqualified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            Disqualified
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">Loading teams...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search teams or members..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Status Filter */}
        <div className="flex items-center space-x-2 flex-1 sm:flex-none">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'forming' | 'complete' | 'registered' | 'disqualified')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            aria-label="Filter by status"
            title="Filter teams by status"
          >
            <option value="all">All Status</option>
            <option value="forming">Forming</option>
            <option value="complete">Complete</option>
            <option value="registered">Registered</option>
            <option value="disqualified">Disqualified</option>
          </select>
        </div>

        {/* Team Size Filter */}
        <div className="flex items-center space-x-2 flex-1 sm:flex-none">
          <Users className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
          <select
            value={filterSize}
            onChange={(e) => setFilterSize(e.target.value as 'all' | 'small' | 'medium' | 'large')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            aria-label="Filter by team size"
            title="Filter teams by size"
          >
            <option value="all">All Sizes</option>
            <option value="small">Small (1-2)</option>
            <option value="medium">Medium (3-4)</option>
            <option value="large">Large (5+)</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="flex items-center space-x-2 flex-1 sm:flex-none">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'members' | 'created')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            aria-label="Sort teams by"
            title="Sort teams by criteria"
          >
            <option value="name">Sort by Name</option>
            <option value="members">Sort by Members</option>
            <option value="created">Sort by Created</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-purple-500 flex-shrink-0"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? (
              <SortAsc className="w-4 h-4 text-gray-500" />
            ) : (
              <SortDesc className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredTeams.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">
            {teams.length === 0 
              ? 'No teams have been created yet.' 
              : 'No teams match your filters. Try adjusting your search or filters.'}
          </p>
        </div>
      )}

      {/* Results Summary */}
      {filteredTeams.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''} found</span>
          <span>
            {filteredTeams.reduce((sum, t) => sum + t.members.length, 0)} total members
          </span>
        </div>
      )}

      {/* Teams List */}
      {filteredTeams.length > 0 && (
        <div className="space-y-3">
          {filteredTeams.map((team) => (
          <motion.div
            key={team._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
          >
            {/* Team Header */}
            <button
              onClick={() => toggleTeam(team._id)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900">{team.name}</h4>
                  <p className="text-sm text-gray-500">
                    {team.members.length}/{team.maxMembers} members • Led by {team.leaderId.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(team.status)}
                {expandedTeams.has(team._id) ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Team Members */}
            <AnimatePresence>
              {expandedTeams.has(team._id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-gray-200"
                >
                  <div className="p-4 bg-gray-50">
                    {/* Team Info */}
                    <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created {format(new Date(team.createdAt), 'MMM dd, yyyy')}
                      </span>
                    </div>

                    {/* Members Grid */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {team.members.map((member) => (
                        <div
                          key={member.userId._id || member.userId.id}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
                        >
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden">
                              {member.userId.avatar ? (
                                <img
                                  src={member.userId.avatar}
                                  alt={member.userId.name}
                                  className="w-10 h-10 object-cover"
                                />
                              ) : (
                                <span className="text-purple-600 font-medium">
                                  {member.userId.name?.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            {member.role === 'leader' && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                                <Crown className="w-2.5 h-2.5 text-yellow-900" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">
                                {member.userId.name}
                              </span>
                              {member.role === 'leader' && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                  Leader
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {member.userId.regId && (
                                <span>{member.userId.regId}</span>
                              )}
                              {member.userId.department && (
                                <span className="flex items-center gap-0.5">
                                  <Building className="w-3 h-3" />
                                  {member.userId.department}
                                </span>
                              )}
                              {member.userId.year && (
                                <span className="flex items-center gap-0.5">
                                  <GraduationCap className="w-3 h-3" />
                                  Y{member.userId.year}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
        </div>
      )}

    </div>
  );
};

export default TeamView;
