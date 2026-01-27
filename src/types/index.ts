export interface User {
  id?: string;
  _id?: string;
  regId?: string;
  name: string;
  email: string;
  role: 'student' | 'organizer' | 'admin' | 'faculty';
  college?: string; // Added college field for institution name
  section?: string;
  roomNo?: string;
  department?: string;
  branch?: string; // Added branch for backend compatibility
  mobile?: string;
  year?: number;
  admissionMonth?: number; // Month of admission (1-12)
  admissionYear?: number; // Year of admission
  graduationYear?: number; // Expected graduation year
  lateralEntry?: boolean; // Whether student joined via lateral entry (2nd/3rd year)
  avatar?: string;
  privacySettings?: {
    showEmail?: boolean;
    showMobile?: boolean;
    showSection?: boolean;
    showYear?: boolean;
    showRegId?: boolean;
    showDepartment?: boolean;
    showAdmissionYear?: boolean;
    showRoomNo?: boolean;
    showStatistics?: boolean;
  };
  createdAt: Date;
}

export interface Event {
  id: string;
  _id?: string; // MongoDB ObjectId as string
  title: string;
  description: string;
  category: 'technical' | 'cultural' | 'sports' | 'workshop' | 'seminar';
  date: Date;
  time: string;
  endTime?: string;
  venue: string;
  maxParticipants: number;
  currentParticipants: number;
  organizerId: string;
  organizer?: User;
  image?: string;
  imageType?: 'url' | 'upload' | 'gridfs';
  imageGridFsId?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageOriginalName?: string;
  requirements?: string[];
  prizes?: string[];
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  registrationDeadline: Date;
  completedAt?: Date;
  completedBy?: string;
  autoApproval?: boolean;
  accessControl?: {
    type: 'everyone' | 'students_only' | 'faculty_only' | 'custom';
    allowedDepartments?: string[];
    allowedYears?: number[];
    allowedRoles?: ('student' | 'organizer' | 'admin' | 'faculty')[];
  };
  // Team event settings
  isTeamEvent?: boolean;
  minTeamSize?: number;
  maxTeamSize?: number;
  createdAt: Date;
}

export interface SpotRegistration {
  _id: string;
  eventId: string;
  participantName: string;
  identifier?: string;
  notes?: string;
  addedBy: string | User;
  createdAt: Date;
}

export interface Winner {
  _id: string;
  eventId: string;
  position: number;
  prize?: string;
  participantType: 'registered' | 'spot';
  userId?: string | User;
  spotRegistrationId?: string | SpotRegistration;
  participantName: string;
  addedBy: string | User;
  createdAt: Date;
}

export interface Registration {
  id: string;
  registrationId: string; // Unique ID for each registration
  userId: string;
  eventId: string;
  user: User & { _id?: string };
  event: Event & { _id?: string };
  registeredAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'registered' | 'attended' | 'absent' | 'cancelled';
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // Separate approval tracking
  approvalType?: 'autoApproved' | 'manualApproved' | 'waitingListApproval' | null; // How user was approved
  fromWaitlist?: boolean; // Track if user was approved from waitlist
  approvedAt?: Date; // When the registration was approved
  approvedBy?: string | User; // Who approved it
  rejectedAt?: Date; // When the registration was rejected
  rejectedBy?: string | User; // Who rejected it
  rejectionReason?: string; // Reason for rejection
  qrCode?: string;
  qrPayload?: QRPayload;
  scanLogs?: ScanLog[];
}

export interface QRPayload {
  registration_id: string;
  student_id: string;
  event_id: string;
  issued_at: string;
  expires_at?: string;
  signature: string;
  event_title?: string;
  student_name?: string;
}

export interface ScanLog {
  id: string;
  registrationId: string;
  scannedAt: Date;
  scannedBy?: string;
  location?: string;
  status: 'valid' | 'invalid' | 'expired' | 'duplicate';
  notes?: string;
}

export interface MultiEventRegistration {
  eventIds: string[];
  userId: string;
  registrations: Registration[];
  totalEvents: number;
  successfulRegistrations: number;
  failedRegistrations: { eventId: string; reason: string; }[];
}

export interface QRValidationResult {
  valid: boolean;
  registration?: Registration;
  reason?: string;
  scanLog?: ScanLog;
}

export interface Notification {
  _id: string;
  user: string; // User ID
  type: 
    | 'event_created' 
    | 'event_deleted' 
    | 'event_updated' 
    | 'registered' 
    | 'unregistered' 
    | 'registration_deleted'
    | 'reminder_24h'
    | 'reminder_1h'
    | 'capacity_alert'
    | 'waitlist_added'
    | 'waitlist_promoted'
    | 'comment_added'
    | 'comment_reply'
    | 'event_cancelled'
    | 'event_postponed'
    | 'venue_changed'
    | 'friend_registered'
    | 'trending_event'
    | 'spot_available'
    | 'announcement'
    | 'custom_announcement';
  title?: string; // Optional title for announcements
  message: string;
  data?: {
    eventId?: string;
    eventTitle?: string;
    eventImage?: string;
    relatedUser?: string;
    commentId?: string;
    changes?: any;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    sender?: {
      id: string;
      name: string;
      role: string;
    };
    timestamp?: Date;
  };
  priority?: 'normal' | 'urgent' | 'critical';
  read: boolean;
  clicked?: boolean;
  createdAt: Date;
}

export interface NotificationPreferences {
  _id?: string;
  userId: string;
  emailNotifications: boolean;
  preferences: {
    eventCreated: boolean;
    eventUpdated: boolean;
    eventCancelled: boolean;
    reminders: boolean;
    capacityAlerts: boolean;
    waitlistUpdates: boolean;
    comments: boolean;
    friendActivity: boolean;
    announcements: boolean;
  };
  // Organizer/Admin specific email preferences
  emailPreferences?: {
    registrations: boolean;
    waitlist: boolean;
    eventUpdates: boolean;
    teamNotifications: boolean;
  };
}

export interface Waitlist {
  _id: string;
  userId: string;
  eventId: string;
  position: number;
  createdAt: Date;
}

export interface Comment {
  _id: string;
  eventId: string;
  userId: string | User;
  content: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Friend {
  _id: string;
  userId: string | User;
  friendId: string | User;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
}

export interface EventResult {
  id: string;
  eventId: string;
  position: number;
  participantName: string;
  participantId: string;
  prize?: string;
  createdAt: Date;
}

// Team Types
export interface TeamMember {
  userId: User;
  joinedAt: Date;
  role: 'leader' | 'member';
}

export interface Team {
  _id: string;
  eventId: string | Event;
  name: string;
  leaderId: User;
  members: TeamMember[];
  maxMembers: number;
  status: 'forming' | 'complete' | 'registered' | 'disqualified';
  registrationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamJoinRequest {
  _id: string;
  teamId: string | Team;
  eventId: string | Event;
  fromUserId: User;
  toUserId: User;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  message?: string;
  respondedAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}