import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../contexts/EventContext.tsx';
import { 
  User, 
  Mail, 
  Calendar, 
  Trophy,
  Building,
  BookOpen,
  Hash,
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  GraduationCap,
  XCircle
} from 'lucide-react';
import { pageVariants, fadeInVariants } from '../utils/animations';

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: 'student' | 'organizer' | 'faculty' | 'admin';
  department: string;
  section?: string;
  year?: number;
  admissionMonth?: number;
  admissionYear?: number;
  graduationYear?: number;
  regId?: string;
  mobile?: string;
  roomNo?: string;
  createdAt: string;
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
}

interface UserStats {
  eventsRegistered: number;
  eventsAttended: number;
  eventsOrganized: number;
  upcomingEvents: number;
}

const UserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { events, registrations } = useEvents();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    eventsRegistered: 0,
    eventsAttended: 0,
    eventsOrganized: 0,
    upcomingEvents: 0
  });
  const [loading, setLoading] = useState(true);
  const [userEvents, setUserEvents] = useState<any[]>([]);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/users/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
        
        // Fetch user's registrations from dedicated backend endpoint
        let userRegs: any[] = [];
        try {
          const regsResponse = await fetch(`/api/users/${userId}/registrations`);
          if (regsResponse.ok) {
            const regsData = await regsResponse.json();
            userRegs = regsData.registrations || [];
          }
        } catch (err) {
          console.error('Error fetching user registrations:', err);
          // Fallback to context registrations
          userRegs = registrations.filter(r => 
            (r.userId === userId || (typeof r.userId === 'object' && (r.userId as any)._id === userId))
          );
        }
        
        const userOrganizedEvents = events.filter(e => 
          e.organizerId === userId || (typeof e.organizerId === 'object' && (e.organizerId as any)._id === userId)
        );
        
        const attended = userRegs.filter((r: any) => r.status === 'attended').length;
        const upcoming = userRegs.filter((r: any) => {
          const evt = r.event || events.find((e: any) => e.id === r.eventId || e._id === r.eventId);
          return evt?.status === 'upcoming';
        }).length;

        setUserStats({
          eventsRegistered: userRegs.length,
          eventsAttended: attended,
          eventsOrganized: userOrganizedEvents.length,
          upcomingEvents: upcoming
        });

        // Get ALL user's registered events with registration details
        const userEventsList = userRegs.map((reg: any) => {
          const evt = reg.event || events.find((e: any) => e.id === reg.eventId || e._id === reg.eventId);
          return evt ? { ...evt, registration: reg } : null;
        }).filter(Boolean);
        
        setUserEvents(userEventsList);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; color: string; icon: any }> = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-700 border-red-300', icon: GraduationCap },
      organizer: { label: 'Organizer', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: Users },
      student: { label: 'Student', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: BookOpen },
      faculty: { label: 'Faculty', color: 'bg-green-100 text-green-700 border-green-300', icon: GraduationCap }
    };

    const config = roleConfig[role] || { label: role, color: 'bg-gray-100 text-gray-700 border-gray-300', icon: User };
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${config.color}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-20 pb-8 px-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-20 pb-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">User not found</h2>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

    const isOwnProfile = currentUser && (currentUser._id === userId || currentUser.id === userId);
  const canSeeAllInfo = currentUser && (currentUser.role === 'admin' || currentUser.role === 'organizer' || isOwnProfile);

  // Helper function to check if a field should be shown based on privacy settings
  const canShowField = (field: string): boolean => {
    if (canSeeAllInfo) return true; // Admins, organizers, and the user themselves can see everything
    if (!userData?.privacySettings) return true; // Default to showing if no privacy settings
    
    const privacyMap: Record<string, keyof typeof userData.privacySettings> = {
      email: 'showEmail',
      mobile: 'showMobile',
      section: 'showSection',
      year: 'showYear',
      regId: 'showRegId',
      department: 'showDepartment',
      admissionYear: 'showAdmissionYear',
      roomNo: 'showRoomNo',
      statistics: 'showStatistics'
    };
    
    const privacyKey = privacyMap[field];
    return privacyKey ? (userData.privacySettings[privacyKey] ?? true) : true;
  };

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-20 pb-8 px-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Profile Header */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6"
          variants={fadeInVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-lg">
                {userData.name.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {userData.name}
                </h1>
                {getRoleBadge(userData.role)}
                {isOwnProfile && (
                  <span className="text-sm text-gray-500">(You)</span>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                {canShowField('email') && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{userData.email}</span>
                  </div>
                )}
                {userData.mobile && canShowField('mobile') && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{userData.mobile}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Joined {new Date(userData.createdAt).toLocaleDateString()}</span>
                </div>
                {!canSeeAllInfo && (!userData.privacySettings?.showEmail || !userData.privacySettings?.showMobile) && (
                  <p className="text-xs text-gray-400 italic">Some contact information is hidden by privacy settings</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Academic/Professional Details */}
          <motion.div 
            className="bg-white rounded-2xl shadow-lg p-6"
            variants={fadeInVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              {canShowField('department') && (
                <div className="flex items-center gap-3 text-gray-700">
                  <Building className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p className="font-medium">{userData.department}</p>
                  </div>
                </div>
              )}
              
              {userData.section && canShowField('section') && (
                <div className="flex items-center gap-3 text-gray-700">
                  <BookOpen className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-xs text-gray-500">Section</p>
                    <p className="font-medium">{userData.section}</p>
                  </div>
                </div>
              )}
              
              {userData.year && canShowField('year') && (
                <div className="flex items-center gap-3 text-gray-700">
                  <GraduationCap className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-500">Year</p>
                    <p className="font-medium">Year {userData.year}</p>
                    {userData.admissionMonth && userData.admissionYear && canShowField('admissionYear') && (
                      <p className="text-xs text-gray-400 mt-1">
                        {userData.admissionYear} - {userData.graduationYear || 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {userData.regId && canShowField('regId') && (
                <div className="flex items-center gap-3 text-gray-700">
                  <Hash className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-xs text-gray-500">Registration ID</p>
                    <p className="font-medium">{userData.regId}</p>
                  </div>
                </div>
              )}
              
              {userData.roomNo && canShowField('roomNo') && (
                <div className="flex items-center gap-3 text-gray-700">
                  <Building className="w-5 h-5 text-pink-500" />
                  <div>
                    <p className="text-xs text-gray-500">Room No</p>
                    <p className="font-medium">{userData.roomNo}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Statistics */}
          {canShowField('statistics') ? (
            <motion.div 
              className="bg-white rounded-2xl shadow-lg p-6"
              variants={fadeInVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Statistics</h2>
              <div className={`grid gap-4 ${userData.role === 'student' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-700 font-medium">Registered</p>
                </div>
                <p className="text-3xl font-bold text-blue-900">{userStats.eventsRegistered}</p>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-700 font-medium">Attended</p>
                </div>
                <p className="text-3xl font-bold text-green-900">{userStats.eventsAttended}</p>
              </div>

              {userData.role !== 'student' && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-purple-600" />
                    <p className="text-sm text-purple-700 font-medium">Organized</p>
                  </div>
                  <p className="text-3xl font-bold text-purple-900">{userStats.eventsOrganized}</p>
                </div>
              )}

              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <p className="text-sm text-orange-700 font-medium">Upcoming</p>
                </div>
                <p className="text-3xl font-bold text-orange-900">{userStats.upcomingEvents}</p>
              </div>
            </div>
          </motion.div>
          ) : (
            <motion.div 
              className="bg-white rounded-2xl shadow-lg p-6"
              variants={fadeInVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Statistics</h2>
              <p className="text-gray-600 text-sm">Statistics are hidden by this user.</p>
            </motion.div>
          )}
        </div>

        {/* Recent Events */}
        {userEvents.length > 0 && (
          <motion.div 
            className="bg-white rounded-2xl shadow-lg p-6"
            variants={fadeInVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">Registered Events ({userEvents.length})</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {userEvents.map((event: any, index: number) => {
                const registration = event.registration;
                const approvalStatus = registration?.approvalStatus || 'approved';
                const attendanceStatus = registration?.status;
                
                return (
                  <div 
                    key={index}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/events/${event.id || event._id}`)}
                  >
                    {event.image && (
                      <img 
                        src={event.image} 
                        alt={event.title}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{event.title}</h3>
                      <p className="text-sm text-gray-600">{new Date(event.date).toLocaleDateString()}</p>
                      
                      {/* Approval Status Badge */}
                      {approvalStatus === 'pending' && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock className="w-4 h-4 text-yellow-600" />
                          <span className="text-xs font-medium text-yellow-700">
                            Pending Approval
                          </span>
                        </div>
                      )}
                      {approvalStatus === 'rejected' && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-xs font-medium text-red-700">
                            Registration Rejected
                          </span>
                          {registration?.rejectionReason && (
                            <span className="text-xs text-red-600">
                              - {registration.rejectionReason}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        event.status === 'upcoming' ? 'bg-green-100 text-green-800' :
                        event.status === 'ongoing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {event.status}
                      </span>
                      
                      {/* Attendance Status Badge */}
                      {attendanceStatus === 'attended' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Attended
                        </span>
                      )}

                      {/* Approval Status Badge */}
                      {approvalStatus === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                          Pending
                        </span>
                      )}
                      {approvalStatus === 'approved' && registration && attendanceStatus !== 'attended' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                          Approved
                        </span>
                      )}
                      {approvalStatus === 'rejected' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default UserProfile;
