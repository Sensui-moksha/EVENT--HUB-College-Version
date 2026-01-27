import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { SubEvent, SubEventRegistration, AccessCheckResult } from '../types/subEvent';
import AccessControlBadge from '../components/AccessControlBadge';
import Comments from '../components/Comments';
import TeamManager from '../components/TeamManager';
import { exportAttendeesToExcel } from '../utils/excelExport';
import { API_BASE_URL } from '../utils/api';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  ArrowLeft,
  UserCheck,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  Trash2,
  Search,
  UserPlus,
  Crown,
  Trophy,
  Plus,
  Award,
  Edit3
} from 'lucide-react';
import { pageVariants } from '../utils/animations';

// Winner interface
interface SubEventWinner {
  _id: string;
  subEventId: string;
  position: number;
  prize?: string;
  participantType: 'registered' | 'spot';
  userId?: { _id: string; name: string; email: string; regId?: string; department?: string; year?: number };
  spotRegistrationId?: { _id: string; participantName: string; identifier?: string };
  participantName: string;
  addedBy: { _id: string; name: string };
  createdAt: Date;
}

// Spot registration interface
interface SpotRegistration {
  _id: string;
  subEventId: string;
  participantName: string;
  identifier?: string;
  notes?: string;
  addedBy: { _id: string; name: string };
  createdAt: Date;
}

const SubEventDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Stable user ID and role to prevent callback recreation
  const userId = user?._id || user?.id;
  const userRole = user?.role;

  const [subEvent, setSubEvent] = useState<SubEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userRegistration, setUserRegistration] = useState<SubEventRegistration | null>(null);
  const [accessCheck, setAccessCheck] = useState<AccessCheckResult | null>(null);
  const [attendees, setAttendees] = useState<SubEventRegistration[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [userWaitlistStatus, setUserWaitlistStatus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'attendees' | 'waitlist' | 'teams' | 'comments'>('details');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 20;

  // Team-related state
  const [userTeam, setUserTeam] = useState<any>(null);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<any[]>([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [invitingUser, setInvitingUser] = useState<string | null>(null);
  const [completingTeam, setCompletingTeam] = useState(false);
  const [participantView, setParticipantView] = useState<'individual' | 'teams'>('individual');

  // Event completion and winners state
  const [completingEvent, setCompletingEvent] = useState(false);
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [winners, setWinners] = useState<SubEventWinner[]>([]);
  const [eligibleWinners, setEligibleWinners] = useState<{ registered: SubEventRegistration[]; spot: SpotRegistration[]; prizes: string[] }>({ registered: [], spot: [], prizes: [] });
  const [showSpotRegModal, setShowSpotRegModal] = useState(false);
  const [spotRegName, setSpotRegName] = useState('');
  const [spotRegIdentifier, setSpotRegIdentifier] = useState('');
  const [spotRegNotes, setSpotRegNotes] = useState('');
  const [spotRegistrations, setSpotRegistrations] = useState<SpotRegistration[]>([]);
  const [addingSpotReg, setAddingSpotReg] = useState(false);
  const [addingWinner, setAddingWinner] = useState(false);
  const [selectedWinnerPosition, setSelectedWinnerPosition] = useState(1);
  const [selectedParticipantType, setSelectedParticipantType] = useState<'registered' | 'spot'>('registered');
  const [selectedParticipantId, setSelectedParticipantId] = useState('');

  // Helper to check if user is organizer - defined early for useEffect dependencies
  const isOrganizer = subEvent?.organizerId === userId || userRole === 'organizer' || userRole === 'admin';

  useEffect(() => {
    if (id && userId) {
      fetchSubEvent();
      checkAccess();
      checkRegistrationStatus();
      checkWaitlistStatus();
    }
  }, [id, userId]);

  useEffect(() => {
    if (activeTab === 'attendees' && (userRole === 'organizer' || userRole === 'admin')) {
      fetchAttendees();
      // Scroll to top of tab content when switching to attendees tab
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (activeTab === 'waitlist' && (userRole === 'organizer' || userRole === 'admin')) {
      fetchWaitlist();
      // Scroll to top of tab content when switching to waitlist tab
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (activeTab === 'teams') {
      fetchAllTeams();
    }
  }, [activeTab, userRole]);

  // Fetch winners/spot registrations - for completed events or organizers
  useEffect(() => {
    if (subEvent && (subEvent.status === 'completed' || isOrganizer)) {
      fetchWinners();
      fetchSpotRegistrations();
      if (subEvent.status === 'completed') {
        fetchEligibleWinners();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subEvent?.status, subEvent?._id, isOrganizer]);

  const fetchSubEvent = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Backend returns { subEvent: {...} }, so extract it
        setSubEvent(data.subEvent || data);
      } else {
        addToast({ type: 'error', title: 'Failed to load sub-event' });
      }
    } catch (error) {
      console.error('Error fetching sub-event:', error);
      addToast({ type: 'error', title: 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const checkAccess = async () => {
    if (!userId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/access-check/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAccessCheck(data);
      }
    } catch (error) {
      console.error('Error checking access:', error);
    }
  };

  const checkRegistrationStatus = async () => {
    if (!userId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/registration/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUserRegistration(data.registration);
      }
    } catch (error) {
      console.error('Error checking registration:', error);
    }
  };

  const fetchAttendees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/registrations`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Backend returns { registrations: [...] }, so extract it
        setAttendees(data.registrations || data);
      }
    } catch (error) {
      console.error('Error fetching attendees:', error);
    }
  };

  const fetchWaitlist = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/waitlist`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setWaitlist(data.waitlist || []);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    }
  };

  const checkWaitlistStatus = async () => {
    if (!userId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/waitlist/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.onWaitlist) {
          setUserWaitlistStatus(data.waitlistEntry);
        }
      }
    } catch (error) {
      console.error('Error checking waitlist status:', error);
    }
  };

  // Winner and spot registration functions
  const fetchWinners = async () => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/winners`);
      const data = await response.json();
      if (response.ok) {
        setWinners(data.winners || []);
      }
    } catch (error) {
      console.error('Error fetching winners:', error);
    }
  };

  const fetchEligibleWinners = async () => {
    if (!id || !subEvent || subEvent.status !== 'completed') return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/eligible-winners`);
      const data = await response.json();
      if (response.ok) {
        setEligibleWinners({
          registered: data.registered || [],
          spot: data.spot || [],
          prizes: data.prizes || []
        });
      }
    } catch (error) {
      console.error('Error fetching eligible winners:', error);
    }
  };

  const fetchSpotRegistrations = async () => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/spot-registrations`);
      const data = await response.json();
      if (response.ok) {
        setSpotRegistrations(data.spotRegistrations || []);
      }
    } catch (error) {
      console.error('Error fetching spot registrations:', error);
    }
  };

  const handleCompleteEvent = async () => {
    if (!user || !id) return;
    
    setCompletingEvent(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/complete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        addToast({ type: 'success', title: 'Sub-Event Completed', message: 'The sub-event has been marked as completed.' });
        fetchSubEvent();
        fetchEligibleWinners();
      } else {
        addToast({ type: 'error', title: 'Failed', message: data.error || 'Could not complete sub-event' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to complete sub-event' });
    } finally {
      setCompletingEvent(false);
    }
  };

  const handleReopenEvent = async () => {
    if (!user || !id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/reopen`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        addToast({ type: 'success', title: 'Sub-Event Reopened', message: 'The sub-event has been reopened.' });
        fetchSubEvent();
      } else {
        addToast({ type: 'error', title: 'Failed', message: data.error || 'Could not reopen sub-event' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to reopen sub-event' });
    }
  };

  const handleAddSpotRegistration = async () => {
    if (!user || !id || !spotRegName.trim()) return;
    
    setAddingSpotReg(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/spot-registrations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          participantName: spotRegName.trim(),
          identifier: spotRegIdentifier.trim(),
          notes: spotRegNotes.trim()
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        addToast({ type: 'success', title: 'Spot Registration Added', message: `${spotRegName} has been added.` });
        setSpotRegName('');
        setSpotRegIdentifier('');
        setSpotRegNotes('');
        setShowSpotRegModal(false);
        fetchSpotRegistrations();
        fetchEligibleWinners();
      } else {
        addToast({ type: 'error', title: 'Failed', message: data.error || 'Could not add spot registration' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to add spot registration' });
    } finally {
      setAddingSpotReg(false);
    }
  };

  const handleAddWinner = async () => {
    if (!user || !id || !selectedParticipantId) return;
    
    setAddingWinner(true);
    try {
      const token = localStorage.getItem('token');
      const body: Record<string, unknown> = {
        userId,
        position: selectedWinnerPosition,
        participantType: selectedParticipantType
      };
      
      if (selectedParticipantType === 'registered') {
        body.participantUserId = selectedParticipantId;
      } else {
        body.spotRegistrationId = selectedParticipantId;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/winners`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        addToast({ type: 'success', title: 'Winner Added', message: `Position ${selectedWinnerPosition} winner added successfully.` });
        setSelectedParticipantId('');
        setSelectedWinnerPosition((prev) => prev + 1);
        fetchWinners();
        fetchEligibleWinners();
      } else {
        addToast({ type: 'error', title: 'Failed', message: data.error || 'Could not add winner' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to add winner' });
    } finally {
      setAddingWinner(false);
    }
  };

  const handleRemoveWinner = async (winnerId: string) => {
    if (!user || !id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/winners/${winnerId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        addToast({ type: 'success', title: 'Winner Removed', message: 'Winner has been removed.' });
        fetchWinners();
        fetchEligibleWinners();
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to remove winner' });
    }
  };

  const handleRegister = async () => {
    if (!userId) {
      addToast({ type: 'error', title: 'Please login to register' });
      return;
    }

    // Optimistic update: Show registration immediately
    setRegistering(true);
    const previousRegistration = userRegistration;
    const previousWaitlistStatus = userWaitlistStatus;
    const previousSubEvent = subEvent;
    
    // Create a temporary registration object for optimistic UI
    const tempRegistration: SubEventRegistration = {
      _id: 'temp-' + Date.now(),
      registrationId: 'TEMP-' + Date.now(),
      userId,
      subEventId: id || '',
      parentEventId: subEvent?.parentEventId || '',
      registeredAt: new Date().toISOString(),
      status: 'registered'
    };
    
    // Optimistically update UI
    setUserRegistration(tempRegistration);
    if (subEvent) {
      setSubEvent({
        ...subEvent,
        registeredCount: (subEvent.registeredCount || 0) + 1
      });
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Check if added to waitlist
        if (data.waitlist) {
          // Revert optimistic update since user went to waitlist
          setUserRegistration(null);
          setSubEvent(previousSubEvent);
          setUserWaitlistStatus(data.waitlistEntry);
          addToast({ 
            type: 'info', 
            title: 'Added to Waitlist',
            message: `Event is full. You've been added to the waitlist at position ${data.position}.` 
          });
        } else {
          // Update with real data
          setUserRegistration(data);
          addToast({ 
            type: 'success', 
            title: 'Registration Successful!',
            message: 'You have been registered for both the sub-event and main event.' 
          });
        }
        // Fetch real data in background to sync
        fetchSubEvent();
      } else {
        // Revert optimistic update on error
        setUserRegistration(previousRegistration);
        setUserWaitlistStatus(previousWaitlistStatus);
        setSubEvent(previousSubEvent);
        const error = await response.json();
        addToast({ type: 'error', title: error.message || 'Failed to register' });
      }
    } catch (error) {
      // Revert optimistic update on error
      setUserRegistration(previousRegistration);
      setUserWaitlistStatus(previousWaitlistStatus);
      setSubEvent(previousSubEvent);
      console.error('Error registering:', error);
      addToast({ type: 'error', title: 'An error occurred while registering' });
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async () => {
    if (!userId) return;

    // Optimistic update: Remove registration immediately
    setRegistering(true);
    const previousRegistration = userRegistration;
    const previousSubEvent = subEvent;
    
    // Optimistically update UI
    setUserRegistration(null);
    if (subEvent && subEvent.registeredCount && subEvent.registeredCount > 0) {
      setSubEvent({
        ...subEvent,
        registeredCount: subEvent.registeredCount - 1
      });
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/unregister`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        }
      );

      if (response.ok) {
        addToast({ type: 'success', title: 'Successfully unregistered' });
        // Fetch real data in background to sync
        fetchSubEvent();
      } else {
        // Revert optimistic update on error
        setUserRegistration(previousRegistration);
        setSubEvent(previousSubEvent);
        const error = await response.json();
        addToast({ type: 'error', title: error.message || 'Failed to unregister' });
      }
    } catch (error) {
      // Revert optimistic update on error
      setUserRegistration(previousRegistration);
      setSubEvent(previousSubEvent);
      console.error('Error unregistering:', error);
      addToast({ type: 'error', title: 'An error occurred' });
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async () => {
    if (!subEvent?.parentEventId) return;

    try {
      setDeleting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        addToast({ 
          type: 'success', 
          title: 'Sub-Event Deleted',
          message: 'The sub-event has been successfully deleted'
        });
        // Navigate back to parent event page
        navigate(`/events/${subEvent.parentEventId}`);
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.message || 'Failed to delete sub-event' });
      }
    } catch (error) {
      console.error('Error deleting sub-event:', error);
      addToast({ type: 'error', title: 'An error occurred while deleting' });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleApproveWaitlist = async (waitlistUserId: string) => {
    if (!id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/waitlist/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId: waitlistUserId })
        }
      );

      if (response.ok) {
        addToast({ 
          type: 'success', 
          title: 'User Approved',
          message: 'User has been registered from waitlist'
        });
        fetchWaitlist(); // Refresh waitlist
        fetchAttendees(); // Refresh attendees
        fetchSubEvent(); // Refresh counts
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.message || 'Failed to approve user' });
      }
    } catch (error) {
      console.error('Error approving waitlist user:', error);
      addToast({ type: 'error', title: 'An error occurred' });
    }
  };

  const handleRemoveFromWaitlist = async (waitlistUserId: string) => {
    if (!id) return;
    
    if (!confirm('Are you sure you want to remove this user from the waitlist?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/waitlist/remove`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId: waitlistUserId })
        }
      );

      if (response.ok) {
        addToast({ 
          type: 'success', 
          title: 'User Removed',
          message: 'User has been removed from waitlist'
        });
        fetchWaitlist(); // Refresh waitlist
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.message || 'Failed to remove user' });
      }
    } catch (error) {
      console.error('Error removing from waitlist:', error);
      addToast({ type: 'error', title: 'An error occurred' });
    }
  };

  const exportToExcel = async () => {
    if (attendees.length === 0) {
      addToast({ type: 'info', title: 'No attendees to export' });
      return;
    }

    try {
      // Transform attendees to match the expected format
      const formattedAttendees = attendees.map((reg) => {
        const userInfo = (reg as any).userId || reg.user;
        return {
          userId: userInfo,
          user: userInfo,
          registrationId: reg.registrationId,
          source: (reg as any).source,
          status: reg.status,
          registeredAt: reg.registeredAt,
          scannedAt: reg.scannedAt,
        };
      });

      await exportAttendeesToExcel(formattedAttendees, subEvent?.title || 'SubEvent');
      addToast({ type: 'success', title: 'Attendees exported successfully!' });
    } catch (error) {
      console.error('Export failed:', error);
      addToast({ type: 'error', title: 'Failed to export attendees' });
    }
  };

  // Team-related functions - use stable userId to prevent recreation
  const fetchUserTeam = useCallback(async () => {
    if (!userId || !id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/my-team?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserTeam(data.team);
      }
    } catch (error) {
      console.error('Error fetching user team:', error);
    }
  }, [userId, id]);

  const fetchAllTeams = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/teams`);
      if (response.ok) {
        const data = await response.json();
        setAllTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  }, [id]);

  const fetchTeamInvitations = useCallback(async () => {
    if (!userId || !id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/my-team-invitations?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setTeamInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error('Error fetching team invitations:', error);
    }
  }, [userId, id]);

  // Fetch team data when sub-event is a team event - use stable ref to prevent loop
  const isTeamEvent = subEvent?.isTeamEvent;
  useEffect(() => {
    if (isTeamEvent && userId) {
      fetchUserTeam();
      fetchTeamInvitations();
      fetchAllTeams();
    }
  }, [isTeamEvent, userId, fetchUserTeam, fetchTeamInvitations, fetchAllTeams]);

  const handleCreateTeam = async () => {
    if (!userId || !teamName.trim()) {
      addToast({ type: 'error', title: 'Please enter a team name' });
      return;
    }

    setCreatingTeam(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, teamName: teamName.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setUserTeam(data.team);
        setShowCreateTeam(false);
        setTeamName('');
        addToast({ type: 'success', title: 'Team Created!', message: `Team "${teamName}" has been created` });
        fetchAllTeams();
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.error || 'Failed to create team' });
      }
    } catch (error) {
      console.error('Error creating team:', error);
      addToast({ type: 'error', title: 'Failed to create team' });
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setUserSearchQuery(query);
    if (query.length < 2) {
      setSearchUsers([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sub-events/${id}/search-users?query=${encodeURIComponent(query)}&excludeUserId=${userId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleInviteUser = async (inviteeId: string) => {
    if (!userTeam || !userId) return;

    setInvitingUser(inviteeId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/teams/${userTeam._id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaderId: userId,
          inviteeId,
          message: inviteMessage
        })
      });

      if (response.ok) {
        addToast({ type: 'success', title: 'Invitation Sent!' });
        setSearchUsers(searchUsers.filter(u => u._id !== inviteeId));
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.error || 'Failed to send invitation' });
      }
    } catch (error) {
      console.error('Error inviting user:', error);
      addToast({ type: 'error', title: 'Failed to send invitation' });
    } finally {
      setInvitingUser(null);
    }
  };

  const handleAcceptInvitation = async (inviteId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/team-invitations/${inviteId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const data = await response.json();
        setUserTeam(data.team);
        setTeamInvitations(teamInvitations.filter(i => i._id !== inviteId));
        addToast({ type: 'success', title: 'Joined Team!', message: 'You have joined the team' });
        fetchAllTeams();
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.error || 'Failed to accept invitation' });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      addToast({ type: 'error', title: 'Failed to accept invitation' });
    }
  };

  const handleDeclineInvitation = async (inviteId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/team-invitations/${inviteId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        setTeamInvitations(teamInvitations.filter(i => i._id !== inviteId));
        addToast({ type: 'info', title: 'Invitation Declined' });
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  const handleCompleteTeamRegistration = async () => {
    if (!userTeam || !userId) return;

    setCompletingTeam(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/teams/${userTeam._id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const data = await response.json();
        setUserTeam(data.team);
        addToast({ type: 'success', title: 'Registration Complete!', message: 'Your team registration is now complete' });
        fetchAllTeams();
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.error || 'Failed to complete registration' });
      }
    } catch (error) {
      console.error('Error completing team registration:', error);
      addToast({ type: 'error', title: 'Failed to complete registration' });
    } finally {
      setCompletingTeam(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!userTeam || !userId) return;

    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/teams/${userTeam._id}/remove-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId: userId, memberId })
      });

      if (response.ok) {
        const data = await response.json();
        setUserTeam(data.team);
        addToast({ type: 'success', title: 'Member Removed' });
        fetchAllTeams();
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.error || 'Failed to remove member' });
      }
    } catch (error) {
      console.error('Error removing member:', error);
      addToast({ type: 'error', title: 'Failed to remove member' });
    }
  };

  const handleLeaveTeam = async () => {
    if (!userTeam || !userId) return;

    if (!confirm('Are you sure you want to leave this team?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/teams/${userTeam._id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        setUserTeam(null);
        addToast({ type: 'info', title: 'Left Team' });
        fetchAllTeams();
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.error || 'Failed to leave team' });
      }
    } catch (error) {
      console.error('Error leaving team:', error);
      addToast({ type: 'error', title: 'Failed to leave team' });
    }
  };

  const handleDeleteTeam = async () => {
    if (!userTeam || !userId) return;

    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}/teams/${userTeam._id}?userId=${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setUserTeam(null);
        addToast({ type: 'success', title: 'Team Deleted' });
        fetchAllTeams();
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: error.error || 'Failed to delete team' });
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      addToast({ type: 'error', title: 'Failed to delete team' });
    }
  };

  const isTeamLeader = userTeam?.leaderId?._id === userId || userTeam?.leaderId === userId;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Filter and sort attendees (moved before early returns to avoid hooks error)
  const filteredAndSortedAttendees = React.useMemo(() => {
    return attendees
      .filter((registration) => {
        const userInfo = (registration as any).userId || registration.user;
        const name = userInfo?.name?.toLowerCase() || '';
        const email = userInfo?.email?.toLowerCase() || '';
        const department = userInfo?.department?.trim().toUpperCase() || '';
        const regId = registration.registrationId?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();

        // Search filter
        const matchesSearch = name.includes(query) || 
                             email.includes(query) || 
                             department.toLowerCase().includes(query) ||
                             regId.includes(query);

        // Department filter
        const matchesDepartment = departmentFilter === 'all' || 
          department === departmentFilter;

        return matchesSearch && matchesDepartment;
      })
      .sort((a, b) => {
        const userA = (a as any).userId || a.user;
        const userB = (b as any).userId || b.user;
        let result = 0;
        if (sortBy === 'name') {
          result = (userA?.name || '').localeCompare(userB?.name || '');
        } else if (sortBy === 'department') {
          result = (userA?.department?.trim().toUpperCase() || '').localeCompare(userB?.department?.trim().toUpperCase() || '');
        } else {
          // Sort by date (newest first)
          result = new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime();
        }
        return sortOrder === 'asc' ? result : -result;
      });
  }, [attendees, searchQuery, departmentFilter, sortBy, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedAttendees.length / studentsPerPage);
  const paginatedAttendees = React.useMemo(() => {
    const startIndex = (currentPage - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    return filteredAndSortedAttendees.slice(startIndex, endIndex);
  }, [filteredAndSortedAttendees, currentPage, studentsPerPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, sortBy, sortOrder]);

  // Get unique departments for filter (case-insensitive, sorted)
  const uniqueDepartments = React.useMemo(() => {
    return Array.from(
      new Set(
        attendees
          .map((reg) => {
            const userInfo = (reg as any).userId || reg.user;
            return userInfo?.department?.trim().toUpperCase();
          })
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [attendees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!subEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Sub-Event Not Found
        </h2>
        <button
          onClick={() => navigate(-1)}
          className="text-blue-500 hover:text-blue-600"
        >
          Go Back
        </button>
      </div>
    );
  }

  // isOrganizer is already defined at the top of the component
  
  // Allow registration if:
  // 1. User has access (or access check hasn't happened yet - default to true for 'everyone')
  // 2. User is not already registered
  // 3. Event status is published or upcoming
  // 4. Capacity is not full
  const hasAccess = accessCheck?.hasAccess !== false; // Default to true if not checked yet
  const canRegister = hasAccess && 
                      !userRegistration && 
                      subEvent.status === 'upcoming' &&
                      (!subEvent.capacity || (subEvent.registeredCount || 0) < subEvent.capacity);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 pt-24 pb-8 px-4"
    >
      <div className="max-w-6xl mx-auto">
        {/* Back Button and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {/* Action Buttons - Only for Organizers/Admins */}
          {isOrganizer && (
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-3 w-full sm:w-auto">
              <button
                onClick={() => navigate(`/sub-events/${id}/edit`)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium shadow-md text-sm sm:text-base"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Sub-Event</span>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium shadow-md text-sm sm:text-base"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Sub-Event</span>
              </button>
            </div>
          )}
        </div>

        {/* Hero Section */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6 border border-gray-200">
          {subEvent.imageUrl && (
            <div className="h-48 sm:h-64 overflow-hidden">
              <img
                src={subEvent.imageUrl}
                alt={subEvent.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-4 sm:p-6 md:p-8">
            {/* Status & Access Badge */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
              <span className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-medium capitalize ${
                subEvent.status === 'upcoming' ? 'bg-green-100 text-green-800' :
                subEvent.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                subEvent.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                subEvent.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {subEvent.status}
              </span>
              <AccessControlBadge accessControl={subEvent.accessControl} showDetails />
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              {subEvent.title}
            </h1>

            {/* Description */}
            <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-4 sm:mb-6">
              {subEvent.description}
            </p>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-50 rounded-lg flex-shrink-0">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Date</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                    {formatDate(subEvent.date)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-50 rounded-lg flex-shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Time</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                    {subEvent.time || 'Time not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-50 rounded-lg flex-shrink-0">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Venue</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                    {subEvent.venue || 'Venue not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-50 rounded-lg flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Registrations</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900">
                    {subEvent.registeredCount || 0}
                    {subEvent.capacity && ` / ${subEvent.capacity}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            {subEvent.tags && subEvent.tags.length > 0 && (
              <div className="flex items-center gap-2 pt-4 flex-wrap">
                <Tag className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {subEvent.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-50 text-blue-700 rounded-full font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Access Denied Message */}
            {accessCheck && !accessCheck.hasAccess && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mt-4">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Access Denied</p>
                  <p className="text-sm text-red-700 mt-1">
                    {accessCheck.denialReason}
                  </p>
                </div>
              </div>
            )}

            {/* Waitlist Status */}
            {userWaitlistStatus && !userRegistration && (
              <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg mt-4">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-yellow-900">
                    You are on the waitlist
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Position: #{userWaitlistStatus.position}
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">
                    You'll be notified if a spot becomes available
                  </p>
                </div>
              </div>
            )}

            {/* Registration Status */}
            {userRegistration && (
              <div className="space-y-4 mt-4">
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-green-900">
                      You are registered for this sub-event
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Registration ID: {userRegistration.registrationId}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                      ✓ You have been automatically registered for the main event as well
                    </p>
                  </div>
                  <button
                    onClick={handleUnregister}
                    disabled={registering}
                    className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    {registering ? 'Processing...' : 'Unregister'}
                  </button>
                </div>

                {/* Display Parent Event QR Code */}
                {userRegistration.parentRegistration?.qrCode && (
                  <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">🎫</span>
                      <div>
                        <p className="font-semibold text-blue-900">
                          Main Event QR Code (with Sub-Event Details)
                        </p>
                        <p className="text-sm text-blue-700 mt-0.5">
                          Your sub-event registration is automatically included in this QR code
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center bg-white rounded-lg p-6 shadow-sm">
                      <img
                        src={userRegistration.parentRegistration.qrCode}
                        alt="Main Event QR Code"
                        className="w-56 h-56 object-contain border-4 border-blue-200 rounded-lg"
                      />
                      <p className="text-sm text-gray-600 mt-3 font-medium">
                        Registration ID: {userRegistration.parentRegistration.id}
                      </p>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = userRegistration.parentRegistration!.qrCode;
                          link.download = `${subEvent?.title}-QR-Code.png`;
                          link.click();
                        }}
                        className="mt-4 px-6 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                      >
                        Download QR Code
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Register Button */}
            {canRegister && (
              <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                {registering ? 'Registering...' : 'Register for Sub-Event'}
              </button>
            )}
          </div>
        </div>

        {/* Team Registration Section - For all registered users on team events */}
        {subEvent.isTeamEvent && (userRegistration || isOrganizer) && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mt-6">
            <TeamManager
              eventId={id || ''}
              eventTitle={subEvent.title}
              registrationDeadline={subEvent.registrationDeadline}
              minTeamSize={subEvent.minTeamSize || 2}
              maxTeamSize={subEvent.maxTeamSize || 4}
              isSubEvent={true}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="border-b border-gray-200 overflow-x-auto scrollbar-thin">
            <div className="flex gap-2 sm:gap-4 md:gap-8 px-4 sm:px-6 md:px-8 min-w-max">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium sm:font-semibold transition-colors whitespace-nowrap text-sm sm:text-base ${
                  activeTab === 'details'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
              {isOrganizer && (
                <>
                  <button
                    onClick={() => setActiveTab('attendees')}
                    className={`py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium sm:font-semibold transition-colors whitespace-nowrap text-sm sm:text-base ${
                      activeTab === 'attendees'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Attendees ({subEvent.registeredCount || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('waitlist')}
                    className={`py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium sm:font-semibold transition-colors whitespace-nowrap text-sm sm:text-base ${
                      activeTab === 'waitlist'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Waitlist ({waitlist.length})
                  </button>
                  {subEvent.isTeamEvent && (
                    <button
                      onClick={() => setActiveTab('teams')}
                      className={`py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium sm:font-semibold transition-colors whitespace-nowrap text-sm sm:text-base ${
                        activeTab === 'teams'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Teams ({allTeams.length})
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => setActiveTab('comments')}
                className={`py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium sm:font-semibold transition-colors whitespace-nowrap text-sm sm:text-base flex items-center gap-1 sm:gap-2 ${
                  activeTab === 'comments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                Comments
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 md:p-8">
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-4 sm:space-y-6">
                {subEvent.category && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      Category
                    </h3>
                    <p className="text-sm sm:text-base text-gray-700 capitalize bg-gray-50 px-3 sm:px-4 py-2 rounded-lg">
                      {subEvent.category}
                    </p>
                  </div>
                )}

                {subEvent.organizer && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-blue-600" />
                      Organizer
                    </h3>
                    <div className="bg-gray-50 px-4 py-3 rounded-lg">
                      <p className="text-gray-900 font-medium">{subEvent.organizer.name}</p>
                      <p className="text-gray-600 text-sm">{subEvent.organizer.email}</p>
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {subEvent.requirements && subEvent.requirements.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Requirements</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 bg-gray-50 p-4 rounded-lg">
                      {subEvent.requirements.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prizes */}
                {subEvent.prizes && subEvent.prizes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      Prizes
                    </h3>
                    <div className="space-y-2">
                      {subEvent.prizes.map((prize, index) => (
                        <div key={index} className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-amber-50 p-3 rounded-lg border border-yellow-200">
                          <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}</span>
                          <span className="font-medium text-gray-800">{prize}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Winners Section - Show for completed events */}
                {(subEvent.status === 'completed' || winners.length > 0) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Award className="w-5 h-5 text-purple-600" />
                      Winners
                    </h3>
                    {winners.length > 0 ? (
                      <div className="space-y-3">
                        {winners.map((winner) => (
                          <div key={winner._id} className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                            <div className="flex items-center gap-4">
                              <span className="text-3xl">
                                {winner.position === 1 ? '🥇' : winner.position === 2 ? '🥈' : winner.position === 3 ? '🥉' : '🏅'}
                              </span>
                              <div>
                                <p className="font-semibold text-gray-900">{winner.participantName}</p>
                                <p className="text-sm text-gray-600">
                                  {winner.participantType === 'registered' 
                                    ? winner.userId?.department || 'Registered Participant'
                                    : 'Spot Registration'}
                                </p>
                                {winner.prize && (
                                  <p className="text-sm text-purple-600 font-medium mt-1">{winner.prize}</p>
                                )}
                              </div>
                            </div>
                            {isOrganizer && (
                              <button
                                onClick={() => handleRemoveWinner(winner._id)}
                                className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                title="Remove winner"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm bg-gray-50 p-4 rounded-lg">No winners have been announced yet.</p>
                    )}
                  </div>
                )}

                {/* Event Completion and Winner Management - Only for Organizers */}
                {isOrganizer && (
                  <div className="border-t border-gray-200 pt-6 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Edit3 className="w-5 h-5 text-blue-600" />
                      Event Management
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Complete/Reopen Event */}
                      {subEvent.status !== 'completed' ? (
                        <button
                          onClick={handleCompleteEvent}
                          disabled={completingEvent}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle className="w-5 h-5" />
                          {completingEvent ? 'Marking Complete...' : 'Mark Sub-Event as Complete'}
                        </button>
                      ) : (
                        <button
                          onClick={handleReopenEvent}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
                        >
                          <AlertCircle className="w-5 h-5" />
                          Reopen Sub-Event
                        </button>
                      )}

                      {/* Winner Management - Only when completed */}
                      {subEvent.status === 'completed' && (
                        <>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setShowWinnersModal(true)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                            >
                              <Trophy className="w-5 h-5" />
                              Add Winners
                            </button>
                            <button
                              onClick={() => setShowSpotRegModal(true)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                              <UserPlus className="w-5 h-5" />
                              Add Spot Registration
                            </button>
                          </div>

                          {/* Spot Registrations List */}
                          {spotRegistrations.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium text-gray-700 mb-2">Spot Registrations ({spotRegistrations.length})</h4>
                              <div className="space-y-2">
                                {spotRegistrations.map((spot) => (
                                  <div key={spot._id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                    <div>
                                      <p className="font-medium text-gray-800">{spot.participantName}</p>
                                      {spot.identifier && <p className="text-sm text-gray-500">{spot.identifier}</p>}
                                    </div>
                                    <span className="text-xs text-gray-400">
                                      Added by {spot.addedBy?.name || 'Unknown'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Attendees Tab */}
            {activeTab === 'attendees' && isOrganizer && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Registered Students ({filteredAndSortedAttendees.length})
                    </h3>
                    {(searchQuery || departmentFilter !== 'all') && (
                      <p className="text-sm text-gray-500 mt-1">
                        Showing {filteredAndSortedAttendees.length} of {attendees.length} students
                      </p>
                    )}
                  </div>
                  <button
                    onClick={exportToExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export to Excel
                  </button>
                </div>

                {/* Search and Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>


                  {/* Department Filter */}
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    title="Filter by department"
                  >
                    <option value="all">All Departments</option>
                    {uniqueDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  {/* Sort By + Asc/Desc */}
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'department' | 'date')}
                      className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      title="Sort attendees by"
                    >
                      <option value="date">Sort by Date</option>
                      <option value="name">Sort by Name</option>
                      <option value="department">Sort by Department</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="ml-2 px-2 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {sortOrder === 'asc' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Pagination Controls - Top */}
                {filteredAndSortedAttendees.length > studentsPerPage && (
                  <motion.div 
                    className="mb-4 flex items-center justify-between border-b pb-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <motion.div 
                      className="text-sm text-gray-600"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                    >
                      Showing {((currentPage - 1) * studentsPerPage) + 1} to {Math.min(currentPage * studentsPerPage, filteredAndSortedAttendees.length)} of {filteredAndSortedAttendees.length} students
                    </motion.div>
                    <motion.div 
                      className="flex items-center space-x-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    >
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Previous</span>
                      </button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 rounded-md transition-colors ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <span>Next</span>
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </button>
                    </motion.div>
                  </motion.div>
                )}

                {filteredAndSortedAttendees.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg min-h-[400px] flex items-center justify-center flex-col">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {attendees.length === 0 ? 'No attendees yet' : 'No students match your search'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg min-h-[400px]">
                    <table className="w-full table-fixed">
                      <colgroup>
                        {(user?.role === 'admin' || user?.role === 'organizer') && (
                          <col className="w-40" />
                        )}
                        <col className="w-44" />
                        {(user?.role === 'admin' || user?.role === 'organizer') && (
                          <col className="w-60" />
                        )}
                        <col className="w-32" />
                        <col className="w-28" />
                        <col className="w-20" />
                        <col className="w-40" />
                        <col className="w-28" />
                        <col className="w-32" />
                      </colgroup>
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {(user?.role === 'admin' || user?.role === 'organizer') && (
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                              Reg. ID
                            </th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Name
                          </th>
                          {(user?.role === 'admin' || user?.role === 'organizer') && (
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                              Email
                            </th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Department
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Section/Room
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Year
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Registered At
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Source
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedAttendees.map((registration) => {
                          const userInfo = (registration as any).userId || registration.user;
                          return (
                            <motion.tr 
                              key={registration._id} 
                              className="hover:bg-gray-50 transition-colors"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            >
                              {(user?.role === 'admin' || user?.role === 'organizer') && (
                                <td className="px-4 py-4">
                                  <div className="text-xs font-mono text-gray-900 break-all">
                                    {registration.registrationId}
                                  </div>
                                </td>
                              )}
                              <td className="px-4 py-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {userInfo?.name || 'N/A'}
                                </div>
                              </td>
                              {(user?.role === 'admin' || user?.role === 'organizer') && (
                                <td className="px-4 py-4">
                                  <div className="text-sm text-gray-600 break-all">
                                    {userInfo?.email || 'N/A'}
                                  </div>
                                </td>
                              )}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600">
                                  {userInfo?.department || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-sm text-gray-600">
                                  {userInfo?.section || userInfo?.roomNo || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-sm text-gray-600">
                                  {userInfo?.year || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600">
                                  {new Date(registration.registeredAt).toLocaleDateString()} {new Date(registration.registeredAt).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  (registration as any).source === 'waitlist' 
                                    ? 'bg-purple-100 text-purple-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {(registration as any).source === 'waitlist' ? 'Waitlist' : 'Direct'}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  registration.status === 'attended' 
                                    ? 'bg-green-100 text-green-800' 
                                    : registration.status === 'registered'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {registration.status}
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination Controls */}
                {filteredAndSortedAttendees.length > studentsPerPage && (
                  <motion.div 
                    className="mt-6 flex items-center justify-between border-t pt-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <motion.div 
                      className="text-sm text-gray-600"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                    >
                      Showing {((currentPage - 1) * studentsPerPage) + 1} to {Math.min(currentPage * studentsPerPage, filteredAndSortedAttendees.length)} of {filteredAndSortedAttendees.length} students
                    </motion.div>
                    <motion.div 
                      className="flex items-center space-x-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    >
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Previous</span>
                      </button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 rounded-md transition-colors ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <span>Next</span>
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Waitlist Tab */}
            {activeTab === 'waitlist' && isOrganizer && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Waitlist
                  </h3>
                  <div className="text-sm text-gray-600">
                    {waitlist.length} people waiting
                  </div>
                </div>

                {waitlist.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg min-h-[400px] flex items-center justify-center flex-col">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No one on waitlist</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg min-h-[400px]">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Position
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Year
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Joined At
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {waitlist.map((entry) => {
                          const userInfo = entry.userId;
                          return (
                            <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-blue-600">
                                  #{entry.position}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {userInfo?.name || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600">
                                  {userInfo?.email || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600">
                                  {userInfo?.department || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600">
                                  {userInfo?.year || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600">
                                  {new Date(entry.joinedAt).toLocaleDateString()} {new Date(entry.joinedAt).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                  {entry.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApproveWaitlist(entry.userId._id || entry.userId)}
                                    className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                                    title="Approve and register"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleRemoveFromWaitlist(entry.userId._id || entry.userId)}
                                    className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded font-medium transition-colors"
                                    title="Remove from waitlist"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Teams Tab */}
            {activeTab === 'teams' && subEvent.isTeamEvent && (
              <div className="space-y-6">
                {/* View Toggle */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">All Teams ({allTeams.length})</h3>
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setParticipantView('individual')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        participantView === 'individual' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Individual
                    </button>
                    <button
                      onClick={() => setParticipantView('teams')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        participantView === 'teams' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Teams
                    </button>
                  </div>
                </div>

                {/* Teams Grid */}
                {allTeams.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No teams have been created yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {allTeams.map((team) => (
                      <div 
                        key={team._id}
                        className={`border rounded-xl p-4 ${
                          team.status === 'complete' ? 'border-green-200 bg-green-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">{team.name}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            team.status === 'complete' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {team.status === 'complete' ? 'Complete' : 'Forming'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {team.members?.map((member: any) => (
                            <div key={member.userId?._id || member.userId} className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                member.role === 'leader' 
                                  ? 'bg-yellow-100 text-yellow-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {member.role === 'leader' ? <Crown className="w-4 h-4" /> : (member.userId?.name?.charAt(0) || 'M')}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {member.userId?.name || 'Unknown'}
                                </p>
                                <p className="text-xs text-gray-500">{member.userId?.department} • Year {member.userId?.year}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                          {team.members?.length || 0} / {team.maxMembers || subEvent.maxTeamSize || 4} members
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <Comments eventId={id || ''} eventStatus={subEvent?.status} />
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Delete Sub-Event</h3>
              </div>

              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "<span className="font-semibold">{subEvent?.title}</span>"? 
                This action cannot be undone and will remove all registrations and data associated with this sub-event.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Winners Modal */}
        {showWinnersModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-full">
                    <Trophy className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Add Winner</h3>
                </div>
                <button
                  onClick={() => setShowWinnersModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close add winner modal"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Position Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                  <select
                    value={selectedWinnerPosition}
                    onChange={(e) => setSelectedWinnerPosition(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    title="Select winner position"
                  >
                    {[1, 2, 3, 4, 5].map((pos) => {
                      const existingWinner = winners.find(w => w.position === pos);
                      return (
                        <option key={pos} value={pos} disabled={!!existingWinner}>
                          Position {pos} {existingWinner ? '(Filled)' : ''} 
                          {eligibleWinners.prizes[pos - 1] ? ` - ${eligibleWinners.prizes[pos - 1]}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Participant Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Participant Type</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedParticipantType('registered');
                        setSelectedParticipantId('');
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedParticipantType === 'registered'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Registered ({eligibleWinners.registered.length})
                    </button>
                    <button
                      onClick={() => {
                        setSelectedParticipantType('spot');
                        setSelectedParticipantId('');
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedParticipantType === 'spot'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Spot Registration ({eligibleWinners.spot.length})
                    </button>
                  </div>
                </div>

                {/* Participant Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Participant</label>
                  {selectedParticipantType === 'registered' ? (
                    <select
                      value={selectedParticipantId}
                      onChange={(e) => setSelectedParticipantId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      title="Select registered participant"
                    >
                      <option value="">Select a participant</option>
                      {eligibleWinners.registered.map((reg) => {
                        const userData = (reg as any).userId || reg.user;
                        return (
                          <option key={userData._id} value={userData._id}>
                            {userData.name} ({userData.department || 'No Department'})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <select
                      value={selectedParticipantId}
                      onChange={(e) => setSelectedParticipantId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      title="Select spot registration"
                    >
                      <option value="">Select a spot registration</option>
                      {eligibleWinners.spot.map((spot) => (
                        <option key={spot._id} value={spot._id}>
                          {spot.participantName} {spot.identifier ? `(${spot.identifier})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowWinnersModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddWinner}
                    disabled={addingWinner || !selectedParticipantId}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {addingWinner ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add Winner</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Spot Registration Modal */}
        {showSpotRegModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <UserPlus className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Add Spot Registration</h3>
                </div>
                <button
                  onClick={() => setShowSpotRegModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close spot registration modal"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <p className="text-gray-600 text-sm mb-4">
                Add a participant who wasn't registered online. They can then be selected as a winner.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Participant Name *</label>
                  <input
                    type="text"
                    value={spotRegName}
                    onChange={(e) => setSpotRegName(e.target.value)}
                    placeholder="Enter participant name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Identifier (optional)</label>
                  <input
                    type="text"
                    value={spotRegIdentifier}
                    onChange={(e) => setSpotRegIdentifier(e.target.value)}
                    placeholder="e.g., Roll number, ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                  <textarea
                    value={spotRegNotes}
                    onChange={(e) => setSpotRegNotes(e.target.value)}
                    placeholder="Any additional notes"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowSpotRegModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddSpotRegistration}
                    disabled={addingSpotReg || !spotRegName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {addingSpotReg ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SubEventDetails;
