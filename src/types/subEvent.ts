// Sub-Event Types and Interfaces

export type AccessControlType = 'everyone' | 'students_only' | 'faculty_only' | 'custom';

export interface AccessControl {
  type: AccessControlType;
  allowedDepartments?: string[];
  allowedYears?: number[];
  allowedRoles?: ('student' | 'faculty' | 'organizer' | 'admin')[];
}

export interface SubEvent {
  _id: string;
  parentEventId: string;
  title: string;
  description: string;
  venue: string;
  date: string;
  time: string;
  category?: string;
  organizerId: string;
  organizer?: {
    _id: string;
    name: string;
    email: string;
  };
  accessControl: AccessControl;
  capacity?: number;
  registeredCount?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  imageUrl?: string;
  image?: string;
  tags?: string[];
  // Team event settings
  isTeamEvent?: boolean;
  minTeamSize?: number;
  maxTeamSize?: number;
  // Other fields
  requirements?: string[];
  prizes?: string[];
  registrationDeadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubEventRegistration {
  _id: string;
  registrationId: string;
  userId: string;
  user?: {
    _id: string;
    name: string;
    email: string;
    department?: string;
    year?: number;
    role: string;
  };
  subEventId: string;
  parentEventId: string;
  parentRegistrationId?: string;
  parentRegistration?: {
    id: string;
    qrCode: string;
  };
  status: 'registered' | 'attended' | 'absent' | 'cancelled';
  qrCode?: string;
  qrPayload?: string;
  scannedAt?: string;
  scannedBy?: string;
  registeredAt: string;
}

export interface SubEventComment {
  _id: string;
  subEventId: string;
  userId: string;
  user?: {
    _id: string;
    name: string;
    email: string;
  };
  content: string;
  parentId?: string;
  replies?: SubEventComment[];
  createdAt: string;
  updatedAt: string;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  denialReason?: string;
  accessControl: AccessControl;
}
