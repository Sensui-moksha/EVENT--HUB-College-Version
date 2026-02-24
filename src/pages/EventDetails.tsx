import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../contexts/EventContext.tsx';
import { useToast } from '../components/ui/Toast';
import Comments from '../components/Comments';
import SubEventsList from '../components/SubEventsList';
import WaitingListManager from '../components/WaitingListManager';
import TeamManager from '../components/TeamManager';
import TeamView from '../components/TeamView';
import { exportParticipantsToExcel } from '../utils/excelExport';
import type { User as UserType, Winner, Registration, SpotRegistration } from '../types';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Trophy,
  CheckCircle,
  X,
  ArrowLeft,
  Share2,
  QrCode,
  User,
  Trash2,
  Filter,
  Download,
  SortAsc,
  SortDesc,
  Edit3,
  Copy,
  MessageCircle,
  Mail,
  MoreHorizontal,
  Search,
  Bell,
  AlertCircle,
  AlertTriangle,
  Images,
  UserPlus,
  Crown,
} from 'lucide-react';
import { Info, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { pageVariants, backdropVariants, modalVariants } from '../utils/animations';
import { displayCategoryLabel, getCategoryColor } from '../utils/categories';
import { API_BASE_URL } from '../utils/api';
import ConfirmModal from '../components/ConfirmModal';

const EventDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { events, registrations, registerForEvent, unregisterFromEvent, removeParticipant, deleteEvent, loading } = useEvents();
  const { addToast } = useToast();
  const [showQR, setShowQR] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShareMenu]);
  
  // Filtering, sorting, and search state
  const [sortBy, setSortBy] = useState<'regId' | 'name' | 'department' | 'year'>('department');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 20;

  // Approval waiting list state
  const [showApprovalWaitlist, setShowApprovalWaitlist] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Waitlist state
  const [waitlistStatus, setWaitlistStatus] = useState<{ onWaitlist: boolean; position: number | null }>({ 
    onWaitlist: false, 
    position: null 
  });
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistUsers, setWaitlistUsers] = useState<Array<{
    _id: string;
    user: {
      _id: string;
      name: string;
      email: string;
      regId: string;
      department: string;
      year: string;
    };
    position: number;
    joinedAt: string;
  }>>([]);

  // Announcement modal state
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  // Event completion and winners state
  const [completingEvent, setCompletingEvent] = useState(false);
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [eligibleWinners, setEligibleWinners] = useState<{ registered: Registration[]; spot: SpotRegistration[]; prizes: string[] }>({ registered: [], spot: [], prizes: [] });
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

  // Team-related state
  const [teamRefreshTrigger] = useState(0); // Used by TeamView component
  const [participantView, setParticipantView] = useState<'individual' | 'teams'>('individual');
  const [userTeamMap, setUserTeamMap] = useState<Record<string, { teamName: string; teamId: string; role: string; status: string }>>({});
  
  // Team invitations state
  interface TeamInvitation {
    _id: string;
    teamId: string;
    teamName: string;
    invitedBy: {
      _id: string;
      name: string;
      email: string;
    };
    status: string;
    expiresAt: string;
    members: Array<{
      userId: {
        _id: string;
        name: string;
        email: string;
      };
      role: string;
    }>;
    maxSize: number;
  }
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [_loadingInvitations, setLoadingInvitations] = useState(false);
  const [acceptingInvitation, setAcceptingInvitation] = useState<string | null>(null);

  // Event completion confirmation state
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [subEventCount, setSubEventCount] = useState(0);
  
  // Confirmation modals state
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);
  const [confirmRemoveParticipant, setConfirmRemoveParticipant] = useState<{ userId: string; userName: string } | null>(null);
  
  // Gallery state for deletion warning
  const [eventGallery, setEventGallery] = useState<{ published: boolean; mediaCount: number } | null>(null);
  const [checkingGallery, setCheckingGallery] = useState(false);

  // Stable user ID and role to prevent callback recreation
  const userId = user?._id || user?.id;
  const userRole = user?.role;

  // Robust event lookup — declared early so hooks below can reference `event` and `isPrivileged`
  const event = events.find(e => e.id === id || e._id === id);

  // Compute isPrivileged early so hooks can reference it without TDZ errors
  const isPrivileged = useMemo(() => {
    if (!event) return false;
    if (user?.role === 'admin') return true;
    return userId === event?.organizerId;
  }, [event, user?.role, userId]);

  // canView: any organizer (even if not the event creator) can view participants, details, etc.
  // but only isPrivileged users (admin + event creator) can edit/delete/remove/accept
  const canView = useMemo(() => {
    if (isPrivileged) return true;
    return user?.role === 'organizer';
  }, [isPrivileged, user?.role]);

  // Fetch team invitations for this user and event
  const fetchTeamInvitations = useCallback(async () => {
    if (!userId || !id) return;
    
    try {
      setLoadingInvitations(true);
      const response = await fetch(`${API_BASE_URL}/api/events/${id}/my-team-invitations?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setTeamInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error('Error fetching team invitations:', error);
    } finally {
      setLoadingInvitations(false);
    }
  }, [userId, id]);

  // Accept team invitation
  const handleAcceptTeamInvitation = async (invitationId: string) => {
    if (!user) return;
    
    const userId = user._id || user.id;
    if (!userId) return;
    
    try {
      setAcceptingInvitation(invitationId);
      const response = await fetch(`${API_BASE_URL}/api/team-invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        addToast({ type: 'success', title: 'Joined Team!', message: 'Successfully joined the team!' });
        fetchTeamInvitations(); // Refresh invitations
      } else {
        const data = await response.json();
        addToast({ type: 'error', title: 'Failed', message: data.error || 'Failed to accept invitation' });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      addToast({ type: 'error', title: 'Error', message: 'Failed to accept invitation' });
    } finally {
      setAcceptingInvitation(null);
    }
  };

  // Decline team invitation
  const handleDeclineTeamInvitation = async (invitationId: string) => {
    if (!user) return;
    
    const userId = user._id || user.id;
    if (!userId) return;
    
    try {
      setAcceptingInvitation(invitationId);
      const response = await fetch(`${API_BASE_URL}/api/team-invitations/${invitationId}/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        addToast({ type: 'info', title: 'Declined', message: 'Invitation declined' });
        fetchTeamInvitations(); // Refresh invitations
      } else {
        const data = await response.json();
        addToast({ type: 'error', title: 'Failed', message: data.error || 'Failed to decline invitation' });
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      addToast({ type: 'error', title: 'Error', message: 'Failed to decline invitation' });
    } finally {
      setAcceptingInvitation(null);
    }
  };

  // Waitlist functions - defined before useEffect to avoid hoisting issues
  const checkWaitlistStatus = useCallback(async () => {
    if (!userId || !id) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${id}/waitlist/status?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setWaitlistStatus({
          onWaitlist: data.onWaitlist,
          position: data.position
        });
      }
    } catch (error) {
      console.error('Error checking waitlist status:', error);
    }
  }, [userId, id]);

  const fetchWaitlistUsers = useCallback(async () => {
    if (!id || !userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${id}/waitlist?userId=${userId}`);

      if (response.ok) {
        const data = await response.json();
        setWaitlistUsers(data.waitlist || []);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    }
  }, [id, userId]);

  // Check waitlist status on component mount
  useEffect(() => {
    if (id && userId) {
      checkWaitlistStatus();
      // Fetch waitlist users for admin/event owner/any organizer
      if (canView) {
        fetchWaitlistUsers();
      }
    }
  }, [id, userId, canView, checkWaitlistStatus, fetchWaitlistUsers]);

  // Fetch team invitations for this event
  useEffect(() => {
    if (id && userId) {
      fetchTeamInvitations();
    }
  }, [id, userId, fetchTeamInvitations]);

  // Fetch pending registrations count for organizers/admins
  const fetchPendingCount = useCallback(async () => {
    if (!id || !userId) return;
    
    const event = events.find(e => e.id === id || e._id === id);
    if (!event) return;
    
    const isEventCreator = event.organizerId === userId;
    const isAdmin = userRole === 'admin';
    const isAnyOrganizer = userRole === 'organizer';
    
    if (!isEventCreator && !isAdmin && !isAnyOrganizer) return;
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/events/${id}/registrations/pending?userId=${userId}`,
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
    }
  }, [id, userId, userRole, events]);

  // Fetch pending count when event or user changes
  useEffect(() => {
    if (id && userId && events.length > 0) {
      fetchPendingCount();
    }
  }, [id, userId, events.length, fetchPendingCount]);

  // Platform-specific quick share handler
  const handleShare = async () => {
    const url = window.location.href;
    const event = events.find(e => e.id === id || e._id === id);
    if (!event) return;

    const shareData = {
      title: `${event.title} - EventHub`,
      text: `🎉 Check out this amazing event: ${event.title}\n📅 Date: ${format(new Date(event.date), 'PPP')}\n📍 Venue: ${event.venue}\n\nJoin us for an exciting experience!`,
      url,
    };

    const fullShareText = `${shareData.text}\n\n${shareData.url}`;

    // Detect platforms
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    console.log('Quick Share - Platform detection - Android:', isAndroid, 'iOS:', isIOS);

    // iOS Quick Share - Native iOS Share Sheet (includes AirDrop)
    if (isIOS) {
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          addToast({ 
            type: 'success', 
            title: 'iOS Share Sheet Opened!', 
            message: 'Event shared via iOS native sharing (includes AirDrop).' 
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            addToast({ 
              type: 'info', 
              title: 'Share Cancelled', 
              message: 'iOS sharing was cancelled.' 
            });
            return;
          }
          console.log('iOS Share API failed:', err);
        }
      }
      
      // iOS fallback - copy to clipboard
      try {
        await navigator.clipboard.writeText(fullShareText);
        addToast({ 
          type: 'success', 
          title: 'Copied for iOS!', 
          message: 'Event details copied! Open any iOS app and paste to share.' 
        });
        return;
      } catch (err) {
        console.log('iOS clipboard failed:', err);
      }
    }

    // Android Quick Share - Native Android Share Menu
    if (isAndroid) {
      // Try Android intent for native share menu
      try {
        // Use ACTION_CHOOSER to force Android system dialog
        const chooserIntent = `intent://send#Intent;action=android.intent.action.CHOOSER;S.android.intent.extra.TITLE=Share Event;S.android.intent.extra.INTENT=android.intent.action.SEND|text/plain|S.android.intent.extra.TEXT=${encodeURIComponent(fullShareText)};end`;
        
        window.location.href = chooserIntent;
        
        addToast({ 
          type: 'success', 
          title: 'Android Share Menu Opened!', 
          message: 'Opening native Android share options...' 
        });
        
        return;
        
      } catch (err) {
        console.log('Android intent failed, trying Web Share API:', err);
      }
      
      // Android fallback - Web Share API
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          addToast({ 
            type: 'success', 
            title: 'Android Share Success!', 
            message: 'Event shared via Android native sharing.' 
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            addToast({ 
              type: 'info', 
              title: 'Share Cancelled', 
              message: 'Android sharing was cancelled.' 
            });
            return;
          }
          console.log('Android Web Share API failed:', err);
        }
      }
    }

    // Desktop/Other devices - Standard Web Share API
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        addToast({ 
          type: 'success', 
          title: 'Shared Successfully!', 
          message: 'Event shared via your device\'s share menu.' 
        });
        return;
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.log('Web Share API failed:', err);
        }
      }
    }

    // Final fallback - Clipboard copy for all platforms
    try {
      await navigator.clipboard.writeText(fullShareText);
      addToast({ 
        type: 'success', 
        title: 'Link Copied!', 
        message: 'Event details copied to clipboard. You can now paste and share!' 
      });
    } catch (err) {
      console.log('Clipboard failed, trying legacy method:', err);
      
      // Legacy clipboard fallback
      try {
        const textArea = document.createElement('textarea');
        textArea.value = fullShareText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          addToast({ 
            type: 'success', 
            title: 'Link Copied!', 
            message: 'Event details copied to clipboard!' 
          });
        } else {
          throw new Error('Copy failed');
        }
      } catch (_finalErr) {
        addToast({ 
          type: 'error', 
          title: 'Share Failed', 
          message: 'Unable to share. Please copy the link manually from address bar.' 
        });
      }
    }
  };

  // Platform-specific share methods
  const shareViaWhatsApp = () => {
    const event = events.find(e => e.id === id || e._id === id);
    if (!event) return;
    
    const text = `🎉 *${event.title}*\n\n📅 Date: ${format(new Date(event.date), 'PPP')}\n⏰ Time: ${event.time}\n📍 Venue: ${event.venue}\n\nJoin us for this exciting event!\n\n${window.location.href}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
    
    addToast({ 
      type: 'success', 
      title: 'Opening WhatsApp', 
      message: 'Event details prepared for WhatsApp sharing!' 
    });
  };

  const shareViaEmail = () => {
    const event = events.find(e => e.id === id || e._id === id);
    if (!event) return;
    
    const subject = `Check out this event: ${event.title}`;
    const body = `Hi!\n\nI wanted to share this exciting event with you:\n\n🎉 Event: ${event.title}\n📅 Date: ${format(new Date(event.date), 'PPP')}\n⏰ Time: ${event.time}\n📍 Venue: ${event.venue}\n\n${event.description}\n\nYou can register and get more details here:\n${window.location.href}\n\nHope to see you there!\n\nBest regards`;
    
    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = emailUrl;
    
    addToast({ 
      type: 'success', 
      title: 'Opening Email', 
      message: 'Event details prepared for email sharing!' 
    });
  };

  const copyEventLink = async () => {
    const url = window.location.href;
    
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        addToast({ 
          type: 'success', 
          title: 'Link Copied!', 
          message: 'Event link copied to clipboard!' 
        });
        return;
      } catch (err) {
        console.log('Clipboard API failed:', err);
      }
    }
    
    // Fallback method
    try {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        addToast({ 
          type: 'success', 
          title: 'Link Copied!', 
          message: 'Event link copied to clipboard!' 
        });
      } else {
        throw new Error('Copy failed');
      }
    } catch (err) {
      addToast({ 
        type: 'error', 
        title: 'Copy Failed', 
        message: 'Unable to copy link. Please copy manually from address bar.' 
      });
    }
  };

  const openNativeShareMenu = async () => {
    const event = events.find(e => e.id === id || e._id === id);
    if (!event) return;

    const shareData = {
      title: event.title,
      text: `🎉 ${event.title}\n📅 ${format(new Date(event.date), 'PPP')} at ${event.time}\n📍 ${event.venue}\n\nJoin us for this exciting event!`,
      url: window.location.href
    };

    const fullShareText = `${shareData.text}\n\n${shareData.url}`;

    // Detect different mobile platforms
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = /Mobi|Android|iPad|iPhone|iPod/i.test(navigator.userAgent);
    
    console.log('Platform detection - Android:', isAndroid, 'iOS:', isIOS, 'Mobile:', isMobile);

    // iOS-specific sharing methods
    if (isIOS) {
      console.log('Attempting iOS-specific sharing methods...');
      
      // Method 1: Try Web Share API first (works well on iOS)
      if (navigator.share) {
        try {
          console.log('Trying iOS Web Share API...');
          await navigator.share(shareData);
          addToast({ 
            type: 'success', 
            title: 'Shared Successfully', 
            message: 'Event shared via iOS share sheet!' 
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            addToast({ 
              type: 'info', 
              title: 'Share Cancelled', 
              message: 'Sharing was cancelled.' 
            });
            return;
          }
          console.log('iOS Web Share API failed:', err);
        }
      }

      // Method 2: Try iOS-specific URL schemes
      try {
        // WhatsApp URL scheme for iOS
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(fullShareText)}`;
        
        // Create a temporary link to test if WhatsApp is installed
        const tempLink = document.createElement('a');
        tempLink.href = whatsappUrl;
        tempLink.click();
        
        addToast({ 
          type: 'success', 
          title: 'Opening WhatsApp', 
          message: 'Opening WhatsApp for sharing...' 
        });
        
        return;
        
      } catch (err) {
        console.log('iOS WhatsApp URL scheme failed:', err);
      }

      // Method 3: Try SMS URL scheme for iOS
      try {
        const smsUrl = `sms:&body=${encodeURIComponent(fullShareText)}`;
        window.location.href = smsUrl;
        
        addToast({ 
          type: 'success', 
          title: 'Opening Messages', 
          message: 'Opening iOS Messages app...' 
        });
        
        return;
        
      } catch (err) {
        console.log('iOS SMS URL scheme failed:', err);
      }

      // Method 4: Try mailto for iOS
      try {
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(`Event: ${shareData.title}`)}&body=${encodeURIComponent(fullShareText)}`;
        window.location.href = mailtoUrl;
        
        addToast({ 
          type: 'success', 
          title: 'Opening Mail', 
          message: 'Opening iOS Mail app...' 
        });
        
        return;
        
      } catch (err) {
        console.log('iOS mailto failed:', err);
      }
    }

    // Android-specific methods for native sharing (try first for Android)
    if (isAndroid && isMobile) {
      console.log('Attempting Android-specific sharing methods...');
      
      // Method 1: Force Android Chooser - this bypasses any default app selection
      try {
        // Use ACTION_CHOOSER to force the system dialog
        const chooserIntent = `intent://send#Intent;action=android.intent.action.CHOOSER;S.android.intent.extra.TITLE=Share Event;S.android.intent.extra.INTENT=android.intent.action.SEND|text/plain|S.android.intent.extra.TEXT=${encodeURIComponent(fullShareText)};end`;
        
        window.location.href = chooserIntent;
        
        addToast({ 
          type: 'success', 
          title: 'Opening System Chooser', 
          message: 'Opening Android app chooser...' 
        });
        
        return;
        
      } catch (err) {
        console.log('Chooser Intent method failed:', err);
      }

      // Method 2: Try standard share intent without specific app targeting
      try {
        // Simple share intent that should trigger system dialog
        const shareIntent = `intent:${encodeURIComponent(fullShareText)}#Intent;action=android.intent.action.SEND;type=text/plain;end`;
        
        window.location.href = shareIntent;
        
        addToast({ 
          type: 'success', 
          title: 'Opening Share Dialog', 
          message: 'Opening Android share options...' 
        });
        
        return;
        
      } catch (err) {
        console.log('Share Intent method failed:', err);
      }

      // Method 3: Try mailto to trigger Android app chooser
      try {
        // This often triggers Android's native chooser for communication apps
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(`Event: ${shareData.title}`)}&body=${encodeURIComponent(fullShareText)}`;
        
        window.location.href = mailtoUrl;
        
        addToast({ 
          type: 'success', 
          title: 'Opening App Chooser', 
          message: 'Opening Android communication apps...' 
        });
        
        return;
        
      } catch (err) {
        console.log('Mailto method failed:', err);
      }
    }

    // Fallback to Web Share API for other devices
    if (navigator.share) {
      try {
        console.log('Trying Web Share API...');
        await navigator.share(shareData);
        addToast({ 
          type: 'success', 
          title: 'Shared Successfully', 
          message: 'Event shared successfully!' 
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          addToast({ 
            type: 'info', 
            title: 'Share Cancelled', 
            message: 'Sharing was cancelled.' 
          });
          return;
        }
        console.log('Web Share API failed:', err);
      }
    }

    // Final fallback - copy to clipboard
    try {
      await navigator.clipboard.writeText(fullShareText);
      addToast({ 
        type: 'success', 
        title: 'Copied to Clipboard', 
        message: 'Event details copied! You can paste and share manually.' 
      });
    } catch (err) {
      addToast({ 
        type: 'error', 
        title: 'Share Failed', 
        message: 'Unable to share or copy. Please share the link manually.' 
      });
    }
  };

  // ...existing code...

  // event is already declared earlier (near userId/userRole) to avoid TDZ issues
  
  // Ensure registrations is an array before using array methods
  const safeRegistrations = Array.isArray(registrations) ? registrations : [];
  
  const isRegistered = safeRegistrations.some(r => {
    const regUserId = typeof r.userId === 'string' ? r.userId : (r.userId as UserType)?._id || (r.userId as UserType)?.id;
    return (
      (r.eventId === id || 
       (event && r.eventId === event.id) || 
       (event && r.eventId === event._id)) &&
      (regUserId === userId ||
        (typeof regUserId === 'object' && ((regUserId as UserType)._id === userId || (regUserId as UserType).id === userId)))
    );
  });
  // Robustly find the user's registration for this event
  const userRegistration = safeRegistrations.find(r => {
    // Handle userId as string or object
    const regUserId = typeof r.userId === 'string' ? r.userId : (r.userId as UserType)?._id || (r.userId as UserType)?.id;
    const matchesUser = regUserId === userId ||
      (typeof regUserId === 'object' && ((regUserId as UserType)._id === userId || (regUserId as UserType).id === userId));
    // Handle eventId as string or object
    const regEventId = typeof r.eventId === 'string' ? r.eventId : String(r.eventId);
    const matchesEvent = regEventId === id || 
      (event && regEventId === event.id) || 
      (event && regEventId === event._id);
    return matchesUser && matchesEvent;
  });

  // Get all registrations for this event
  const eventRegistrations = safeRegistrations.filter(r => {
    const regEventId = typeof r.eventId === 'string' ? r.eventId : String(r.eventId);
    return regEventId === id || 
      (event && regEventId === event.id) || 
      (event && regEventId === event._id);
  });

  // Fetch team mappings for all users in this event
  const fetchUserTeamMappings = useCallback(async () => {
    if (!id) return;
    
    // Find event inside callback to avoid initialization issues
    const currentEvent = events.find(e => e.id === id || e._id === id);
    if (!currentEvent?.isTeamEvent) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${id}/teams`);
      
      if (response.ok) {
        const data = await response.json();
        const teams = data.teams || [];
        
        // Build a map of userId -> team info
        const mapping: Record<string, { teamName: string; teamId: string; role: string; status: string }> = {};
        
        for (const team of teams) {
          // Also add the leader to the mapping
          const leaderId = team.leaderId?._id || team.leaderId?.id || team.leaderId;
          if (leaderId) {
            mapping[leaderId] = {
              teamName: team.name,
              teamId: team._id,
              role: 'leader',
              status: team.status
            };
          }
          
          // Add all team members (members don't have a status field - they are in the team if they exist in the array)
          for (const member of team.members || []) {
            const memberId = member.userId?._id || member.userId?.id || member.userId;
            if (memberId) {
              mapping[memberId] = {
                teamName: team.name,
                teamId: team._id,
                role: member.role || 'member',
                status: team.status
              };
            }
          }
        }
        
        setUserTeamMap(mapping);
      }
    } catch (error) {
      console.error('Error fetching user team mappings:', error);
    }
  }, [id, events]);

  // Fetch user teams when event is loaded
  useEffect(() => {
    if (event?.isTeamEvent) {
      fetchUserTeamMappings();
    }
  }, [event?.isTeamEvent, fetchUserTeamMappings]);

  // Department options with CSE first
  const departmentOptions = useMemo(() => {
    // Departments available in registration page with Computer Science (CSE) first
    const availableDepts = [
      'CSE',      // CSE equivalent
      'IT',
      'AI & DS',              // Artificial Intelligence & Data Science
      'AI & ML',              // Artificial Intelligence & Machine Learning
      'ECE',
      'EEE',                  // Electrical & Electronics Engineering
      'Mechanical',
      'Civil',
      'Others',
    ];
    
    // Get departments from registered students
    const registeredDepts = eventRegistrations.length > 0 
      ? [...new Set(eventRegistrations.map(r => r.user.department).filter(Boolean))]
      : [];
    
    // Combine available departments with any additional departments from registrations
    const allDepts = [...availableDepts];
    registeredDepts.forEach(dept => {
      if (dept && !allDepts.includes(dept)) {
        allDepts.push(dept);
      }
    });
    
    return allDepts;
  }, [eventRegistrations]);

  // Filtered and sorted participants (Attendees list shows only approved registrations)
  const filteredAndSortedParticipants = useMemo(() => {
    if (!eventRegistrations.length) return [];
    
    // Show only approved attendees
    let filtered = eventRegistrations.filter(r => r.approvalStatus === 'approved');
    
    // Apply department filter
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(r => r.user.department === filterDepartment);
    }
    
    // Apply search filter (case-insensitive, comprehensive search)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(r => {
        const user = r.user;
        
        // Search through multiple fields
        const searchableFields = [
          user.name || '',
          user.email || '',
          user.regId || '',
          user.department || '',
          user.section || '',
          user.roomNo || '',
          user.year?.toString() || '',
          user.mobile || '',
          // Also search in registration date
          new Date(r.registeredAt).toLocaleDateString() || '',
          // Status
          r.status || ''
        ];
        
        // Check if any field contains the search term
        return searchableFields.some(field => 
          field.toLowerCase().includes(searchLower)
        );
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'regId': {
          const regIdA = a.user.regId || '';
          const regIdB = b.user.regId || '';
          // Custom sorting: prioritize numbers over letters
          // Split by character type to compare segment by segment
          const compareRegIds = (id1: string, id2: string): number => {
            const len = Math.max(id1.length, id2.length);
            for (let i = 0; i < len; i++) {
              const char1 = id1[i] || '';
              const char2 = id2[i] || '';
              
              const isDigit1 = /\d/.test(char1);
              const isDigit2 = /\d/.test(char2);
              
              // If one is digit and other is not, digit comes first
              if (isDigit1 && !isDigit2) return -1;
              if (!isDigit1 && isDigit2) return 1;
              
              // Both are same type, compare normally
              if (char1 !== char2) {
                return char1.localeCompare(char2, undefined, { numeric: true });
              }
            }
            return 0;
          };
          comparison = compareRegIds(regIdA.toLowerCase(), regIdB.toLowerCase());
          break;
        }
        case 'name':
          comparison = a.user.name.localeCompare(b.user.name);
          break;
        case 'department': {
          const deptA = a.user.department || '';
          const deptB = b.user.department || '';
          comparison = deptA.localeCompare(deptB);
          break;
        }
        case 'year': {
          const yearA = a.user.year || 0;
          const yearB = b.user.year || 0;
          comparison = yearA - yearB;
          break;
        }
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  }, [eventRegistrations, filterDepartment, searchTerm, sortBy, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedParticipants.length / studentsPerPage);
  const paginatedParticipants = useMemo(() => {
    const startIndex = (currentPage - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    return filteredAndSortedParticipants.slice(startIndex, endIndex);
  }, [filteredAndSortedParticipants, currentPage, studentsPerPage]);

  // Compute displayed participants with a robust fallback:
  // - Prefer backend `event.currentParticipants` when available
  // - Use approved registrations count from front-end as fallback
  // NOTE: Moved here (before early returns) to satisfy React's Rules of Hooks
  const displayedParticipants = useMemo(() => {
    if (!event) return 0;
    const backendCount = typeof (event.currentParticipants) === 'number' ? event.currentParticipants : 0;
    const approvedCount = eventRegistrations.filter(r => r.approvalStatus === 'approved').length;
    // Use the maximum of backend count or approved count to avoid under-reporting
    return Math.max(backendCount || 0, approvedCount);
  }, [event, eventRegistrations]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDepartment, sortBy, sortOrder]);

  // Excel export function
  const exportToExcel = async () => {
    if (!filteredAndSortedParticipants.length) {
      addToast({
        type: 'error',
        title: 'No Data',
        message: 'No participants to export',
      });
      return;
    }

    try {
      const participantsForExport = filteredAndSortedParticipants.map(p => ({
        user: p.user,
        registeredAt: p.registeredAt instanceof Date ? p.registeredAt.toISOString() : String(p.registeredAt),
        status: p.status,
        approvalType: p.approvalType || undefined
      }));
      await exportParticipantsToExcel(participantsForExport, event?.title || 'Event');
      
      addToast({
        type: 'success',
        title: 'Export Successful',
        message: `Downloaded ${filteredAndSortedParticipants.length} participants`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export participants to Excel',
      });
    }
  };

  // Access control check (mirror of backend rules) — defined before any early returns to satisfy hooks rules
  const hasAccess = useMemo(() => {
    const ac = event?.accessControl || { type: 'everyone' as const };
    // Events open to everyone are viewable by anyone (including non-logged-in users)
    if (!ac?.type || ac.type === 'everyone') return true;
    // For restricted events, user must be logged in
    if (!user) return false;
    if (ac.type === 'students_only') return user.role === 'student';
    if (ac.type === 'faculty_only') return user.role === 'faculty';
    if (ac.type === 'custom') {
      // Allowed roles
      if (Array.isArray(ac.allowedRoles) && ac.allowedRoles.length > 0 && !ac.allowedRoles.includes(user.role)) {
        return false;
      }
      // Allowed departments
      if (Array.isArray(ac.allowedDepartments) && ac.allowedDepartments.length > 0 && user.department && !ac.allowedDepartments.includes(user.department)) {
        return false;
      }
      // Allowed years (students only)
      if (user.role === 'student' && Array.isArray(ac.allowedYears) && ac.allowedYears.length > 0 && user.year && !ac.allowedYears.includes(user.year)) {
        return false;
      }
    }
    return true;
  }, [event, user]);

  const failingReasons = useMemo(() => {
    const reasons: string[] = [];
    const ac = event?.accessControl || { type: 'everyone' as const };
    if (!user) {
      if (ac.type && ac.type !== 'everyone') reasons.push('Login required');
      return reasons;
    }
    if (!ac?.type || ac.type === 'everyone') return reasons;
    if (ac.type === 'students_only' && user.role !== 'student') reasons.push('Only students can access this event');
    if (ac.type === 'faculty_only' && user.role !== 'faculty') reasons.push('Only faculty can access this event');
    if (ac.type === 'custom') {
      if (Array.isArray(ac.allowedRoles) && ac.allowedRoles.length > 0 && !ac.allowedRoles.includes(user.role)) reasons.push(`Required role: ${ac.allowedRoles.join(', ')}`);
      if (Array.isArray(ac.allowedDepartments) && ac.allowedDepartments.length > 0 && user.department && !ac.allowedDepartments.includes(user.department)) reasons.push(`Allowed departments: ${ac.allowedDepartments.join(', ')}`);
      if (user.role === 'student' && Array.isArray(ac.allowedYears) && ac.allowedYears.length > 0 && user.year && !ac.allowedYears.includes(user.year)) reasons.push(`Allowed years: ${ac.allowedYears.join(', ')}`);
    }
    return reasons;
  }, [event, user]);

  // isPrivileged is already declared earlier (near event) to avoid TDZ issues

  // Fetch winners/spot registrations for completed events - must be before early returns
  useEffect(() => {
    if (event) {
      if (event.status === 'completed') {
        fetchWinners();
      }
      if (canView && event.status === 'completed') {
        fetchSpotRegistrations();
        fetchEligibleWinners();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.status, canView]);

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h2>
          <p className="text-gray-600 mb-4">The event you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/events')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  // Fix registration deadline check
  const currentDate = new Date();
  const deadlineDate = new Date(event.registrationDeadline);
  // Debug logs removed - were causing console spam on every render
  const deadlinePassed = currentDate > deadlineDate;
  const isRegistrationOpen = !deadlinePassed && event.status === 'upcoming';

  const isFull = displayedParticipants >= (event.maxParticipants || 0);

  interface AccessControlData {
    type?: 'everyone' | 'students_only' | 'faculty_only' | 'custom';
    allowedRoles?: string[];
    allowedDepartments?: string[];
    allowedYears?: number[];
  }

  const buildRequirementText = (ac: AccessControlData) => {
    if (!ac?.type || ac.type === 'everyone') return 'Open to everyone';
    if (ac.type === 'students_only') return 'Students only';
    if (ac.type === 'faculty_only') return 'Faculty only';
    if (ac.type === 'custom') {
      const parts: string[] = [];
      if (Array.isArray(ac.allowedRoles) && ac.allowedRoles.length > 0) parts.push(`Roles: ${ac.allowedRoles.join(', ')}`);
      if (Array.isArray(ac.allowedDepartments) && ac.allowedDepartments.length > 0) parts.push(`Departments: ${ac.allowedDepartments.join(', ')}`);
      if (Array.isArray(ac.allowedYears) && ac.allowedYears.length > 0) parts.push(`Years: ${ac.allowedYears.join(', ')}`);
      return parts.length ? parts.join(' • ') : 'Custom access';
    }
    return 'Restricted access';
  };


  // Access control - everyone can VIEW, but only eligible users can REGISTER
  // No page blocking - just show registration restrictions
  const ac = event?.accessControl || { type: 'everyone' as const };

  // Fetch sub-event count before showing confirmation
  const openCompleteConfirmation = async () => {
    if (!event) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id || event._id}/sub-events`);
      if (response.ok) {
        const data = await response.json();
        const activeSubEvents = (data.subEvents || []).filter(
          (se: { status: string }) => se.status !== 'completed' && se.status !== 'cancelled'
        );
        setSubEventCount(activeSubEvents.length);
      }
    } catch (error) {
      console.error('Error fetching sub-events count:', error);
      setSubEventCount(0);
    }
    setShowCompleteConfirm(true);
  };

  const handleCompleteEvent = async () => {
    if (!user || !event) return;
    
    setShowCompleteConfirm(false);
    setCompletingEvent(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id || event._id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id || user.id, endSubEvents: true })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const subEventsMsg = data.subEventsEnded > 0 
          ? ` (${data.subEventsEnded} sub-event${data.subEventsEnded > 1 ? 's' : ''} also completed)`
          : '';
        addToast({
          type: 'success',
          title: 'Event Completed',
          message: `${event.title} has been marked as completed${subEventsMsg}.`
        });
        window.dispatchEvent(new Event('forceRefresh'));
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Complete Event',
          message: data.error || 'An error occurred'
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to complete event'
      });
    } finally {
      setCompletingEvent(false);
    }
  };

  const fetchWinners = async () => {
    if (!event) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id || event._id}/winners`);
      const data = await response.json();
      if (response.ok) {
        setWinners(data.winners || []);
      }
    } catch (error) {
      console.error('Error fetching winners:', error);
    }
  };

  const fetchEligibleWinners = async () => {
    if (!event || event.status !== 'completed') return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id || event._id}/eligible-winners`);
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
    if (!event) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id || event._id}/spot-registrations`);
      const data = await response.json();
      if (response.ok) {
        setSpotRegistrations(data.spotRegistrations || []);
      }
    } catch (error) {
      console.error('Error fetching spot registrations:', error);
    }
  };

  const handleAddSpotRegistration = async () => {
    if (!user || !event || !spotRegName.trim()) return;
    
    setAddingSpotReg(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id || event._id}/spot-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id || user.id,
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
    if (!user || !event || !selectedParticipantId) return;
    
    setAddingWinner(true);
    try {
      interface WinnerRequestBody {
        userId: string;
        position: number;
        participantType: string;
        participantUserId?: string;
        spotRegistrationId?: string;
      }
      
      const body: WinnerRequestBody = {
        userId: user._id || user.id || '',
        position: selectedWinnerPosition,
        participantType: selectedParticipantType
      };
      
      if (selectedParticipantType === 'registered') {
        body.participantUserId = selectedParticipantId;
      } else {
        body.spotRegistrationId = selectedParticipantId;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id || event._id}/winners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (!user || !event) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${event.id || event._id}/winners/${winnerId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id || user.id })
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
    if (!user) {
      navigate('/login');
      return;
    }

    // Proactive guard to avoid 403 from backend when user isn't eligible
    if (!hasAccess) {
      addToast({
        type: 'warning',
        title: 'Not eligible to register',
        message: 'Your account does not meet this event’s access requirements.',
      });
      return;
    }

    const result = await registerForEvent(event.id);
    if (result.ok) {
      // Refresh pending count for organizers/admins
      fetchPendingCount();
      
      if (result.pending) {
        addToast({
          type: 'info',
          title: deadlinePassed ? 'Late Registration Pending' : 'Registration Pending Approval',
          message: result.message || (deadlinePassed
            ? `Deadline passed. Your request for ${event.title} is awaiting organizer approval.`
            : `Your registration for ${event.title} is awaiting approval.`),
        });
      } else {
        addToast({
          type: 'success',
          title: 'Registration Successful!',
          message: result.message || `You've been registered for ${event.title}`,
        });
      }
    } else if (result.already) {
      addToast({
        type: 'warning',
        title: 'Already Registered',
        message: result.message || 'You are already registered for this event.',
      });
    } else {
      addToast({
        type: 'error',
        title: 'Registration Failed',
        message: result.message || 'Please try again later.',
      });
    }
  };

  const handleUnregister = async () => {
    const success = await unregisterFromEvent(event.id);
    if (success) {
      addToast({
        type: 'success',
        title: 'Unregistered Successfully',
        message: `You've been unregistered from ${event.title}`,
      });
    } else {
      addToast({
        type: 'error',
        title: 'Unregistration Failed',
        message: 'Please try again later.',
      });
    }
  };

  // Waitlist action handlers (join/leave)
  const handleJoinWaitlist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setWaitlistLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${id}/waitlist/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setWaitlistStatus({
          onWaitlist: true,
          position: data.position
        });
        addToast({
          type: 'success',
          title: 'Added to Waitlist!',
          message: `You're #${data.position} on the waitlist. You'll be notified if a spot opens up.`,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Join Waitlist',
          message: data.error || 'Please try again later.',
        });
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to join waitlist. Please try again.',
      });
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    setWaitlistLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${id}/waitlist/leave`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setWaitlistStatus({
          onWaitlist: false,
          position: null
        });
        addToast({
          type: 'success',
          title: 'Left Waitlist',
          message: 'You have been removed from the waitlist.',
        });
      } else {
        const data = await response.json();
        addToast({
          type: 'error',
          title: 'Failed to Leave Waitlist',
          message: data.error || 'Please try again later.',
        });
      }
    } catch (error) {
      console.error('Error leaving waitlist:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to leave waitlist. Please try again.',
      });
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleRemoveParticipant = (userId: string, userName: string) => {
    if (!user || !event) return;
    setConfirmRemoveParticipant({ userId, userName });
  };
  
  const confirmRemoveParticipantAction = async () => {
    if (!confirmRemoveParticipant || !event) return;
    
    const { userId, userName } = confirmRemoveParticipant;
    const success = await removeParticipant(event.id, userId);
    if (success) {
      addToast({ 
        type: 'success', 
        title: 'Participant Removed', 
        message: `${userName} has been removed from the event.` 
      });
    } else {
      addToast({ 
        type: 'error', 
        title: 'Error', 
        message: 'Failed to remove participant. Please try again.' 
      });
    }
    setConfirmRemoveParticipant(null);
  };

  // Admin announcement handler
  const handleSendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      addToast({
        type: 'error',
        title: 'Missing Information',
        message: 'Please provide both title and message for the announcement.',
      });
      return;
    }

    setAnnouncementLoading(true);
    try {
      // Backend expects POST /api/events/:eventId/announce (see server routes)
      const response = await fetch(`${API_BASE_URL}/api/events/${id}/announce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: announcementTitle,
          message: announcementMessage,
          priority: announcementPriority,
          senderId: userId
        })
      });

      // Parse response only if it's JSON, otherwise capture text for diagnostics
      interface AnnouncementResponse {
        sent?: number;
        notificationsSent?: number;
        error?: string;
      }
      let data: AnnouncementResponse = {};
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn('Non-JSON response when sending announcement:', text);
        data = { error: text };
      }

      if (response.ok) {
        const sentCount = data.sent ?? data.notificationsSent ?? 0;
        addToast({
          type: 'success',
          title: 'Announcement Sent!',
          message: `Announcement sent to ${sentCount} participants.`,
        });
        setShowAnnouncementModal(false);
        setAnnouncementTitle('');
        setAnnouncementMessage('');
        setAnnouncementPriority('normal');
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Send',
          message: data.error || 'Could not send announcement.',
        });
      }
    } catch (error) {
      console.error('Error sending announcement:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to send announcement. Please try again.',
      });
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    // Check if event has a gallery first
    setCheckingGallery(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/gallery/${id}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.gallery) {
          setEventGallery({
            published: data.gallery.published,
            mediaCount: data.media?.length || 0
          });
        }
      }
    } catch (err) {
      // No gallery found, that's okay
      setEventGallery(null);
    } finally {
      setCheckingGallery(false);
      setConfirmDeleteEvent(true);
    }
  };
  
  const confirmDeleteEventAction = async () => {
    try {
      const success = await deleteEvent(event.id);
      if (success) {
        addToast({
          type: 'success',
          title: 'Event Deleted',
          message: 'The event has been deleted successfully.',
        });
        // Small delay to ensure state propagates before navigation
        setTimeout(() => {
          navigate('/events', { replace: true });
        }, 150);
      } else {
        addToast({
          type: 'error',
          title: 'Delete Failed',
          message: 'Could not delete the event. Please try again.',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not delete the event. Please try again.',
      });
    }
    setConfirmDeleteEvent(false);
    setEventGallery(null);
  };

  const handleEditEvent = () => {
    navigate(`/events/${id}/edit`);
  };

  // Use shared category utils to keep display consistent across the app
  // Note: event may include a customCategory field when category is a custom string
  // We import helpers at top of file

  return (
    <motion.div 
      className="min-h-screen pt-16 xs:pt-18 sm:pt-20 lg:pt-24 pb-8 w-full overflow-x-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="max-w-6xl mx-auto px-3 xs:px-4 sm:px-4 md:px-6 lg:px-8 xl:px-10">
        {/* Back Button */}
        <motion.button
          onClick={() => navigate('/events')}
          className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 mb-4 xs:mb-5 sm:mb-6 transition-colors text-xs xs:text-sm sm:text-base"
          whileHover={{ x: -5 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5" />
          <span>Back to Events</span>
        </motion.button>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Event Image */}
          {event.image && (
            <div className="relative">
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-auto object-contain max-h-[500px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
              <div className="absolute bottom-3 xs:bottom-4 sm:bottom-6 left-3 xs:left-4 sm:left-6 right-3 xs:right-4 sm:right-6">
                <div className="flex flex-wrap items-center gap-2 xs:gap-2 sm:gap-3 mb-2 xs:mb-2 sm:mb-3">
                  <span className={`px-2 xs:px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getCategoryColor(event.category)}`}>
                    {displayCategoryLabel(event.category)}
                  </span>
                  <span className="px-2 xs:px-2 sm:px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs sm:text-sm font-medium">
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </span>
                </div>
                <h1 className="text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">
                  {event.title}
                </h1>
              </div>
            </div>
          )}

            <div className="p-3 xs:p-4 sm:p-6 lg:p-8 xl:p-10">
              {/* Always show event date, time, and registration deadline at the top */}
              <div className="flex flex-wrap gap-2 xs:gap-2 sm:gap-3 lg:gap-4 mb-4 xs:mb-5 sm:mb-6">
                <div className="flex items-center text-gray-600 text-xs xs:text-sm sm:text-base">
                  <Calendar className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 mr-2 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{format(new Date(event.date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex items-center text-gray-600 text-xs xs:text-sm sm:text-base">
                  <Clock className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 mr-2 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{event.time}</span>
                </div>
                <div className="flex items-center text-gray-600 text-xs xs:text-sm sm:text-base">
                  <Calendar className="w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 mr-2 text-yellow-500 flex-shrink-0" />
                  <span className="truncate">Reg. Deadline: {event.registrationDeadline ? format(new Date(event.registrationDeadline), 'MMM dd, yyyy hh:mm a') : '-'}</span>
                </div>
              </div>
            {/* Event Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xs:gap-5 sm:gap-6 lg:gap-8 mb-6 xs:mb-7 sm:mb-8">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Event Details</h2>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center text-gray-600 text-sm sm:text-base">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-blue-500 flex-shrink-0" />
                    <span className="break-words">{format(event.date, 'EEEE, MMMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center text-gray-600 text-sm sm:text-base">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-blue-500 flex-shrink-0" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center text-gray-600 text-sm sm:text-base">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-blue-500 flex-shrink-0" />
                    <span className="break-words">{event.venue}</span>
                  </div>
                  <div className="flex items-center text-gray-600 text-sm sm:text-base">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-blue-500 flex-shrink-0" />
                    <span>{displayedParticipants} / {event.maxParticipants} participants</span>
                  </div>
                  {event.isTeamEvent && (
                    <div className="flex items-center text-gray-600 text-sm sm:text-base">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-purple-500 flex-shrink-0" />
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-purple-700">Team Event</span>
                        <span className="text-gray-400">•</span>
                        <span>{event.minTeamSize || 2} - {event.maxTeamSize || 4} members per team</span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center text-gray-600 text-sm sm:text-base">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-blue-500 flex-shrink-0" />
                    <span className="break-words">
                      Organized by{' '}
                      <span className="font-medium">
                        {event.organizer?.name || 'Unknown'}
                      </span>
                      {event.organizer?.department && (
                        <>
                          <span className="text-gray-400 mx-1">•</span>
                          <span className="text-gray-500">{event.organizer.department}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Registration Deadline */}
                <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg ${
                  event.status === 'completed'
                    ? 'bg-green-50 border-2 border-green-300' 
                    : (() => {
                        const now = new Date();
                        const evtDate = new Date(event.date);
                        let endDT = new Date(evtDate);
                        if ((event as any).endTime) {
                          const [h, m] = (event as any).endTime.split(':').map(Number);
                          endDT.setHours(h || 23, m || 59, 59, 999);
                        } else if (event.time) {
                          const [h, m] = event.time.split(':').map(Number);
                          endDT.setHours((h || 0) + 3, m || 0, 0, 0);
                        } else {
                          endDT.setHours(23, 59, 59, 999);
                        }
                        return now > endDT;
                      })()
                    ? 'bg-gray-50 border border-gray-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  {event.status === 'completed' ? (
                    <>
                      <p className="text-sm sm:text-base text-green-800 font-bold flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Event Completed
                      </p>
                      <p className="text-xs sm:text-sm text-green-700 mt-2">
                        This event has ended • Event date: {format(new Date(event.date), 'MMM dd, yyyy')}
                      </p>
                    </>
                  ) : (() => {
                      const now = new Date();
                      const evtDate = new Date(event.date);
                      let endDT = new Date(evtDate);
                      if ((event as any).endTime) {
                        const [h, m] = (event as any).endTime.split(':').map(Number);
                        endDT.setHours(h || 23, m || 59, 59, 999);
                      } else if (event.time) {
                        const [h, m] = event.time.split(':').map(Number);
                        endDT.setHours((h || 0) + 3, m || 0, 0, 0);
                      } else {
                        endDT.setHours(23, 59, 59, 999);
                      }
                      return now > endDT;
                    })() ? (
                    <>
                      <p className="text-xs sm:text-sm text-gray-700 font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-gray-600" />
                        Event Ended
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        This event has ended • Event date: {format(new Date(event.date), 'MMM dd, yyyy')}
                        {isPrivileged && ' • Click "Mark as Completed" to finalize'}
                        {canView && !isPrivileged && ' • Event ended'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm text-yellow-800">
                        <strong>Registration Deadline:</strong> {format(deadlineDate, 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-gray-600 mt-2">
                        Registration is {isRegistrationOpen ? 'open' : 'closed'} • Current date: {format(currentDate, 'MMM dd, yyyy')}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Description</h2>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  {event.description}
                </p>

                {/* Requirements */}
                {event.requirements && event.requirements.length > 0 && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Requirements</h3>
                    <ul className="space-y-2">
                      {event.requirements.map((req, index) => (
                        <li key={index} className="flex items-start text-gray-600 text-sm sm:text-base">
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="break-words">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prizes */}
                {event.prizes && event.prizes.length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Prizes</h3>
                    <div className="flex items-start text-gray-600 text-sm sm:text-base">
                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{event.prizes.join(', ')}</span>
                    </div>
                  </div>
                )}

                {/* Winners Display - for completed events */}
                {event.status === 'completed' && winners.length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      Winners
                    </h3>
                    <div className="space-y-2">
                      {winners.map((winner) => (
                        <div key={winner._id} className="flex items-center gap-3 p-2 bg-yellow-50 rounded-lg">
                          <span className="w-8 h-8 rounded-full bg-yellow-200 flex items-center justify-center font-bold text-yellow-800 text-sm">
                            #{winner.position}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{winner.participantName}</p>
                            {winner.prize && <p className="text-sm text-gray-600">{winner.prize}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Registration Progress */}
            <div className="mb-6 sm:mb-8">
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-2">
                <span>Registration Progress</span>
                <span>{displayedParticipants} / {event.maxParticipants}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 sm:h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((displayedParticipants / event.maxParticipants) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Gallery Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Link
                to={`/gallery/${id}`}
                className="flex-1 px-4 sm:px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium flex items-center justify-center space-x-2 text-sm sm:text-base shadow-lg"
              >
                <Images className="w-5 h-5" />
                <span>View Gallery</span>
              </Link>
              {canView && (
                <Link
                  to={`/dashboard/gallery/${id}`}
                  className="flex-1 px-4 sm:px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium flex items-center justify-center space-x-2 text-sm sm:text-base shadow-lg"
                >
                  <Images className="w-5 h-5" />
                  <span>Manage Gallery</span>
                </Link>
              )}
            </div>

            {/* Team Invitations Card */}
            {event.isTeamEvent && teamInvitations.length > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900">Team Invitations</h3>
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                    {teamInvitations.length}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {teamInvitations.map((invitation) => (
                    <motion.div
                      key={invitation._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm"
                    >
                      {/* Team Name & Leader */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            {invitation.teamName}
                          </h4>
                          <p className="text-sm text-gray-600 mt-0.5">
                            Invited by <span className="font-medium">{invitation.invitedBy.name}</span>
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          {invitation.members.length}/{invitation.maxSize} members
                        </span>
                      </div>
                      
                      {/* Team Members */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Current Members:</p>
                        <div className="flex flex-wrap gap-2">
                          {invitation.members.map((member, idx) => (
                            <div
                              key={member.userId._id || idx}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                                member.role === 'leader'
                                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                  : 'bg-gray-100 text-gray-700 border border-gray-200'
                              }`}
                            >
                              {member.role === 'leader' && (
                                <Crown className="w-3 h-3 text-yellow-600" />
                              )}
                              <span className="font-medium">{member.userId.name}</span>
                            </div>
                          ))}
                          {invitation.members.length < invitation.maxSize && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-50 text-gray-400 border border-dashed border-gray-300">
                              <span>+{invitation.maxSize - invitation.members.length} slots open</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptTeamInvitation(invitation._id)}
                          disabled={acceptingInvitation === invitation._id}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {acceptingInvitation === invitation._id ? (
                            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineTeamInvitation(invitation._id)}
                          disabled={acceptingInvitation === invitation._id}
                          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Decline
                        </button>
                      </div>
                      
                      {/* Expiry Notice */}
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        Expires: {format(new Date(invitation.expiresAt), 'PPp')}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Registration Restricted Notice - shown when user can view but cannot register */}
              {!hasAccess && !isRegistered && ac.type !== 'everyone' && (
                <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-orange-900 mb-1">Registration Restricted</h4>
                      <p className="text-sm text-orange-800 mb-2">
                        You can view this event but cannot register due to access restrictions.
                      </p>
                      <div className="bg-orange-100 rounded p-2 text-sm">
                        <p className="font-medium text-orange-900 mb-1">Requirements: {buildRequirementText(ac)}</p>
                        {failingReasons.length > 0 && (
                          <ul className="list-disc list-inside text-orange-800 text-xs mt-1">
                            {failingReasons.map((r, i) => (<li key={i}>{r}</li>))}
                          </ul>
                        )}
                      </div>
                      {!user && (
                        <button
                          onClick={() => navigate('/login')}
                          className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                        >
                          Login to Check Eligibility
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {user ? (
                <>
                  {isRegistered ? (
                    <div className="flex flex-col gap-3">
                      {/* Approval Status Display */}
                      {userRegistration?.approvalStatus === 'pending' && (
                        <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-yellow-900 mb-1">Pending Approval</h4>
                              <p className="text-sm text-yellow-800">
                                Your registration is waiting for organizer approval. You'll be notified once approved and can then access your QR code.
                              </p>
                              <p className="text-xs text-yellow-700 mt-2">
                                Registered: {userRegistration.registeredAt ? format(new Date(userRegistration.registeredAt), 'PPp') : 'Recently'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {userRegistration?.approvalStatus === 'rejected' && (
                        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                          <div className="flex items-start gap-3">
                            <X className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-red-900 mb-1">Registration Rejected</h4>
                              <p className="text-sm text-red-800">
                                Your registration was not approved by the organizer.
                              </p>
                              {userRegistration.rejectionReason && (
                                <p className="text-sm text-red-700 mt-2 p-2 bg-red-100 rounded">
                                  <strong>Reason:</strong> {userRegistration.rejectionReason}
                                </p>
                              )}
                              <p className="text-xs text-red-600 mt-2">
                                You can reapply for this event if you meet the requirements.
                              </p>
                              
                              {/* Reapply Button */}
                              <div className="mt-3">
                                <button
                                  onClick={handleRegister}
                                  disabled={loading || (isFull && !deadlinePassed) || !hasAccess || event.status !== 'upcoming'}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                  {loading ? 'Processing...' :
                                   !hasAccess ? 'Not Eligible' :
                                   event.status !== 'upcoming' ? 'Event Completed' :
                                   isFull ? 'Event Full' : 'Reapply for Event'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {userRegistration?.approvalStatus === 'approved' && (
                        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                          <div className="flex items-center space-x-2 px-3 sm:px-4 py-2 sm:py-3 bg-green-50 border border-green-200 rounded-lg flex-1">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="text-green-800 font-medium text-sm sm:text-base">You're registered!</span>
                              {userRegistration.fromWaitlist && (
                                <span className="block text-xs text-green-700 mt-1">
                                  ✓ Approved from waiting list
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            {userRegistration.qrCode && (
                              <button
                                onClick={() => setShowQR(true)}
                                className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base min-w-[140px] sm:min-w-[160px]"
                              >
                                <QrCode className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                <span>Show QR Code</span>
                              </button>
                            )}
                            <button
                              onClick={handleUnregister}
                              disabled={loading}
                              className="px-4 sm:px-6 py-2 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 text-sm sm:text-base min-w-[120px] sm:min-w-[140px]"
                            >
                              {loading ? 'Processing...' : 'Unregister'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Team Manager for team events (show when user is approved) */}
                      {userRegistration?.approvalStatus === 'approved' && event.isTeamEvent && (
                        <div className="mt-4">
                          <TeamManager
                            eventId={id || ''}
                            eventTitle={event.title}
                            eventDate={event.date}
                            eventTime={event.time}
                            minTeamSize={event.minTeamSize || 2}
                            maxTeamSize={event.maxTeamSize || 4}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleRegister}
                        disabled={loading || (isFull && !deadlinePassed) || !hasAccess || event.status !== 'upcoming'}
                        title={!hasAccess ? `Eligible: ${buildRequirementText(ac)}` : undefined}
                        className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                      >
                        {loading ? 'Processing...' :
                         !hasAccess ? `Eligible: ${buildRequirementText(ac)}` :
                         event.status !== 'upcoming' ? 'Event COMPLETED' :
                         (deadlinePassed ? 'Deadline Passed • Request Approval' :
                          isFull ? 'Event Full' : 'Register Now')}
                      </button>

                      {/* Waitlist Button */}
                      {isFull && !deadlinePassed && isRegistrationOpen && event.status === 'upcoming' && (
                        <div className="space-y-3">
                          {waitlistStatus.onWaitlist ? (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Clock className="w-5 h-5 text-yellow-600" />
                                    <span className="font-semibold text-yellow-800">You're on the Waitlist</span>
                                  </div>
                                  <p className="text-sm text-yellow-700 mb-1">
                                    Position: <span className="font-bold">#{waitlistStatus.position}</span>
                                  </p>
                                  <p className="text-xs text-yellow-600">
                                    You'll be notified if a spot opens up
                                  </p>
                                </div>
                                <button
                                  onClick={handleLeaveWaitlist}
                                  disabled={waitlistLoading}
                                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                                >
                                  {waitlistLoading ? 'Leaving...' : 'Leave'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={handleJoinWaitlist}
                              disabled={waitlistLoading}
                              className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center space-x-2"
                            >
                              <Clock className="w-5 h-5" />
                              <span>{waitlistLoading ? 'Joining...' : 'Join Waitlist'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Admin/Event Creator Actions */}
                  {isPrivileged && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button
                          onClick={handleEditEvent}
                          className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
                        >
                          <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span>Edit Event</span>
                        </button>
                        <button
                          onClick={handleDeleteEvent}
                          disabled={loading}
                          className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center space-x-2 text-sm sm:text-base"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span>{loading ? 'Deleting...' : 'Delete Event'}</span>
                        </button>
                      </div>
                      
                      {/* Manual Completion Button - for events that aren't completed and either have prizes OR the event date has passed */}
                      {event.status !== 'completed' && event.status !== 'cancelled' && (
                        (event.prizes && event.prizes.length > 0) || new Date() > new Date(event.date)
                      ) && (
                        <button
                          onClick={openCompleteConfirmation}
                          disabled={completingEvent}
                          className="w-full px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center space-x-2 text-sm sm:text-base"
                        >
                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span>{completingEvent ? 'Completing...' : 'Mark as Completed'}</span>
                        </button>
                      )}
                      
                      {/* Winners Management - only for completed events with prizes */}
                      {event.status === 'completed' && event.prizes && event.prizes.length > 0 && (
                        <button
                          onClick={() => setShowWinnersModal(true)}
                          className="w-full px-4 sm:px-6 py-2 sm:py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
                        >
                          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span>Manage Winners {winners.length > 0 ? `(${winners.length})` : ''}</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => setShowAnnouncementModal(true)}
                        className="w-full px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
                      >
                        <Bell className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                        <span>Send Announcement</span>
                      </button>
                      {waitlistUsers.length > 0 && (
                        <button
                          onClick={() => navigate(`/events/${id}/waitlist`)}
                          className="w-full px-4 sm:px-6 py-2 sm:py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
                        >
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span>Manage Waitlist ({waitlistUsers.length})</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
                >
                  Login to Register
                </button>
              )}

              {/* Share Button */}
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    console.log('Share button clicked, opening modal');
                    setShowShareMenu(true);
                  }}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
                >
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Share Event</span>
                </button>
              </div>
            </div>

                {/* Eligibility Banner */}
                <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg border flex items-start gap-2 ${
                  (ac?.type && ac.type !== 'everyone')
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-green-50 border-green-200 text-green-800'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {(ac?.type && ac.type !== 'everyone') ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Info className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Eligibility</p>
                    <p className="text-sm">{buildRequirementText(ac)}</p>
                  </div>
                </div>
          </div>
        </div>

        {/* Share Modal Popup */}
        <AnimatePresence>
        {showShareMenu && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              ref={shareMenuRef}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Share Event</h3>
                <button
                  onClick={() => setShowShareMenu(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close share dialog"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <p className="text-gray-600 mb-6">Choose how you'd like to share this event:</p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      console.log('Quick Share clicked');
                      handleShare();
                      setShowShareMenu(false);
                    }}
                    className="w-full text-left px-4 py-4 hover:bg-blue-50 rounded-lg flex items-center space-x-4 text-gray-700 transition-colors duration-150 border border-gray-200 hover:border-blue-300"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Share2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Quick Share</div>
                      <div className="text-sm text-gray-500">Use native device sharing</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('More Options clicked');
                      openNativeShareMenu();
                      setShowShareMenu(false);
                    }}
                    className="w-full text-left px-4 py-4 hover:bg-purple-50 rounded-lg flex items-center space-x-4 text-gray-700 transition-colors duration-150 border border-gray-200 hover:border-purple-300"
                  >
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <MoreHorizontal className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Advanced Sharing Options</div>
                      <div className="text-sm text-gray-500">Enhanced sharing with multiple methods</div>
                    </div>
                  </button>
                  
                  <div className="border-t border-gray-200 my-4"></div>
                  
                  <button
                    onClick={() => {
                      console.log('WhatsApp clicked');
                      shareViaWhatsApp();
                      setShowShareMenu(false);
                    }}
                    className="w-full text-left px-4 py-4 hover:bg-green-50 rounded-lg flex items-center space-x-4 text-gray-700 transition-colors duration-150 border border-gray-200 hover:border-green-300"
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <MessageCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold">WhatsApp</div>
                      <div className="text-sm text-gray-500">Share via WhatsApp</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('Email clicked');
                      shareViaEmail();
                      setShowShareMenu(false);
                    }}
                    className="w-full text-left px-4 py-4 hover:bg-orange-50 rounded-lg flex items-center space-x-4 text-gray-700 transition-colors duration-150 border border-gray-200 hover:border-orange-300"
                  >
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Mail className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Email</div>
                      <div className="text-sm text-gray-500">Share via email</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('Copy Link clicked');
                      copyEventLink();
                      setShowShareMenu(false);
                    }}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 rounded-lg flex items-center space-x-4 text-gray-700 transition-colors duration-150 border border-gray-200 hover:border-gray-300"
                  >
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Copy className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Copy Link</div>
                      <div className="text-sm text-gray-500">Copy event link to clipboard</div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* QR Code Modal */}
        <AnimatePresence>
        {showQR && userRegistration && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              className="bg-white rounded-xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Your QR Code</h3>
                <button
                  onClick={() => setShowQR(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close QR code dialog"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="text-center">
                <div id="qr-code-container" className="w-48 h-48 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  {userRegistration.qrCode ? (
                    <img 
                      src={userRegistration.qrCode} 
                      alt="QR Code" 
                      className="w-44 h-44 object-contain"
                    />
                  ) : userRegistration.qrPayload ? (
                    <QRCodeSVG
                      id="qr-code-svg"
                      value={JSON.stringify(userRegistration.qrPayload)}
                      size={180}
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <QrCode className="w-16 h-16 mx-auto mb-2" />
                      <p>QR Code not available</p>
                    </div>
                  )}
                </div>
                {userRegistration.qrCode && (
                  <p className="text-sm text-gray-600 mb-2">
                    QR Code Generated Successfully
                  </p>
                )}
                <p className="text-xs text-gray-500 mb-4">
                  Show this QR code at the event entrance for quick check-in.
                </p>
                
                {/* Download Button */}
                {(userRegistration.qrCode || userRegistration.qrPayload) && (
                  <button
                    onClick={() => {
                      const eventTitle = event.title.replace(/[^a-zA-Z0-9]/g, '_');
                      
                      if (userRegistration.qrCode) {
                        // Download from base64/URL
                        const link = document.createElement('a');
                        link.href = userRegistration.qrCode;
                        link.download = `${eventTitle}_QRCode.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      } else if (userRegistration.qrPayload) {
                        // Convert SVG to PNG and download
                        const svg = document.getElementById('qr-code-svg');
                        if (svg) {
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          const img = new Image();
                          
                          img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx?.drawImage(img, 0, 0);
                            const pngUrl = canvas.toDataURL('image/png');
                            
                            const link = document.createElement('a');
                            link.href = pngUrl;
                            link.download = `${eventTitle}_QRCode.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          };
                          
                          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                        }
                      }
                      
                      addToast({
                        type: 'success',
                        title: 'Download Started',
                        message: 'QR Code is being downloaded'
                      });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download QR Code
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Announcement Modal */}
        <AnimatePresence>
        {showAnnouncementModal && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowAnnouncementModal(false);
              setAnnouncementTitle('');
              setAnnouncementMessage('');
              setAnnouncementPriority('normal');
            }}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              className="bg-white rounded-xl p-6 sm:p-8 max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Send Announcement</h3>
                <button
                  onClick={() => {
                    setShowAnnouncementModal(false);
                    setAnnouncementTitle('');
                    setAnnouncementMessage('');
                    setAnnouncementPriority('normal');
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close announcement dialog"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="e.g., Important Update"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    disabled={announcementLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={announcementMessage}
                    onChange={(e) => setAnnouncementMessage(e.target.value)}
                    placeholder="Enter your announcement message..."
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                    disabled={announcementLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" id="priority-label">
                    Priority Level
                  </label>
                  <select
                    value={announcementPriority}
                    onChange={(e) => setAnnouncementPriority(e.target.value as 'normal' | 'urgent' | 'critical')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    disabled={announcementLoading}
                    aria-labelledby="priority-label"
                    title="Select announcement priority level"
                  >
                    <option value="normal">Normal - Standard notification</option>
                    <option value="urgent">Urgent - Important update</option>
                    <option value="critical">Critical - Requires immediate attention</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">This announcement will be sent to:</p>
                      <p>All registered participants of this event ({displayedParticipants} {displayedParticipants === 1 ? 'person' : 'people'})</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowAnnouncementModal(false);
                      setAnnouncementTitle('');
                      setAnnouncementMessage('');
                      setAnnouncementPriority('normal');
                    }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    disabled={announcementLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendAnnouncement}
                    disabled={announcementLoading || !announcementTitle.trim() || !announcementMessage.trim()}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {announcementLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-5 h-5" />
                        <span>Send Announcement</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Event Completion Confirmation Modal */}
        <AnimatePresence>
        {showCompleteConfirm && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCompleteConfirm(false)}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              className="bg-white rounded-xl p-6 sm:p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  Complete Event
                </h3>
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to mark <b>{event.title}</b> as completed?
                </p>
                
                {/* Warning for sub-events */}
                {subEventCount > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-700 font-semibold">
                          {subEventCount} sub-event{subEventCount > 1 ? 's' : ''} will also be completed
                        </p>
                        <p className="text-amber-600 text-sm mt-1">
                          All active sub-events under this event will be marked as completed automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-blue-700 text-sm">
                    <b>Note:</b> The event will be marked as completed on {format(new Date(), 'PPP')}. 
                    Registered participants will be notified.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteEvent}
                  disabled={completingEvent}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {completingEvent ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Completing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Complete Event</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Winners Management Modal */}
        <AnimatePresence>
        {showWinnersModal && event.status === 'completed' && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setShowWinnersModal(false)}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              className="bg-white rounded-xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto my-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  Manage Winners
                </h3>
                <button
                  onClick={() => setShowWinnersModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close winners dialog"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current Winners */}
              {winners.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Current Winners</h4>
                  <div className="space-y-2">
                    {winners.map((winner) => (
                      <div key={winner._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center font-bold text-yellow-700">
                            {winner.position}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{winner.participantName}</p>
                            <p className="text-sm text-gray-500">
                              {winner.participantType === 'spot' ? '(Spot Registration)' : '(Registered)'}
                              {winner.prize && ` • Prize: ${winner.prize}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveWinner(winner._id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Remove winner"
                          title="Remove this winner"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Winner Section */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Add Winner</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" id="winner-position-label">Position</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedWinnerPosition}
                      onChange={(e) => setSelectedWinnerPosition(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      aria-labelledby="winner-position-label"
                      title="Winner position"
                      placeholder="Enter position"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" id="participant-type-label">Participant Type</label>
                    <select
                      value={selectedParticipantType}
                      onChange={(e) => {
                        setSelectedParticipantType(e.target.value as 'registered' | 'spot');
                        setSelectedParticipantId('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      aria-labelledby="participant-type-label"
                      title="Select participant type"
                    >
                      <option value="registered">Registered Participant</option>
                      <option value="spot">Spot Registration</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2" id="select-participant-label">Select Participant</label>
                  <select
                    value={selectedParticipantId}
                    onChange={(e) => setSelectedParticipantId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    aria-labelledby="select-participant-label"
                    title="Select a participant to add as winner"
                  >
                    <option value="">-- Select --</option>
                    {selectedParticipantType === 'registered' 
                      ? eligibleWinners.registered.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.user.name} ({p.user.department} - Year {p.user.year})
                          </option>
                        ))
                      : eligibleWinners.spot.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.participantName} {p.identifier ? `(${p.identifier})` : ''}
                          </option>
                        ))
                    }
                  </select>
                </div>

                <button
                  onClick={handleAddWinner}
                  disabled={addingWinner || !selectedParticipantId}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {addingWinner ? 'Adding...' : 'Add Winner'}
                </button>
              </div>

              {/* Spot Registration Section */}
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-gray-800">Spot Registrations</h4>
                  <button
                    onClick={() => setShowSpotRegModal(true)}
                    className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    + Add Spot Registration
                  </button>
                </div>
                
                {spotRegistrations.length > 0 ? (
                  <div className="space-y-2">
                    {spotRegistrations.map((sr) => (
                      <div key={sr._id} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div>
                          <p className="font-medium">{sr.participantName}</p>
                          {sr.identifier && <p className="text-sm text-gray-500">ID: {sr.identifier}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No spot registrations yet.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Spot Registration Modal */}
        <AnimatePresence>
        {showSpotRegModal && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
            onClick={() => setShowSpotRegModal(false)}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              className="bg-white rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-gray-900">Add Spot Registration</h4>
                <button onClick={() => setShowSpotRegModal(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close spot registration dialog" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Participant Name *</label>
                  <input
                    type="text"
                    value={spotRegName}
                    onChange={(e) => setSpotRegName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Identifier (Optional)</label>
                  <input
                    type="text"
                    value={spotRegIdentifier}
                    onChange={(e) => setSpotRegIdentifier(e.target.value)}
                    placeholder="e.g., Roll number, ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                  <textarea
                    value={spotRegNotes}
                    onChange={(e) => setSpotRegNotes(e.target.value)}
                    placeholder="Any additional notes"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSpotRegModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddSpotRegistration}
                    disabled={addingSpotReg || !spotRegName.trim()}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                  >
                    {addingSpotReg ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Registered Students Section - Only for logged-in users */}
        {user && (
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Registered Students ({filteredAndSortedParticipants.length})
              </h2>
              
              {/* View Toggle for Team Events - Visible to all users */}
              {event.isTeamEvent && (
                <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setParticipantView('individual')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      participantView === 'individual'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      Individual
                    </span>
                  </button>
                  <button
                    onClick={() => setParticipantView('teams')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      participantView === 'teams'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      Teams
                    </span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Team View */}
            {participantView === 'teams' && event.isTeamEvent && (
              <TeamView 
                eventId={id || ''} 
                refreshTrigger={teamRefreshTrigger}
              />
            )}
            
            {/* Individual View - Filter and Export Controls */}
            {participantView === 'individual' && (
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Search Input */}
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {/* Department Filter */}
                <div className="flex items-center space-x-2 flex-1">
                  <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Filter by department"
                    title="Filter participants by department"
                  >
                    <option value="all">All Departments</option>
                    {departmentOptions.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Sort Controls */}
                <div className="flex items-center space-x-2 flex-1">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'regId' | 'name' | 'department' | 'year')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Sort participants by"
                    title="Sort participants"
                  >
                    <option value="department">Sort by Department</option>
                    <option value="regId">Sort by Reg. ID</option>
                    <option value="name">Sort by Name</option>
                    <option value="year">Sort by Year</option>
                  </select>
                  
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                    title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                  >
                    {sortOrder === 'asc' ? (
                      <SortAsc className="w-4 h-4 text-gray-500" />
                    ) : (
                      <SortDesc className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>

                {/* Export Button */}
                <button
                  onClick={exportToExcel}
                  disabled={filteredAndSortedParticipants.length === 0}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 whitespace-nowrap"
                  title="Export to Excel"
                >
                  <Download className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </button>
              </div>
            </div>
            )}
          </div>

          {/* Pagination Controls - Top */}
          {participantView === 'individual' && filteredAndSortedParticipants.length > studentsPerPage && (
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
                Showing {((currentPage - 1) * studentsPerPage) + 1} to {Math.min(currentPage * studentsPerPage, filteredAndSortedParticipants.length)} of {filteredAndSortedParticipants.length} students
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

          {/* Individual View Content */}
          {participantView === 'individual' && (
          <>
          {filteredAndSortedParticipants.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg min-h-[400px] flex items-center justify-center">
              <p className="text-gray-600">
                {eventRegistrations.length === 0 
                  ? "No students have registered for this event yet." 
                  : "No participants match the current filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed">
                <colgroup>
                  {canView && (
                    <col className="w-24" />
                  )}
                  <col className="w-36" />
                  {canView && (
                    <col className="w-56" />
                  )}
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-16" />
                  <col className="w-48" />
                  {event.isTeamEvent && (
                    <col className="w-36" />
                  )}
                  <col className="w-28" />
                  <col className="w-36" />
                  {isPrivileged && (
                    <col className="w-24" />
                  )}
                </colgroup>
                <thead>
                  <tr>
                    {canView && (
                      <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Reg. ID</th>
                    )}
                    <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Name</th>
                    {canView && (
                      <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Email</th>
                    )}
                    <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Dept</th>
                    <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Sec/Room</th>
                    <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Year</th>
                    <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">College</th>
                    {event.isTeamEvent && (
                      <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Team</th>
                    )}
                    <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Registered At</th>
                    <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Approval Type</th>
                    {isPrivileged && (
                      <th className="px-2 py-3 border-b text-left text-xs font-semibold text-gray-700">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedParticipants.map(reg => (
                    <motion.tr 
                      key={reg.id} 
                      className="border-b hover:bg-gray-50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      {canView && (
                        <td className="px-2 py-3 text-xs text-gray-800">{reg.user?.regId ?? reg.id}</td>
                      )}
                      <td className="px-2 py-3 text-xs">
                        {reg.user?._id || reg.user?.id ? (
                          <Link 
                            to={`/user/${reg.user._id || reg.user.id}`}
                            className="text-gray-800 hover:text-blue-600 hover:underline transition-colors font-medium"
                          >
                            {reg.user?.name ?? '-'}
                          </Link>
                        ) : (
                          <span className="text-gray-800">{reg.user?.name ?? '-'}</span>
                        )}
                      </td>
                      {canView && (
                        <td className="px-2 py-3 text-xs text-gray-800 break-words">{reg.user?.email ?? '-'}</td>
                      )}
                      <td className="px-2 py-3 text-xs text-gray-800">{reg.user?.department ?? '-'}</td>
                      <td className="px-2 py-3 text-xs text-gray-800 text-center">{reg.user?.role === 'faculty' ? reg.user?.roomNo ?? '-' : reg.user?.section ?? '-'}</td>
                      <td className="px-2 py-3 text-xs text-gray-800 text-center">{reg.user?.year ?? '-'}</td>
                      <td className="px-2 py-3 text-xs text-gray-800 leading-tight">{reg.user?.college ?? '-'}</td>
                      {event.isTeamEvent && (
                        <td className="px-2 py-3 text-xs">
                          {(() => {
                            const userId = reg.user?._id || reg.user?.id;
                            const teamInfo = userId ? userTeamMap[userId] : null;
                            
                            if (teamInfo) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-purple-700 text-xs">{teamInfo.teamName}</span>
                                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                    {teamInfo.role === 'leader' ? (
                                      <span className="inline-flex items-center gap-0.5 text-yellow-600">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                        Leader
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">Member</span>
                                    )}
                                    {teamInfo.status === 'complete' && (
                                      <span className="text-green-600">• Complete</span>
                                    )}
                                  </span>
                                </div>
                              );
                            }
                            return <span className="text-gray-400 italic text-[10px]">No team</span>;
                          })()}
                        </td>
                      )}
                      <td className="px-2 py-3 text-xs text-gray-800">{reg.registeredAt ? format(new Date(reg.registeredAt), 'MMM dd, yyyy') : '-'}</td>
                      <td className="px-2 py-3 text-xs">
                        {reg.approvalType === 'autoApproved' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-800 text-[10px] font-medium rounded-full">
                            <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                            Auto
                          </span>
                        )}
                        {reg.approvalType === 'manualApproved' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-medium rounded-full">
                            <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                            Manual
                          </span>
                        )}
                        {reg.approvalType === 'waitingListApproval' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-medium rounded-full">
                            <Clock className="w-2.5 h-2.5 mr-0.5" />
                            Waitlist
                          </span>
                        )}
                      </td>
                      {isPrivileged && (
                        <td className="px-2 py-3 text-xs">
                          <button
                            onClick={() => handleRemoveParticipant(
                              reg.user?._id || reg.user?.id || reg.userId, 
                              reg.user?.name || 'Unknown User'
                            )}
                            disabled={loading}
                            className="px-2 py-1 bg-red-600 text-white text-[10px] rounded hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-1"
                            title="Remove participant"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredAndSortedParticipants.length > studentsPerPage && (
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
                Showing {((currentPage - 1) * studentsPerPage) + 1} to {Math.min(currentPage * studentsPerPage, filteredAndSortedParticipants.length)} of {filteredAndSortedParticipants.length} students
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
          </>
          )}
        </div>
        )}

        {/* Approval Waiting List Section - Visible to all organizers/admins */}
        {canView && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-6 sm:mt-8"
          >
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 border border-gray-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Approval Waiting List</h3>
                    <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                      {event.autoApproval 
                        ? "Auto-approval is ON - All registrations are approved instantly"
                        : "Manual approval required - Review and approve pending registrations"
                      }
                    </p>
                  </div>
                </div>
                {!event.autoApproval && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {pendingCount > 0 && (
                      <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-500 text-white rounded-full font-semibold text-xs sm:text-sm">
                        {pendingCount} Pending
                      </span>
                    )}
                    {isPrivileged ? (
                      <button
                        onClick={() => {
                          setShowApprovalWaitlist(!showApprovalWaitlist);
                          // Refresh pending count when opening
                          if (!showApprovalWaitlist) {
                            fetchPendingCount();
                          }
                        }}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                          showApprovalWaitlist
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {showApprovalWaitlist ? 'Hide' : 'Manage'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowApprovalWaitlist(!showApprovalWaitlist);
                          if (!showApprovalWaitlist) {
                            fetchPendingCount();
                          }
                        }}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                          showApprovalWaitlist
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-gray-500 text-white hover:bg-gray-600'
                        }`}
                      >
                        {showApprovalWaitlist ? 'Hide' : 'View'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Auto Approval Status Badge */}
              <div className={`mb-3 sm:mb-4 p-3 sm:p-4 rounded-lg border-2 ${
                event.autoApproval 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center gap-2">
                  {event.autoApproval ? (
                    <>
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                      <span className="font-semibold text-green-800 text-sm sm:text-base">Auto Approval: ON</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                      <span className="font-semibold text-yellow-800 text-sm sm:text-base">Auto Approval: OFF</span>
                    </>
                  )}
                </div>
                <p className="text-xs sm:text-sm mt-2 text-gray-700">
                  {event.autoApproval
                    ? "All new registrations are automatically approved with instant QR code access."
                    : "New registrations require manual approval before users can access their QR codes."}
                </p>
              </div>

              {/* Waiting List Manager */}
              {!event.autoApproval && showApprovalWaitlist && (
                <WaitingListManager 
                  eventId={id!} 
                  readOnly={!isPrivileged}
                  onUpdate={() => {
                    fetchPendingCount();
                  }}
                  renderRegistrationExtra={(reg: { registrationId?: string; registeredAt?: string; approvalStatus?: string }) => (
                    <div className="mt-2 flex items-center flex-wrap gap-2 text-xs">
                      {reg.registrationId && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 border border-gray-200">
                          <span className="font-medium text-gray-700">Reg ID:</span>
                          <span className="text-gray-800 select-all">{reg.registrationId}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(reg.registrationId!).catch(()=>{});
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                            title="Copy registration ID"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-gray-600">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        </div>
                      )}
                      {reg.registeredAt && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 border border-blue-200">
                          <span className="font-medium text-blue-700">Requested:</span>
                          <span className="text-blue-800">{format(new Date(reg.registeredAt), 'MMM dd, HH:mm')}</span>
                        </div>
                      )}
                      {reg.approvalStatus === 'pending' && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 border border-yellow-200">
                          <span className="font-medium text-yellow-700">Pending Approval</span>
                        </div>
                      )}
                    </div>
                  )}
                />
              )}

              {!event.autoApproval && !showApprovalWaitlist && (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <Clock className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                  <p className="text-sm sm:text-base">
                    {pendingCount === 0 
                      ? "No pending approvals at this time." 
                      : `${pendingCount} registration(s) pending approval. Click 'Manage' to review.`}
                  </p>
                </div>
              )}

              {event.autoApproval && (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-green-400" />
                  <p className="text-gray-600 text-sm sm:text-base">
                    Auto-approval is enabled. All registrations are approved automatically.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2">
                    Edit the event to change the approval settings.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Sub-Events Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <SubEventsList 
            eventId={id!} 
            canCreateSubEvent={isPrivileged} 
          />
        </motion.div>

        {/* Comments Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <Comments eventId={id!} eventStatus={event.status} />
        </motion.div>
      </div>
      
      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={confirmDeleteEvent}
        onClose={() => {
          setConfirmDeleteEvent(false);
          setEventGallery(null);
        }}
        onConfirm={confirmDeleteEventAction}
        title="Delete Event"
        message={eventGallery && eventGallery.mediaCount > 0
          ? `⚠️ This event has a ${eventGallery.published ? 'PUBLISHED' : 'unpublished'} gallery with ${eventGallery.mediaCount} media item${eventGallery.mediaCount !== 1 ? 's' : ''}!\n\nDeleting this event will permanently delete the gallery and all its media. This action cannot be undone.`
          : "Are you sure you want to delete this event? This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={checkingGallery}
      />
      
      <ConfirmModal
        isOpen={!!confirmRemoveParticipant}
        onClose={() => setConfirmRemoveParticipant(null)}
        onConfirm={confirmRemoveParticipantAction}
        title="Remove Participant"
        message={`Are you sure you want to remove ${confirmRemoveParticipant?.userName} from this event?`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="warning"
      />
    </motion.div>
  );
};

export default EventDetails;