import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Crown,
  X,
  Check,
  Search,
  Edit3,
  Trash2,
  LogOut,
  Send,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  UserMinus,
  Building,
  GraduationCap,
  Mail,
  UserCheck,
  ExternalLink,
  Ticket,
} from 'lucide-react';
import { API_BASE_URL } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/Toast';
import { Team, TeamJoinRequest, User } from '../types';
import TeamMemberGrid from './TeamMemberGrid';
import { invalidateCache } from '../utils/cacheManager';

// Extended user type with registration status
interface UserWithStatus extends User {
  registrationStatus: 'registered' | 'platform_only';
  hasPendingInvite: boolean;
  canInvite: boolean;
}

interface NonPlatformInvite {
  email: string;
  registrationStatus: 'not_on_platform';
  hasPendingInvite: boolean;
  canInvite: boolean;
}

interface TokenInvitation {
  _id: string;
  invitedEmail: string;
  inviteType: 'platform_user' | 'non_platform';
  status: string;
  createdAt: Date;
}

interface TeamManagerProps {
  eventId: string;
  eventTitle: string;
  registrationDeadline: Date;
  minTeamSize?: number;
  maxTeamSize?: number;
  onTeamUpdate?: () => void;
  isSubEvent?: boolean; // If true, use sub-event API endpoints
}

const TeamManager: React.FC<TeamManagerProps> = ({
  eventId,
  eventTitle: _eventTitle,
  registrationDeadline,
  minTeamSize = 2,
  maxTeamSize = 5,
  onTeamUpdate,
  isSubEvent = false,
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Stable user ID to prevent callback recreation
  const userId = user?._id || user?.id;
  
  // API base path based on event type
  const apiBasePath = isSubEvent ? 'sub-events' : 'events';
  
  // Track if initial fetch has been done
  const initialFetchDone = useRef(false);

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [pendingInvites, setPendingInvites] = useState<TeamJoinRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<TeamJoinRequest[]>([]);
  const [tokenInvitations, setTokenInvitations] = useState<TokenInvitation[]>([]);
  const [isLeader, setIsLeader] = useState(false);

  // Create team state
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  // Rename team state
  const [showRename, setShowRename] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Invite user state - enhanced with multi-select
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserWithStatus[]>([]);
  const [nonPlatformInvite, setNonPlatformInvite] = useState<NonPlatformInvite | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  
  // Multi-select state
  const [selectedUsers, setSelectedUsers] = useState<Array<UserWithStatus | NonPlatformInvite>>([]);
  const [sendingMultiInvites, setSendingMultiInvites] = useState(false);

  // Complete registration state
  const [submittingTeam, setSubmittingTeam] = useState(false);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    members: true,
    invites: true,
    pendingInvites: true,
  });

  const deadlinePassed = new Date() > new Date(registrationDeadline);

  // Silent fetch that doesn't show loading spinner (for updates after actions)
  const fetchTeamDataSilent = useCallback(async () => {
    if (!userId) return;
    
    // Invalidate team cache immediately for instant UI refresh
    invalidateCache.onTeamChange(eventId);
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/my-team?userId=${userId}`
      );
      const data = await response.json();

      if (data.success) {
        setTeam(data.team);
        setPendingInvites(data.pendingInvites || []);
        setSentRequests(data.sentRequests || []);
        setIsLeader(data.isLeader);
        
        // Fetch token invitations if user is leader
        if (data.team && data.isLeader) {
          try {
            const tokenRes = await fetch(
              `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${data.team._id}/token-invites`
            );
            const tokenData = await tokenRes.json();
            if (tokenData.success) {
              setTokenInvitations(tokenData.invitations || []);
            }
          } catch (e) {
            console.error('Error fetching token invitations:', e);
          }
        } else {
          setTokenInvitations([]);
        }
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    }
  }, [eventId, userId, apiBasePath]);

  // Full fetch with loading spinner (for initial load only)
  const fetchTeamData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/my-team?userId=${userId}`
      );
      const data = await response.json();

      if (data.success) {
        setTeam(data.team);
        setPendingInvites(data.pendingInvites || []);
        setSentRequests(data.sentRequests || []);
        setIsLeader(data.isLeader);
        
        // Fetch token invitations if user is leader
        if (data.team && data.isLeader) {
          try {
            const tokenRes = await fetch(
              `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${data.team._id}/token-invites`
            );
            const tokenData = await tokenRes.json();
            if (tokenData.success) {
              setTokenInvitations(tokenData.invitations || []);
            }
          } catch (e) {
            console.error('Error fetching token invitations:', e);
          }
        } else {
          setTokenInvitations([]);
        }
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId, userId, apiBasePath]);

  // Only fetch once on mount
  useEffect(() => {
    if (userId && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchTeamData();
    }
  }, [userId, fetchTeamData]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      addToast({ type: 'error', title: 'Error', message: 'Please enter a team name' });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          teamName: teamName.trim(),
          name: teamName.trim(),
          leaderId: userId,
          maxMembers: maxTeamSize,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'success', title: 'Team Created', message: `Team "${teamName}" created successfully!` });
        setTeamName('');
        setShowCreateTeam(false);
        fetchTeamDataSilent();
        onTeamUpdate?.();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to create team' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to create team' });
    } finally {
      setCreating(false);
    }
  };

  const handleRenameTeam = async () => {
    if (!newTeamName.trim() || !team) return;

    setRenaming(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/rename`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newTeamName.trim(),
            userId: userId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'success', title: 'Team Renamed', message: 'Team name updated successfully!' });
        setShowRename(false);
        setNewTeamName('');
        fetchTeamDataSilent();
        onTeamUpdate?.();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to rename team' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to rename team' });
    } finally {
      setRenaming(false);
    }
  };

  // Complete team registration
  const handleCompleteTeamRegistration = async () => {
    if (!team || !isLeader) return;
    
    // Count all members (both leaders and members who have joined the team)
    const confirmedMembers = team.members.length;
    
    if (confirmedMembers < minTeamSize) {
      addToast({ 
        type: 'error', 
        title: 'Cannot Complete Registration', 
        message: `Your team needs at least ${minTeamSize} members. Currently you have ${confirmedMembers}.` 
      });
      return;
    }
    
    setSubmittingTeam(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ 
          type: 'success', 
          title: 'Team Registration Complete!', 
          message: 'Your team has been successfully registered for the event.' 
        });
        fetchTeamDataSilent();
        onTeamUpdate?.();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to complete registration' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to complete registration' });
    } finally {
      setSubmittingTeam(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setNonPlatformInvite(null);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/search-users-for-team?search=${encodeURIComponent(searchQuery)}&excludeUserId=${userId}`
      );
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.users || []);
        setNonPlatformInvite(data.nonPlatformInvite || null);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  // Invite user who is already registered for the event
  const handleInviteRegisteredUser = async (targetUserId: string) => {
    if (!team) return;
    setInviting(targetUserId);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromUserId: userId,
            toUserId: targetUserId,
            message: inviteMessage || undefined,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'success', title: 'Invite Sent', message: 'Team invitation sent successfully!' });
        setSearchQuery('');
        setSearchResults([]);
        setInviteMessage('');
        fetchTeamDataSilent();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to send invite' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to send invite' });
    } finally {
      setInviting(null);
    }
  };

  // Invite platform user who is NOT registered for the event
  const handleInviteToEvent = async (targetUserId: string) => {
    if (!team) return;
    setInviting(targetUserId);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/invite-to-event`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromUserId: userId,
            toUserId: targetUserId,
            message: inviteMessage || undefined,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ 
          type: 'success', 
          title: 'Invite Sent', 
          message: 'User will auto-join your team when they register for the event!' 
        });
        setSearchQuery('');
        setSearchResults([]);
        setInviteMessage('');
        fetchTeamDataSilent();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to send invite' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to send invite' });
    } finally {
      setInviting(null);
    }
  };

  // Invite non-platform user by email
  const handleInviteByEmail = async (email: string) => {
    if (!team) return;
    setInviting(email);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/invite-by-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromUserId: userId,
            email,
            message: inviteMessage || undefined,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ 
          type: 'success', 
          title: 'Invite Sent', 
          message: `Invitation email sent to ${email}!` 
        });
        setSearchQuery('');
        setSearchResults([]);
        setNonPlatformInvite(null);
        setInviteMessage('');
        fetchTeamDataSilent();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to send invite' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to send invite' });
    } finally {
      setInviting(null);
    }
  };

  // Toggle user selection for multi-invite
  const toggleUserSelection = (targetUser: UserWithStatus | NonPlatformInvite) => {
    const isNonPlatform = 'email' in targetUser && targetUser.registrationStatus === 'not_on_platform';
    const userId = isNonPlatform ? (targetUser as NonPlatformInvite).email : ((targetUser as UserWithStatus)._id || (targetUser as UserWithStatus).id);
    
    setSelectedUsers(prev => {
      const exists = prev.some(u => {
        const isUNonPlatform = 'email' in u && u.registrationStatus === 'not_on_platform';
        const uId = isUNonPlatform ? (u as NonPlatformInvite).email : ((u as UserWithStatus)._id || (u as UserWithStatus).id);
        return uId === userId;
      });
      
      if (exists) {
        return prev.filter(u => {
          const isUNonPlatform = 'email' in u && u.registrationStatus === 'not_on_platform';
          const uId = isUNonPlatform ? (u as NonPlatformInvite).email : ((u as UserWithStatus)._id || (u as UserWithStatus).id);
          return uId !== userId;
        });
      } else {
        return [...prev, targetUser];
      }
    });
  };

  // Check if a user is selected
  const isUserSelected = (targetUser: UserWithStatus | NonPlatformInvite) => {
    const isNonPlatform = 'email' in targetUser && targetUser.registrationStatus === 'not_on_platform';
    const userId = isNonPlatform ? (targetUser as NonPlatformInvite).email : ((targetUser as UserWithStatus)._id || (targetUser as UserWithStatus).id);
    
    return selectedUsers.some(u => {
      const isUNonPlatform = 'email' in u && u.registrationStatus === 'not_on_platform';
      const uId = isUNonPlatform ? (u as NonPlatformInvite).email : ((u as UserWithStatus)._id || (u as UserWithStatus).id);
      return uId === userId;
    });
  };

  // Send invites to all selected users
  const handleSendMultipleInvites = async () => {
    if (selectedUsers.length === 0 || !team) return;
    
    setSendingMultiInvites(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const targetUser of selectedUsers) {
      try {
        const isNonPlatform = 'email' in targetUser && targetUser.registrationStatus === 'not_on_platform';
        
        if (isNonPlatform) {
          // Invite by email
          const response = await fetch(
            `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/invite-by-email`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fromUserId: userId,
                email: (targetUser as NonPlatformInvite).email,
                message: inviteMessage || undefined,
              }),
            }
          );
          if (response.ok) successCount++;
          else errorCount++;
        } else {
          const userWithStatus = targetUser as UserWithStatus;
          const targetUserId = userWithStatus._id || userWithStatus.id;
          
          if (userWithStatus.registrationStatus === 'registered') {
            // Invite registered user
            const response = await fetch(
              `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/invite`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fromUserId: userId,
                  toUserId: targetUserId,
                  message: inviteMessage || undefined,
                }),
              }
            );
            if (response.ok) successCount++;
            else errorCount++;
          } else {
            // Invite platform user to event
            const response = await fetch(
              `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/invite-to-event`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fromUserId: userId,
                  toUserId: targetUserId,
                  message: inviteMessage || undefined,
                }),
              }
            );
            if (response.ok) successCount++;
            else errorCount++;
          }
        }
      } catch (error) {
        errorCount++;
      }
    }
    
    setSendingMultiInvites(false);
    
    if (successCount > 0) {
      addToast({ 
        type: 'success', 
        title: 'Invites Sent', 
        message: `Successfully sent ${successCount} invitation${successCount > 1 ? 's' : ''}!${errorCount > 0 ? ` (${errorCount} failed)` : ''}` 
      });
    } else if (errorCount > 0) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to send invitations' });
    }
    
    // Reset state
    setSelectedUsers([]);
    setSearchQuery('');
    setSearchResults([]);
    setNonPlatformInvite(null);
    setInviteMessage('');
    setShowInvite(false);
    fetchTeamDataSilent();
  };

  // Cancel token invitation
  const handleCancelTokenInvite = async (tokenId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/teams/token-invites/${tokenId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'success', title: 'Cancelled', message: 'Invitation cancelled successfully' });
        fetchTeamDataSilent();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to cancel invitation' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to cancel invitation' });
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (showInvite) {
        handleSearchUsers();
      }
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, showInvite, eventId, userId]);

  const handleAcceptInvite = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId }),
      });

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'success', title: 'Joined Team', message: 'You have joined the team!' });
        fetchTeamDataSilent();
        onTeamUpdate?.();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to accept invitation' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to accept invitation' });
    }
  };

  const handleRejectInvite = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId }),
      });

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'info', title: 'Invitation Declined', message: 'You have declined the team invitation.' });
        fetchTeamDataSilent();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to decline invitation' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to decline invitation' });
    }
  };

  const handleCancelInvite = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId }),
      });

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'info', title: 'Invitation Cancelled', message: 'The invitation has been cancelled.' });
        fetchTeamDataSilent();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to cancel invitation' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to cancel invitation' });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!team) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/remove-member`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaderId: userId,
            memberId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'success', title: 'Member Removed', message: 'Team member has been removed.' });
        fetchTeamDataSilent();
        onTeamUpdate?.();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to remove member' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to remove member' });
    }
  };

  const handleLeaveTeam = async () => {
    if (!team) return;

    if (!confirm('Are you sure you want to leave this team?')) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}/leave`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'info', title: 'Left Team', message: 'You have left the team.' });
        fetchTeamDataSilent();
        onTeamUpdate?.();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to leave team' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to leave team' });
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;

    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/${apiBasePath}/${eventId}/teams/${team._id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        addToast({ type: 'success', title: 'Team Deleted', message: 'Team has been deleted.' });
        fetchTeamDataSilent();
        onTeamUpdate?.();
      } else {
        addToast({ type: 'error', title: 'Error', message: data.error || 'Failed to delete team' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to delete team' });
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading team data...</span>
        </div>
      </div>
    );
  }

  // Show pending invites if user is not in a team
  if (!team && pendingInvites.length > 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Invitations
          </h3>
        </div>

        <div className="p-4 space-y-3">
          {pendingInvites.map((invite) => (
            <motion.div
              key={invite._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-purple-50 border border-purple-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {(invite.fromUserId as User).name} invited you to join
                  </p>
                  <p className="text-purple-700 font-semibold">
                    {(invite.teamId as Team).name}
                  </p>
                  {invite.message && (
                    <p className="text-sm text-gray-600 mt-1 italic">"{invite.message}"</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptInvite(invite._id)}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    title="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRejectInvite(invite._id)}
                    className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    title="Decline"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {!deadlinePassed && (
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={() => setShowCreateTeam(true)}
              className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Or Create Your Own Team
            </button>
          </div>
        )}

        {/* Create Team Modal */}
        <AnimatePresence>
          {showCreateTeam && (
            <CreateTeamModal
              teamName={teamName}
              setTeamName={setTeamName}
              creating={creating}
              onClose={() => setShowCreateTeam(false)}
              onCreate={handleCreateTeam}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Show create team option if user is not in a team
  if (!team) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Registration
          </h3>
        </div>

        <div className="p-6">
          {deadlinePassed ? (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
              <p className="text-gray-600">Registration deadline has passed.</p>
              <p className="text-sm text-gray-500 mt-1">Team creation is no longer available.</p>
            </div>
          ) : (
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto text-purple-500 mb-3" />
              <p className="text-gray-600 mb-4">You're not part of any team for this event yet.</p>
              <button
                onClick={() => setShowCreateTeam(true)}
                className="py-2 px-6 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <UserPlus className="w-4 h-4" />
                Create a Team
              </button>
            </div>
          )}
        </div>

        {/* Create Team Modal */}
        <AnimatePresence>
          {showCreateTeam && (
            <CreateTeamModal
              teamName={teamName}
              setTeamName={setTeamName}
              creating={creating}
              onClose={() => setShowCreateTeam(false)}
              onCreate={handleCreateTeam}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Show team details
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Team Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{team.name}</h3>
              <p className="text-purple-200 text-sm">
                {team.members.length}/{team.maxMembers} members
              </p>
            </div>
          </div>
          {isLeader && !deadlinePassed && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNewTeamName(team.name);
                  setShowRename(true);
                }}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                title="Rename Team"
              >
                <Edit3 className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={handleDeleteTeam}
                className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
                title="Delete Team"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Team Status */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              team.status === 'complete'
                ? 'bg-green-100 text-green-700'
                : team.status === 'forming'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {team.status === 'complete' ? 'Team Complete' : team.status === 'forming' ? 'Forming Team' : team.status}
          </span>
        </div>
        {deadlinePassed && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Deadline passed - Team is locked
          </span>
        )}
      </div>

      {/* Team Member Grid */}
      <div className="p-4">
        <TeamMemberGrid
          members={team.members}
          maxMembers={team.maxMembers}
          sentRequests={sentRequests}
          tokenInvitations={tokenInvitations}
          isLeader={isLeader}
          deadlinePassed={deadlinePassed}
          currentUserId={userId || ''}
          onInviteClick={() => setShowInvite(true)}
          onRemoveMember={handleRemoveMember}
          onCancelInvite={handleCancelInvite}
          onCancelTokenInvite={handleCancelTokenInvite}
        />
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-100 space-y-3">
        {/* Complete Registration Button for Leader */}
        {isLeader && team.status === 'forming' && !deadlinePassed && (
          <>
            {(() => {
              // Count all members in the team (they are already confirmed by being in members array)
              const confirmedMembers = team.members.length;
              const canComplete = confirmedMembers >= minTeamSize;
              
              return (
                <div className="space-y-2">
                  <button
                    onClick={handleCompleteTeamRegistration}
                    disabled={!canComplete || submittingTeam}
                    className={`w-full py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                      canComplete
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {submittingTeam ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Complete Team Registration
                      </>
                    )}
                  </button>
                  {!canComplete && (
                    <p className="text-xs text-center text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                      ⚠️ Need at least {minTeamSize} members to complete registration. Currently have {confirmedMembers}.
                    </p>
                  )}
                </div>
              );
            })()}
          </>
        )}
        
        {/* Team Complete Message */}
        {team.status === 'complete' && (
          <div className="text-center py-2 px-4 bg-green-50 text-green-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            Team Registration Complete
          </div>
        )}

        {!isLeader && (
          <button
            onClick={handleLeaveTeam}
            className="w-full py-2 px-4 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Leave Team
          </button>
        )}
      </div>

      {/* Rename Modal */}
      <AnimatePresence>
        {showRename && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRename(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rename Team</h3>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter new team name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowRename(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameTeam}
                  disabled={renaming || !newTeamName.trim()}
                  className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {renaming ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowInvite(false);
              setSearchQuery('');
              setSearchResults([]);
              setNonPlatformInvite(null);
              setInviteMessage('');
              setSelectedUsers([]);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-purple-600" />
                      Invite Team Members
                    </h3>
                    {selectedUsers.length > 0 && (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-bold bg-purple-600 text-white rounded-full">
                        {selectedUsers.length} selected
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowInvite(false);
                      setSearchQuery('');
                      setSearchResults([]);
                      setNonPlatformInvite(null);
                      setInviteMessage('');
                      setSelectedUsers([]);
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or register ID..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Enter an email to invite someone not on the platform
                </p>
              </div>

              {/* Optional message */}
              <div className="px-4 py-3 border-b border-gray-100">
                <input
                  type="text"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Add a personal message (optional)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-y-auto p-4">
                {searching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : searchResults.length > 0 || nonPlatformInvite ? (
                  <div className="space-y-3">
                    {/* Platform users */}
                    {searchResults.map((targetUser) => (
                      <div
                        key={targetUser._id || targetUser.id}
                        className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                          isUserSelected(targetUser) 
                            ? 'ring-2 ring-purple-500 ring-offset-2' 
                            : ''
                        } ${
                          targetUser.registrationStatus === 'registered'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                        onClick={() => !targetUser.hasPendingInvite && toggleUserSelection(targetUser)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            {/* Checkbox */}
                            {!targetUser.hasPendingInvite && (
                              <div className="flex-shrink-0">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isUserSelected(targetUser)
                                    ? 'bg-purple-600 border-purple-600'
                                    : 'border-gray-300 bg-white'
                                }`}>
                                  {isUserSelected(targetUser) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-sm">
                              {targetUser.avatar ? (
                                <img
                                  src={targetUser.avatar}
                                  alt={targetUser.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-lg font-bold text-purple-600">
                                  {targetUser.name?.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 truncate">{targetUser.name}</span>
                                {targetUser.registrationStatus === 'registered' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                    <UserCheck className="w-3 h-3" />
                                    Registered
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                    <Users className="w-3 h-3" />
                                    On Platform
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                {targetUser.email && <span className="truncate">{targetUser.email}</span>}
                                {targetUser.department && <span>• {targetUser.department}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {targetUser.hasPendingInvite ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-lg">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            ) : targetUser.registrationStatus === 'registered' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInviteRegisteredUser(targetUser._id || targetUser.id!);
                                }}
                                disabled={inviting === (targetUser._id || targetUser.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                {inviting === (targetUser._id || targetUser.id) ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Send className="w-4 h-4" />
                                    Invite to Team
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInviteToEvent(targetUser._id || targetUser.id!);
                                }}
                                disabled={inviting === (targetUser._id || targetUser.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                              >
                                {inviting === (targetUser._id || targetUser.id) ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Ticket className="w-4 h-4" />
                                    Invite to Event
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        {targetUser.registrationStatus === 'platform_only' && !targetUser.hasPendingInvite && (
                          <p className="mt-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            💡 This user will auto-join your team when they register for the event
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Non-platform user option */}
                    {nonPlatformInvite && (
                      <div 
                        className={`p-3 rounded-lg border-2 bg-purple-50 border-purple-200 cursor-pointer transition-colors ${
                          isUserSelected(nonPlatformInvite) ? 'ring-2 ring-purple-500 ring-offset-2' : ''
                        }`}
                        onClick={() => !nonPlatformInvite.hasPendingInvite && toggleUserSelection(nonPlatformInvite)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            {/* Checkbox */}
                            {!nonPlatformInvite.hasPendingInvite && (
                              <div className="flex-shrink-0">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isUserSelected(nonPlatformInvite)
                                    ? 'bg-purple-600 border-purple-600'
                                    : 'border-gray-300 bg-white'
                                }`}>
                                  {isUserSelected(nonPlatformInvite) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                              <Mail className="w-6 h-6 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 truncate">{nonPlatformInvite.email}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                  <ExternalLink className="w-3 h-3" />
                                  New User
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">Not registered on EventHub</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {nonPlatformInvite.hasPendingInvite ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-lg">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInviteByEmail(nonPlatformInvite.email);
                                }}
                                disabled={inviting === nonPlatformInvite.email}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                              >
                                {inviting === nonPlatformInvite.email ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Mail className="w-4 h-4" />
                                    Send Email Invite
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        {!nonPlatformInvite.hasPendingInvite && (
                          <p className="mt-2 text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                            📧 An invitation email with a registration link will be sent
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : searchQuery && searchQuery.length >= 2 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p>No users found matching "{searchQuery}"</p>
                    <p className="text-xs mt-2">Try searching by email to invite someone new</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="font-medium">Search for team members</p>
                    <p className="text-xs mt-1">Type at least 2 characters to search</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl space-y-3">
                {/* Invite Selected Button */}
                {selectedUsers.length > 0 && (
                  <button
                    onClick={handleSendMultipleInvites}
                    disabled={sendingMultiInvites}
                    className="w-full py-2.5 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sendingMultiInvites ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending Invites...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Invite {selectedUsers.length} Selected User{selectedUsers.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
                
                {/* Legend */}
                <div className="flex gap-3 text-xs text-gray-500 justify-center">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Registered for event</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>On platform</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>New user</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Create Team Modal Component
const CreateTeamModal: React.FC<{
  teamName: string;
  setTeamName: (name: string) => void;
  creating: boolean;
  onClose: () => void;
  onCreate: () => void;
}> = ({ teamName, setTeamName, creating, onClose, onCreate }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Your Team</h3>
      <p className="text-sm text-gray-500 mb-2">Choose a unique name for your team.</p>
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800 flex items-start gap-2">
          <Crown className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span><strong>Note:</strong> Only the team leader should create the team. Other members will join via invitation.</span>
        </p>
      </div>
      <input
        type="text"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        placeholder="Enter team name"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        autoFocus
      />
      <div className="flex gap-3 mt-4">
        <button
          onClick={onClose}
          className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onCreate}
          disabled={creating || !teamName.trim()}
          className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              Create Team
            </>
          )}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

export default TeamManager;

