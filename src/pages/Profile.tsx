import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import {
  User,
  Mail,
  Building,
  Calendar,
  Edit,
  Save,
  X,
  Shield,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { pageVariants, fadeInVariants } from '../utils/animations';

const Profile: React.FC = () => {
  const { user, updateProfile, changePassword, refreshUserData } = useAuth();
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showManualYearUpdate, setShowManualYearUpdate] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    college: user?.college || '',
    department: user?.department || '',
    section: user?.section || '',
    roomNo: (user as any)?.roomNo || '',
    mobile: user?.mobile || '',
    year: user?.year || 1,
    admissionMonth: user?.admissionMonth || 7,
    admissionYear: user?.admissionYear || new Date().getFullYear(),
    graduationYear: user?.graduationYear || new Date().getFullYear() + 4,
    regId: user?.regId || '',
    avatar: user?.avatar || '',
    lateralEntry: user?.lateralEntry || false,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [avatarShape, setAvatarShape] = useState<'circle' | 'square'>('circle');
  const [avatarSize, setAvatarSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Update form data when user data changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        college: user.college || '',
        department: user.department || '',
        section: user.section || '',
        roomNo: (user as any)?.roomNo || '',
        mobile: user.mobile || '',
        year: user.year || 1,
        admissionMonth: user.admissionMonth || 7,
        admissionYear: user.admissionYear || new Date().getFullYear(),
        graduationYear: user.graduationYear || new Date().getFullYear() + 4,
        regId: user.regId || '',
        avatar: user.avatar || '',
        lateralEntry: user.lateralEntry || false,
      });
      setAvatarPreview(user.avatar || '');
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await updateProfile({
        name: formData.name,
        email: formData.email,
        college: formData.college,
        department: formData.department,
        section: user.role === 'faculty' ? undefined : formData.section,
        roomNo: user.role === 'faculty' ? formData.roomNo : undefined,
        mobile: formData.mobile,
        year: user.role === 'faculty' ? undefined : formData.year,
        admissionMonth: user.role === 'student' ? formData.admissionMonth : undefined,
        admissionYear: user.role === 'student' ? formData.admissionYear : undefined,
        graduationYear: user.role === 'student' ? formData.graduationYear : undefined,
        regId: formData.regId,
        avatar: formData.avatar,
        lateralEntry: user.role === 'student' ? formData.lateralEntry : undefined,
      });

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Profile Updated',
          message: 'Your profile has been updated successfully.',
        });
        setIsEditing(false);
      } else {
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: result.error || 'Failed to update profile.',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => {
      const newValue = type === 'checkbox' ? checked : (name === 'year' || name === 'admissionMonth' || name === 'admissionYear' || name === 'graduationYear') ? parseInt(value) || 0 : value;
      
      // If admissionYear is being updated, recalculate graduation year while preserving lateralEntry
      if (name === 'admissionYear') {
        const admissionYear = parseInt(value) || new Date().getFullYear();
        const totalYears = prev.lateralEntry ? 3 : 4;
        const calculatedGraduationYear = admissionYear + totalYears;
        
        return {
          ...prev,
          admissionYear,
          graduationYear: calculatedGraduationYear,
        };
      }
      
      return {
        ...prev,
        [name]: newValue,
      };
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      addToast({
        type: 'error',
        title: 'Password Mismatch',
        message: 'New password and confirm password do not match.',
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      addToast({
        type: 'error',
        title: 'Password Too Short',
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    setPasswordLoading(true);
    
    try {
      const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Password Changed',
          message: 'Your password has been updated successfully.',
        });
        setShowPasswordChange(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        addToast({
          type: 'error',
          title: 'Password Change Failed',
          message: result.error || 'Failed to change password.',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Password Change Failed',
        message: 'An unexpected error occurred.',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleManualYearUpdate = async (newYear: number) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/user/${user._id || user.id}/year`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: newYear }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.user) {
        addToast({
          type: 'success',
          title: 'Year Updated',
          message: `Your year has been updated to ${newYear}${newYear === 1 ? 'st' : newYear === 2 ? 'nd' : newYear === 3 ? 'rd' : 'th'} year.`,
        });
        
        // Update user in context and local storage
        const updatedUser = { ...data.user };
        if (!updatedUser.id) updatedUser.id = updatedUser._id;
        if (!updatedUser._id) updatedUser._id = updatedUser.id;
        
        // Update via AuthContext to keep everything in sync
        window.location.reload(); // Force refresh to sync all data
      } else {
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: data.error || 'Failed to update year.',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
      setShowManualYearUpdate(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'organizer':
        return 'bg-purple-100 text-purple-800';
      case 'student':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const departments = [
    'CSE',
    'IT',
    'AI & DS',
    'AI & ML',
    'ECE',
    'EEE',
    'Mechanical',
    'Civil',
    'Others',
  ];

  return (
    <motion.div 
      className="pt-8 sm:pt-12 md:pt-16 pb-6 sm:pb-8 md:pb-12 bg-gradient-to-br from-gray-50 to-blue-50 flex justify-center"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div 
        className="container-responsive max-w-5xl w-full"
        variants={fadeInVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-visible w-full"
          style={{ minHeight: 'unset', height: 'auto' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-6 md:px-8 lg:px-10 py-8 sm:py-10 md:py-12">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* Avatar */}
              <motion.div 
                className="relative flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                {(() => {
                  const sizeMap: Record<string, string> = {
                    sm: 'w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24',
                    md: 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28',
                    lg: 'w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32',
                  };
                  const shapeClass = avatarShape === 'circle' ? 'rounded-full' : 'rounded-lg';
                  const sizeClass = sizeMap[avatarSize] || sizeMap.md;
                  return (
                    <div className={`${sizeClass} bg-white/20 backdrop-blur-sm ${shapeClass} flex items-center justify-center overflow-hidden ring-4 ring-white/30`}> 
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <div className="absolute -bottom-1 -right-1 sm:bottom-0 sm:right-0 flex items-center gap-2">
                  {/* Profile picture upload is disabled */}

                  {/* Shape toggle */}
                  <button
                    onClick={() => setAvatarShape(prev => prev === 'circle' ? 'square' : 'circle')}
                    className="hidden sm:inline-flex items-center justify-center p-1.5 bg-white/90 rounded-md shadow-sm hover:shadow-md"
                    title="Toggle shape"
                    aria-label="Toggle avatar shape"
                  >
                    {avatarShape === 'circle' ? '◯' : '▢'}
                  </button>

                  {/* Size cycle */}
                  <button
                    onClick={() => setAvatarSize(prev => prev === 'sm' ? 'md' : prev === 'md' ? 'lg' : 'sm')}
                    className="hidden sm:inline-flex items-center justify-center p-1.5 bg-white/90 rounded-md shadow-sm hover:shadow-md"
                    title="Cycle avatar size"
                    aria-label="Change avatar size"
                  >
                    {avatarSize === 'sm' ? 'S' : avatarSize === 'md' ? 'M' : 'L'}
                  </button>
                </div>
              </motion.div>

              {/* User Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
                  {user.name}
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-blue-100 mb-3 sm:mb-4 break-all">
                  {user.email}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                  <motion.span 
                    className={`px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${getRoleColor(user.role)} flex items-center gap-1.5`}
                    whileHover={{ scale: 1.05 }}
                  >
                    <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </motion.span>
                  {user.department && (
                    <motion.span 
                      className="px-3 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs sm:text-sm font-medium"
                      whileHover={{ scale: 1.05 }}
                    >
                      {user.department}
                    </motion.span>
                  )}
                  {user.year && (
                    <motion.span 
                      className="px-3 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs sm:text-sm font-medium"
                      whileHover={{ scale: 1.05 }}
                    >
                      Year {user.year}
                    </motion.span>
                  )}
                </div>
              </div>

              {/* Edit Button */}
              <motion.button
                onClick={() => setIsEditing(!isEditing)}
                className="p-3 sm:p-3.5 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {isEditing ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Edit className="w-5 h-5 sm:w-6 sm:h-6" />}
              </motion.button>
            </div>
          </div>

          {/* Profile Form */}
          <div className="p-4 sm:p-6 md:p-8 lg:p-10">
            {isEditing ? (
              <motion.form 
                onSubmit={handleSubmit} 
                className="space-y-4 sm:space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Name */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[44px]"
                      />
                    </div>
                  </motion.div>

                  {/* Email */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[44px]"
                      />
                    </div>
                  </motion.div>

                  {/* College */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.17 }}
                  >
                    <label htmlFor="college" className="block text-sm font-medium text-gray-700 mb-2">
                      College
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        id="college"
                        name="college"
                        type="text"
                        required
                        value={formData.college}
                        onChange={handleInputChange}
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[44px]"
                        placeholder="Your college name"
                      />
                    </div>
                  </motion.div>

                  {/* Department */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
                      <select
                        id="department"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none min-h-[44px]"
                      >
                        <option value="">Select Department</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>

                  {/* Section/Room No */}
                  <div>
                    {user.role === 'faculty' ? (
                      <>
                        <label htmlFor="roomNo" className="block text-sm font-medium text-gray-700 mb-2">Room No</label>
                        <input
                          id="roomNo"
                          name="roomNo"
                          type="text"
                          value={formData.roomNo}
                          onChange={handleInputChange}
                          className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </>
                    ) : (
                      <>
                        <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                        <input
                          id="section"
                          name="section"
                          type="text"
                          value={formData.section}
                          onChange={handleInputChange}
                          className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </>
                    )}
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                    <input
                      id="mobile"
                      name="mobile"
                      type="text"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Registration ID */}
                  <div>
                    <label htmlFor="regId" className="block text-sm font-medium text-gray-700 mb-2">Registration ID</label>
                    <input
                      id="regId"
                      name="regId"
                      type="text"
                      value={formData.regId}
                      onChange={handleInputChange}
                      className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Student Admission Fields - always visible for students */}
                  {user.role === 'student' && (
                    <>
                      {/* Year of Study */}
                      <motion.div>
                        <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">Year of Study</label>
                        <select
                          id="year"
                          name="year"
                          value={formData.year}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                          <option value={1}>1st Year</option>
                          <option value={2}>2nd Year</option>
                          <option value={3}>3rd Year</option>
                          <option value={4}>4th Year</option>
                        </select>
                      </motion.div>
                      {/* Lateral Entry Checkbox */}
                      <motion.div className="flex items-center mt-2">
                        <input
                          id="lateralEntry"
                          name="lateralEntry"
                          type="checkbox"
                          checked={formData.lateralEntry}
                          onChange={(e) => {
                            const isLateral = e.target.checked;
                            setFormData((prev) => {
                              const admissionYear = prev.admissionYear || new Date().getFullYear();
                              // Lateral entry students join in 2nd year, so they need 3 more years (2nd, 3rd, 4th)
                              const totalYears = isLateral ? 3 : 4;
                              const calculatedGraduationYear = admissionYear + totalYears;
                              return {
                                ...prev,
                                lateralEntry: isLateral,
                                graduationYear: calculatedGraduationYear
                              };
                            });
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="lateralEntry" className="ml-2 block text-sm text-gray-700">
                          Lateral Entry (joined in 2nd year)
                        </label>
                      </motion.div>
                      {/* Admission Month */}
                      <motion.div>
                        <label htmlFor="admissionMonth" className="block text-sm font-medium text-gray-700 mb-2">Admission Month</label>
                        <select
                          id="admissionMonth"
                          name="admissionMonth"
                          value={formData.admissionMonth}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                          <option value={1}>January</option>
                          <option value={2}>February</option>
                          <option value={3}>March</option>
                          <option value={4}>April</option>
                          <option value={5}>May</option>
                          <option value={6}>June</option>
                          <option value={7}>July</option>
                          <option value={8}>August</option>
                          <option value={9}>September</option>
                          <option value={10}>October</option>
                          <option value={11}>November</option>
                          <option value={12}>December</option>
                        </select>
                      </motion.div>
                      {/* Admission Year */}
                      <motion.div>
                        <label htmlFor="admissionYear" className="block text-sm font-medium text-gray-700 mb-2">Admission Year</label>
                        <input
                          id="admissionYear"
                          name="admissionYear"
                          type="number"
                          min={1990}
                          max={new Date().getFullYear() + 10}
                          value={formData.admissionYear}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </motion.div>
                      {/* Graduation Year */}
                      <motion.div>
                        <label htmlFor="graduationYear" className="block text-sm font-medium text-gray-700 mb-2">Expected Graduation Year</label>
                        <input
                          id="graduationYear"
                          name="graduationYear"
                          type="number"
                          min={formData.admissionYear || 1990}
                          max={(formData.admissionYear || new Date().getFullYear()) + 4}
                          value={formData.graduationYear}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          {formData.lateralEntry 
                            ? `Auto-calculated: ${formData.admissionYear} + 3 years (lateral entry)`
                            : `Auto-calculated: ${formData.admissionYear} + 4 years`
                          }
                        </p>
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <motion.div 
                  className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-6 border-t border-gray-200"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <motion.button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium min-h-[44px] touch-manipulation"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation shadow-md hover:shadow-lg"
                    whileHover={!loading ? { scale: 1.02 } : {}}
                    whileTap={!loading ? { scale: 0.98 } : {}}
                  >
                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                  </motion.button>
                </motion.div>
              </motion.form>
            ) : (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                      <p className="text-lg text-gray-900">{user.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                      <p className="text-lg text-gray-900">{user.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">{user.role === 'faculty' ? 'Room No' : 'Section'}</label>
                      <p className="text-lg text-gray-900">{user.role === 'faculty' ? ((user as any).roomNo || 'Not specified') : (user.section || 'Not specified')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Mobile Number</label>
                      <p className="text-lg text-gray-900">{user.mobile || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Department</label>
                      <p className="text-lg text-gray-900">{user.department || 'Not specified'}</p>
                    </div>
                    {user.role === 'student' && user.admissionYear && user.graduationYear && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Academic Period</label>
                        <p className="text-lg text-gray-900">
                          {user.admissionYear} - {user.graduationYear}
                        </p>
                        {user.admissionMonth && (
                          <p className="text-xs text-gray-500 mt-1">
                            Started: {new Date(user.admissionYear, user.admissionMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    )}
                    {user.role !== 'faculty' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Year of Study</label>
                        <p className="text-lg text-gray-900">{user.year ? `${user.year}${user.year === 1 ? 'st' : user.year === 2 ? 'nd' : user.year === 3 ? 'rd' : 'th'} Year` : 'Not specified'}</p>
                        {user.role === 'student' && user.admissionMonth && user.admissionYear && (
                          <p className="text-xs text-gray-500 mt-1">Automatically calculated from admission date</p>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Registration ID</label>
                      <p className="text-lg text-gray-900">{user.regId || 'Not specified'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
                      <p className="text-gray-600">Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</p>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </button>
                  </div>
                </div>

                {/* Manual Year Update Section (Students Only) */}
                {user.role === 'student' && (
                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Update Year of Study</h3>
                        <p className="text-gray-600">Manually override your current year if needed (e.g., gap year, course extension)</p>
                      </div>
                      <button
                        onClick={() => setShowManualYearUpdate(!showManualYearUpdate)}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>{showManualYearUpdate ? 'Cancel' : 'Update Year'}</span>
                      </button>
                    </div>

                    {showManualYearUpdate && (
                      <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                        <p className="text-sm text-gray-700 mb-4">
                          Current Year: <strong>{user.year ? `${user.year}${user.year === 1 ? 'st' : user.year === 2 ? 'nd' : user.year === 3 ? 'rd' : 'th'} Year` : 'Not set'}</strong>
                        </p>
                        <p className="text-sm text-gray-600 mb-4">
                          Select your correct year if the automatic calculation is wrong:
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                          {[1, 2, 3, 4].map(year => (
                            <button
                              key={year}
                              onClick={() => handleManualYearUpdate(year)}
                              disabled={loading || user.year === year}
                              className={`px-4 py-3 rounded-lg font-medium transition-all ${
                                user.year === year
                                  ? 'bg-purple-600 text-white cursor-not-allowed'
                                  : 'bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-600 hover:text-white'
                              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {year}{year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Password Change Section */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Password & Security</h3>
                      <p className="text-gray-600">Update your password to keep your account secure</p>
                    </div>
                    <button
                      onClick={() => setShowPasswordChange(!showPasswordChange)}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{showPasswordChange ? 'Cancel' : 'Change Password'}</span>
                    </button>
                  </div>

                  {showPasswordChange && (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4 bg-gray-50 p-6 rounded-lg border">
                      {/* Current Password */}
                      <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                          Current Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            id="currentPassword"
                            name="currentPassword"
                            type={showPasswords.current ? 'text' : 'password'}
                            required
                            value={passwordData.currentPassword}
                            onChange={handlePasswordInputChange}
                            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Enter your current password"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('current')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            id="newPassword"
                            name="newPassword"
                            type={showPasswords.new ? 'text' : 'password'}
                            required
                            value={passwordData.newPassword}
                            onChange={handlePasswordInputChange}
                            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Enter your new password (min 6 characters)"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('new')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm New Password */}
                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showPasswords.confirm ? 'text' : 'password'}
                            required
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordInputChange}
                            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Confirm your new password"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility('confirm')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <div className="flex justify-end space-x-4 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordChange(false);
                            setPasswordData({
                              currentPassword: '',
                              newPassword: '',
                              confirmPassword: ''
                            });
                          }}
                          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={passwordLoading}
                          className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Lock className="w-4 h-4" />
                          <span>{passwordLoading ? 'Changing...' : 'Change Password'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Profile;
