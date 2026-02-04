import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { DEFAULT_COLLEGE } from '../config/college';
import {
  User as UserIcon,
  Mail as MailIcon,
  Lock as LockIcon,
  Phone,
  Briefcase,
  X,
  Clock,
  ChevronDown,
  Building2,
  Users,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';

interface User {
  _id: string;
  name: string;
  email: string;
  department: string;
  section: string;
  roomNo?: string;
  mobile: string;
  year: string;
  regId: string;
  avatar?: string;
  role: 'admin' | 'user' | 'organizer' | 'faculty' | 'student';
  createdAt?: string;
  admissionMonth?: number;
  admissionYear?: number;
  graduationYear?: number;
  lateralEntry?: boolean;
  accountStatus?: 'pending' | 'approved' | 'rejected';
  college?: string;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  department: string;
  section: string;
  roomNo?: string;
  mobile: string;
  year: string;
  regId: string;
  role: 'admin' | 'user' | 'organizer' | 'faculty' | 'student';
  admissionMonth?: number;
  admissionYear?: number;
  graduationYear?: number;
  lateralEntry?: boolean;
  college?: string;
}

interface EditUserData {
  name: string;
  email: string;
  department: string;
  section: string;
  roomNo?: string;
  mobile: string;
  year: string;
  regId: string;
  role: 'admin' | 'user' | 'organizer' | 'faculty' | 'student';
  admissionMonth?: number;
  admissionYear?: number;
  graduationYear?: number;
  lateralEntry?: boolean;
  college?: string;
}

const AdminUsers: React.FC = () => {
  const { user } = useAuth();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab state for My College / Other Colleges
  const [activeTab, setActiveTab] = useState<'myCollege' | 'otherColleges'>('myCollege');
  
  // Bulk delete state for other colleges
  const [selectedOtherCollegeUsers, setSelectedOtherCollegeUsers] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  
  // Registration approval settings
  const [requireApproval, setRequireApproval] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loadingApproval, setLoadingApproval] = useState(false);
  const [showPendingSection, setShowPendingSection] = useState(true);
  
  const [createForm, setCreateForm] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    department: '',
    section: '',
    roomNo: '',
    mobile: '',
    year: '',
    regId: '',
    role: 'student',
    admissionMonth: 7,
    admissionYear: new Date().getFullYear(),
    graduationYear: new Date().getFullYear() + 4,
    lateralEntry: false,
    college: DEFAULT_COLLEGE
  });
  
  const [editForm, setEditForm] = useState<EditUserData>({
    name: '',
    email: '',
    department: '',
    section: '',
    roomNo: '',
    mobile: '',
    year: '',
    regId: '',
    role: 'student',
    admissionMonth: 7,
    admissionYear: new Date().getFullYear(),
    graduationYear: new Date().getFullYear() + 4,
    lateralEntry: false,
    college: ''
  });
  
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const { addToast } = useToast();

  // Toast notification helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    addToast({
      type,
      title: type === 'success' ? 'Success' : 'Error',
      message,
    });
  };

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (response.ok) {
        setUsers(data.users);
      } else {
        showToast(data.error || 'Failed to fetch users', 'error');
      }
    } catch (_error) {
      showToast('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch admin settings (registration approval toggle)
  const fetchAdminSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      if (response.ok) {
        setRequireApproval(data.requireRegistrationApproval || false);
      }
    } catch (_error) {
      console.error('Failed to fetch admin settings');
    }
  };

  // Fetch pending users
  const fetchPendingUsers = async () => {
    try {
      const response = await fetch('/api/admin/users/pending');
      const data = await response.json();
      if (response.ok) {
        setPendingUsers(data.users || []);
      }
    } catch (_error) {
      console.error('Failed to fetch pending users');
    }
  };

  // Toggle registration approval setting
  const toggleApprovalSetting = async () => {
    if (!user) return;
    setLoadingApproval(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user._id || user.id,
          requireRegistrationApproval: !requireApproval 
        })
      });
      const data = await response.json();
      if (response.ok) {
        setRequireApproval(!requireApproval);
        showToast(`Registration approval ${!requireApproval ? 'enabled' : 'disabled'}`, 'success');
      } else {
        showToast(data.error || 'Failed to update setting', 'error');
      }
    } catch (_error) {
      showToast('Failed to update setting', 'error');
    } finally {
      setLoadingApproval(false);
    }
  };

  // Approve a user
  const handleApproveUser = async (userId: string) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user._id || user.id })
      });
      const data = await response.json();
      if (response.ok) {
        showToast('User approved successfully', 'success');
        fetchPendingUsers();
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to approve user', 'error');
      }
    } catch (_error) {
      showToast('Failed to approve user', 'error');
    }
  };

  // Reject a user
  const handleRejectUser = async (userId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to reject this user? They will not be able to login.')) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user._id || user.id })
      });
      const data = await response.json();
      if (response.ok) {
        showToast('User rejected', 'success');
        fetchPendingUsers();
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to reject user', 'error');
      }
    } catch (_error) {
      showToast('Failed to reject user', 'error');
    }
  };

  // Bulk approve all pending users
  const handleBulkApprove = async () => {
    if (!user) return;
    if (pendingUsers.length === 0) return;
    if (!confirm(`Are you sure you want to approve all ${pendingUsers.length} pending users?`)) {
      return;
    }
    try {
      const userIds = pendingUsers.map(u => u._id);
      const response = await fetch('/api/admin/users/bulk-approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, adminId: user._id || user.id })
      });
      const data = await response.json();
      if (response.ok) {
        showToast(`Approved ${data.approvedCount} users`, 'success');
        fetchPendingUsers();
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to bulk approve', 'error');
      }
    } catch (_error) {
      showToast('Failed to bulk approve', 'error');
    }
  };

  // Bulk delete other college users
  const handleBulkDeleteOtherCollegeUsers = async () => {
    if (!user) return;
    if (selectedOtherCollegeUsers.length === 0) {
      showToast('No users selected for deletion', 'error');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedOtherCollegeUsers.length} user(s) from other colleges? This action cannot be undone.`)) {
      return;
    }
    
    setBulkDeleteLoading(true);
    try {
      const response = await fetch('/api/admin/users/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userIds: selectedOtherCollegeUsers, 
          adminId: user._id || user.id 
        })
      });
      const data = await response.json();
      
      if (response.ok) {
        showToast(`Successfully deleted ${data.deletedCount} user(s)`, 'success');
        setSelectedOtherCollegeUsers([]);
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to delete users', 'error');
      }
    } catch (_error) {
      showToast('Failed to delete users', 'error');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Toggle single user selection for bulk delete
  const toggleUserSelection = (userId: string) => {
    setSelectedOtherCollegeUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Select/Deselect all other college users
  const toggleSelectAllOtherCollegeUsers = (otherCollegeUsers: User[]) => {
    const allIds = otherCollegeUsers.map(u => u._id);
    const allSelected = allIds.every(id => selectedOtherCollegeUsers.includes(id));
    
    if (allSelected) {
      setSelectedOtherCollegeUsers([]);
    } else {
      setSelectedOtherCollegeUsers(allIds);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAdminSettings();
    fetchPendingUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if user is admin (after hooks)
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Create new user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (createForm.password.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }
    // Validation similar to Register page
    if (!createForm.name.trim()) { showToast('Full Name Required', 'error'); return; }
    if (!createForm.email.trim()) { showToast('Email Required', 'error'); return; }
    if (!createForm.department.trim()) { showToast('Department Required', 'error'); return; }
    if (createForm.role === 'student' && (!createForm.year || isNaN(Number(createForm.year)) || Number(createForm.year) < 1 || Number(createForm.year) > 4)) { showToast('Please select a valid year (1-4)', 'error'); return; }
    if (createForm.role === 'student' && !createForm.section.trim()) { showToast('Section Required', 'error'); return; }
    if (createForm.role === 'faculty' && !(createForm as any).roomNo?.trim()) { showToast('Room No Required', 'error'); return; }
    if (!createForm.mobile.trim() || !/^\d{10}$/.test(createForm.mobile)) { showToast('Please enter a valid 10-digit mobile number', 'error'); return; }
    if ((createForm.role === 'student' || createForm.role === 'faculty') && !createForm.regId.trim()) { showToast('Registration ID Required', 'error'); return; }
    
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...createForm,
            // don't send year for faculty or admin roles
            year: createForm.role === 'faculty' || createForm.role === 'admin' ? undefined as unknown as string : createForm.year,
            roomNo: (createForm as any).roomNo,
            // include college name
            college: createForm.college || DEFAULT_COLLEGE,
          })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('User created successfully', 'success');
        setShowCreateForm(false);
        setCreateForm({
          name: '',
          email: '',
          password: '',
          department: '',
          section: '',
          mobile: '',
          year: '',
          regId: '',
          role: 'user',
          college: DEFAULT_COLLEGE
        });
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to create user', 'error');
      }
    } catch (error) {
      showToast('Failed to create user', 'error');
    }
  };

  // Edit user
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;
    // Validation similar to Register page for edits
    if (!editForm.name.trim()) { showToast('Full Name Required', 'error'); return; }
    if (!editForm.email.trim()) { showToast('Email Required', 'error'); return; }
    if (!editForm.department.trim()) { showToast('Department Required', 'error'); return; }
    if (editForm.role === 'student' && (!editForm.year || isNaN(Number(editForm.year)) || Number(editForm.year) < 1 || Number(editForm.year) > 4)) { showToast('Please select a valid year (1-4)', 'error'); return; }
    if (editForm.role === 'student' && !editForm.section.trim()) { showToast('Section Required', 'error'); return; }
    if (editForm.role === 'faculty' && !(editForm as any).roomNo?.trim()) { showToast('Room No Required', 'error'); return; }
    if (!editForm.mobile.trim() || !/^\d{10}$/.test(editForm.mobile)) { showToast('Please enter a valid 10-digit mobile number', 'error'); return; }
    if ((editForm.role === 'student' || editForm.role === 'faculty') && !editForm.regId.trim()) { showToast('Registration ID Required', 'error'); return; }
    
    try {
      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...editForm,
            // don't send year for faculty or admin roles
            year: editForm.role === 'faculty' || editForm.role === 'admin' ? undefined as unknown as string : editForm.year,
            roomNo: (editForm as any).roomNo,
            // include admission details for students
            admissionMonth: editForm.role === 'student' ? editForm.admissionMonth : undefined,
            admissionYear: editForm.role === 'student' ? editForm.admissionYear : undefined,
            graduationYear: editForm.role === 'student' ? editForm.graduationYear : undefined,
            lateralEntry: editForm.role === 'student' ? editForm.lateralEntry : undefined,
            // include college name
            college: editForm.college,
          })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('User updated successfully', 'success');
        setShowEditForm(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to update user', 'error');
      }
    } catch (error) {
      showToast('Failed to update user', 'error');
    }
  };

  // Change user password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/user/${selectedUser._id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: passwordForm.newPassword })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('Password changed successfully', 'success');
        setShowPasswordForm(false);
        setSelectedUser(null);
        setPasswordForm({ newPassword: '', confirmPassword: '' });
      } else {
        showToast(data.error || 'Failed to change password', 'error');
      }
    } catch (error) {
      showToast('Failed to change password', 'error');
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/user/${userId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('User deleted successfully', 'success');
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to delete user', 'error');
      }
    } catch (error) {
      showToast('Failed to delete user', 'error');
    }
  };

  // Open edit form
  const openEditForm = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      department: user.department,
      section: user.section,
      roomNo: (user as any).roomNo || '',
      mobile: user.mobile,
      year: user.year,
      regId: user.regId,
      role: user.role,
      admissionMonth: user.admissionMonth || 7,
      admissionYear: user.admissionYear || new Date().getFullYear(),
      graduationYear: user.graduationYear || new Date().getFullYear() + 4,
      lateralEntry: user.lateralEntry || false,
      college: user.college || ''
    });
    setShowEditForm(true);
  };

  // Open password form
  const openPasswordForm = (user: User) => {
    setSelectedUser(user);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowPasswordForm(true);
  };

  // Filter users based on search query
  // Custom regId filter: prefer numbers, then alphabets, then fallback
  let filteredUsers: User[] = [];
  if (searchQuery.trim() !== '') {
    // 1. regId: numbers only
    filteredUsers = users.filter(user =>
      user.regId && user.regId.match(/\d+/) && user.regId.includes(searchQuery)
    );
    // 2. regId: alphabets only (if no number matches)
    if (filteredUsers.length === 0) {
      filteredUsers = users.filter(user =>
        user.regId && user.regId.match(/[a-zA-Z]+/) && user.regId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    // 3. fallback to other fields if still no match
    if (filteredUsers.length === 0) {
      filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.college && user.college.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
  } else {
    filteredUsers = users;
  }

  // Get admin's college (use DEFAULT_COLLEGE if not set)
  const adminCollege = user?.college || DEFAULT_COLLEGE;
  
  // Helper function to normalize college name for comparison
  const normalizeCollege = (college: string): string => {
    return college.toLowerCase().trim().replace(/\s+/g, ' ');
  };
  
  // Check if a college matches our college (handles variations)
  const isMyCollege = (college: string): boolean => {
    if (!college) return false;
    const normalizedAdmin = normalizeCollege(adminCollege);
    const normalizedUser = normalizeCollege(college);
    const normalizedDefault = normalizeCollege(DEFAULT_COLLEGE);
    
    // Match if exactly same as admin's college or default college
    return normalizedUser === normalizedAdmin || normalizedUser === normalizedDefault;
  };
  
  // Separate users into "My College" and "Other Colleges"
  const myCollegeUsers = filteredUsers.filter(u => {
    const userCollege = u.college || '';
    // Users belong to "My College" if their college matches admin's college or DEFAULT_COLLEGE
    return isMyCollege(userCollege);
  });
  
  const otherCollegeUsers = filteredUsers.filter(u => {
    const userCollege = u.college || '';
    // Users belong to "Other Colleges" if they have a college set but it doesn't match
    if (!userCollege) return false; // Users without college go to "My College"
    return !isMyCollege(userCollege);
  });

  // Filter pending users based on search query (same logic)
  let filteredPendingUsers: User[] = [];
  if (searchQuery.trim() !== '') {
    // 1. regId: numbers only
    filteredPendingUsers = pendingUsers.filter(user =>
      user.regId && user.regId.match(/\d+/) && user.regId.includes(searchQuery)
    );
    // 2. regId: alphabets only (if no number matches)
    if (filteredPendingUsers.length === 0) {
      filteredPendingUsers = pendingUsers.filter(user =>
        user.regId && user.regId.match(/[a-zA-Z]+/) && user.regId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    // 3. fallback to other fields if still no match
    if (filteredPendingUsers.length === 0) {
      filteredPendingUsers = pendingUsers.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.college && user.college.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
  } else {
    filteredPendingUsers = pendingUsers;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="min-h-screen bg-gray-50 pt-16 sm:pt-20 pb-20 sm:pb-8 py-4 sm:py-8 px-2 sm:px-4 md:px-6 lg:px-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
            Manage all users in the system. Total: {users.length} users 
            {adminCollege && <span className="ml-1">• Your College: <span className="font-medium">{adminCollege}</span></span>}
          </p>
        </div>

        {/* Registration Approval Settings */}
        <div className="mb-4 sm:mb-6 bg-white shadow rounded-lg p-3 sm:p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Registration Approval</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                When enabled, new registrations require admin approval.
              </p>
            </div>
            <button
              onClick={toggleApprovalSetting}
              disabled={loadingApproval}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                requireApproval ? 'bg-blue-600' : 'bg-gray-200'
              } ${loadingApproval ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  requireApproval ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              requireApproval ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {requireApproval ? 'Manual Approval Required' : 'Auto-Approve New Users'}
            </span>
          </div>
        </div>

        {/* Pending Users Section */}
        {pendingUsers.length > 0 && (
          <div className="mb-4 sm:mb-6 bg-yellow-50 border border-yellow-200 shadow rounded-lg overflow-hidden">
            <div 
              className="p-3 sm:p-4 flex items-center justify-between cursor-pointer"
              onClick={() => setShowPendingSection(!showPendingSection)}
            >
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 rounded-full bg-yellow-100">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base md:text-lg font-semibold text-yellow-800">Pending Users</h2>
                  <p className="text-xs sm:text-sm text-yellow-600">
                    {searchQuery.trim() !== '' 
                      ? `${filteredPendingUsers.length} of ${pendingUsers.length} matching`
                      : `${pendingUsers.length} awaiting approval`
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3">
                {showPendingSection && filteredPendingUsers.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleBulkApprove(); }}
                    className="px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <span className="hidden sm:inline">Approve All</span>
                    <span className="sm:hidden">All</span>
                  </button>
                )}
                <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 transition-transform ${showPendingSection ? 'rotate-180' : ''}`} />
              </div>
            </div>
            
            {showPendingSection && (
              <div className="border-t border-yellow-200">
                {filteredPendingUsers.length > 0 ? (
                <div className="table-responsive">
                <table className="min-w-full divide-y divide-yellow-200">
                  <thead className="bg-yellow-100">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-yellow-800 uppercase">User</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-yellow-800 uppercase hidden sm:table-cell">Contact</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-yellow-800 uppercase hidden lg:table-cell">College</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-yellow-800 uppercase hidden md:table-cell">Details</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-yellow-800 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-yellow-100">
                    {filteredPendingUsers.map((pendingUser) => (
                      <tr key={pendingUser._id} className="hover:bg-yellow-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm sm:text-base font-medium">
                                {pendingUser.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-2 sm:ml-4">
                              <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[100px] sm:max-w-none">{pendingUser.name}</div>
                              <div className="text-xs text-gray-500">ID: {pendingUser.regId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                          <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[150px]">{pendingUser.email}</div>
                          <div className="text-xs text-gray-500">{pendingUser.mobile}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden lg:table-cell">
                          <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[150px]">{pendingUser.college || '-'}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                          <div className="text-xs sm:text-sm text-gray-900">{pendingUser.department}</div>
                          <div className="text-xs text-gray-500">
                            {pendingUser.role === 'faculty' 
                              ? `Room: ${(pendingUser as any).roomNo || '-'}`
                              : `${pendingUser.section || '-'} - Year ${pendingUser.year || '-'}`
                            }
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                            <button
                              onClick={() => handleApproveUser(pendingUser._id)}
                              className="px-2 sm:px-3 py-1 bg-green-600 text-white text-xs sm:text-sm rounded hover:bg-green-700 transition-colors"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => handleRejectUser(pendingUser._id)}
                              className="px-2 sm:px-3 py-1 bg-red-600 text-white text-xs sm:text-sm rounded hover:bg-red-700 transition-colors"
                            >
                              ✗
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                ) : (
                  <div className="p-6 text-center text-yellow-700">
                    No pending users match your search.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search users..."
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-3 sm:px-6 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap flex-shrink-0"
          >
            <span className="hidden sm:inline">+ New User</span>
            <span className="sm:hidden">+ Add</span>
          </button>
        </div>

        {/* Tabs for My College / Other Colleges */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => {
                setActiveTab('myCollege');
                setSelectedOtherCollegeUsers([]);
              }}
              className={`flex-1 min-w-[120px] sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                activeTab === 'myCollege'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">My College</span>
              <span className="xs:hidden">Mine</span>
              <span className={`ml-1 px-1.5 sm:px-2 py-0.5 text-xs rounded-full ${
                activeTab === 'myCollege' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {myCollegeUsers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('otherColleges')}
              className={`flex-1 min-w-[120px] sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                activeTab === 'otherColleges'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Other Colleges</span>
              <span className="xs:hidden">Others</span>
              <span className={`ml-1 px-1.5 sm:px-2 py-0.5 text-xs rounded-full ${
                activeTab === 'otherColleges' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {otherCollegeUsers.length}
              </span>
            </button>
          </div>
        </div>

        {/* Bulk Delete Controls for Other Colleges */}
        {activeTab === 'otherColleges' && otherCollegeUsers.length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => toggleSelectAllOtherCollegeUsers(otherCollegeUsers)}
                  className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-700 hover:text-gray-900"
                >
                  {otherCollegeUsers.length > 0 && otherCollegeUsers.every(u => selectedOtherCollegeUsers.includes(u._id)) ? (
                    <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                  ) : (
                    <Square className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  )}
                  <span className="hidden sm:inline">Select All</span>
                  <span className="sm:hidden">All</span>
                </button>
                {selectedOtherCollegeUsers.length > 0 && (
                  <span className="text-xs sm:text-sm text-red-600 font-medium">
                    {selectedOtherCollegeUsers.length} selected
                  </span>
                )}
              </div>
              <button
                onClick={handleBulkDeleteOtherCollegeUsers}
                disabled={selectedOtherCollegeUsers.length === 0 || bulkDeleteLoading}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
                  selectedOtherCollegeUsers.length === 0 || bulkDeleteLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {bulkDeleteLoading ? (
                  <>
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Delete Selected</span>
                    <span className="sm:hidden">Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Users Table - My College */}
        {activeTab === 'myCollege' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Contact
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Academic Details
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {myCollegeUsers.map((userData) => (
                  <tr key={userData._id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs sm:text-base font-medium">
                              {userData.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-2 sm:ml-4 min-w-0">
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[80px] sm:max-w-[150px] md:max-w-none">
                            {userData.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[80px] sm:max-w-[150px] md:max-w-none">
                            ID: {userData.regId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[120px] md:max-w-[200px]">{userData.email}</div>
                      <div className="text-xs text-gray-500">{userData.mobile}</div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap hidden lg:table-cell">
                      <div className="text-sm text-gray-900">{userData.department}</div>
                      <div className="text-xs text-gray-500">
                        {userData.role === 'faculty' ? (
                          <>
                            Room: {(userData as any).roomNo || '-'}
                          </>
                        ) : (
                          <>
                            {userData.section} - Year {userData.year}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full ${
                          userData.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800'
                            : userData.role === 'organizer'
                            ? 'bg-blue-100 text-blue-800'
                            : userData.role === 'faculty'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {userData.role}
                        </span>
                        {userData.accountStatus === 'pending' && (
                          <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            Pending
                          </span>
                        )}
                        {userData.accountStatus === 'rejected' && (
                          <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Rejected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                        <button
                          onClick={() => openEditForm(userData)}
                          className="text-blue-600 hover:text-blue-900 text-xs sm:text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openPasswordForm(userData)}
                          className="text-yellow-600 hover:text-yellow-900 text-xs sm:text-sm"
                        >
                          <span className="hidden sm:inline">Password</span>
                          <span className="sm:hidden">Pass</span>
                        </button>
                        {userData._id !== user._id && (
                          <button
                            onClick={() => handleDeleteUser(userData._id, userData.name)}
                            className="text-red-600 hover:text-red-900 text-xs sm:text-sm"
                          >
                            <span className="hidden sm:inline">Delete</span>
                            <span className="sm:hidden">Del</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {myCollegeUsers.length === 0 && (
            <div className="text-center py-6 sm:py-8">
              <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm sm:text-base">
                {searchQuery ? 'No users found matching your search.' : 'No users from your college found.'}
              </p>
            </div>
          )}
        </div>
        )}

        {/* Users Table - Other Colleges */}
        {activeTab === 'otherColleges' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-purple-50">
                <tr>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider w-8 sm:w-12">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider hidden sm:table-cell">
                    College
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider hidden md:table-cell">
                    Contact
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {otherCollegeUsers.map((userData) => (
                  <tr key={userData._id} className={`hover:bg-gray-50 ${selectedOtherCollegeUsers.includes(userData._id) ? 'bg-red-50' : ''}`}>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleUserSelection(userData._id)}
                        className="p-1"
                      >
                        {selectedOtherCollegeUsers.includes(userData._id) ? (
                          <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                        ) : (
                          <Square className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-purple-500 flex items-center justify-center">
                            <span className="text-white text-xs sm:text-base font-medium">
                              {userData.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-2 sm:ml-4 min-w-0">
                          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[60px] sm:max-w-[100px] md:max-w-[150px]">
                            {userData.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[60px] sm:max-w-[100px] md:max-w-[150px]">
                            ID: {userData.regId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-xs sm:text-sm text-purple-700 font-medium truncate max-w-[100px] md:max-w-[150px]">
                        {userData.college || 'Not specified'}
                      </div>
                      <div className="text-xs text-gray-500">{userData.department}</div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-xs sm:text-sm text-gray-900 truncate max-w-[150px]">{userData.email}</div>
                      <div className="text-xs text-gray-500">{userData.mobile}</div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full ${
                        userData.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800'
                          : userData.role === 'organizer'
                          ? 'bg-blue-100 text-blue-800'
                          : userData.role === 'faculty'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {userData.role}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                        <button
                          onClick={() => openEditForm(userData)}
                          className="text-blue-600 hover:text-blue-900 text-xs sm:text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(userData._id, userData.name)}
                          className="text-red-600 hover:text-red-900 text-xs sm:text-sm"
                        >
                          <span className="hidden sm:inline">Delete</span>
                          <span className="sm:hidden">Del</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {otherCollegeUsers.length === 0 && (
            <div className="text-center py-6 sm:py-8">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm sm:text-base">
                {searchQuery ? 'No users from other colleges match your search.' : 'No users from other colleges found.'}
              </p>
            </div>
          )}
        </div>
        )}

        {/* Create User Modal */}
        {showCreateForm && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="w-full max-w-xl bg-white/70 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-900 overflow-hidden max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl px-6 py-5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-white/20">
                      <UserIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white drop-shadow-lg">Create New User</h3>
                      <p className="text-sm text-blue-100">Add a new user to EventHub with role specific details</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCreateForm(false)} className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 px-8 py-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><UserIcon className="w-4 h-4" /></div>
                    <input
                      className="pl-10 pr-3 py-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={createForm.name}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><MailIcon className="w-4 h-4" /></div>
                    <input
                      type="email"
                      className="pl-10 pr-3 py-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Password *</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><LockIcon className="w-4 h-4" /></div>
                    <input
                      type="password"
                      minLength={6}
                      className="pl-10 pr-3 py-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">Password must be at least 6 characters.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Registration ID *</label>
                  <input
                    className="pr-3 py-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={createForm.regId}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, regId: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">College Name *</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Building2 className="w-4 h-4" /></div>
                    <input
                      className="pl-10 pr-3 py-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={createForm.college || ''}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, college: e.target.value }))}
                      placeholder="Enter college name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Department *</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Briefcase className="w-4 h-4" /></div>
                    <input
                      className="pl-10 pr-3 py-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={createForm.department}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, department: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mobile *</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Phone className="w-4 h-4" /></div>
                    <input
                      className="pl-10 pr-3 py-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={createForm.mobile}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, mobile: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* Role specific */}
                {createForm.role === 'student' && (
                  <>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Section *</label>
                        <input
                          className="px-4 py-3 w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white"
                          value={createForm.section}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, section: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Year *</label>
                        <select
                          className="px-4 py-3 w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white"
                          value={createForm.year}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, year: e.target.value }))}
                          required
                        >
                          <option value="1">1st Year</option>
                          <option value="2">2nd Year</option>
                          <option value="3">3rd Year</option>
                          <option value="4">4th Year</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Admission Month</label>
                        <select
                          className="px-4 py-3 w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white"
                          value={createForm.admissionMonth || 7}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, admissionMonth: parseInt(e.target.value) }))}
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
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Admission Year</label>
                        <input
                          type="number"
                          min={1990}
                          max={new Date().getFullYear() + 10}
                          className="px-4 py-3 w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white"
                          value={createForm.admissionYear || new Date().getFullYear()}
                          onChange={(e) => {
                            const admissionYear = parseInt(e.target.value) || new Date().getFullYear();
                            setCreateForm((prev) => {
                              const totalYears = prev.lateralEntry ? 3 : 4;
                              const calculatedGraduationYear = admissionYear + totalYears;
                              return {
                                ...prev,
                                admissionYear,
                                graduationYear: calculatedGraduationYear
                              };
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Expected Graduation Year</label>
                        <input
                          type="number"
                          min={createForm.admissionYear || 1990}
                          max={(createForm.admissionYear || new Date().getFullYear()) + 4}
                          className="px-4 py-3 w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white"
                          value={createForm.graduationYear || new Date().getFullYear() + 4}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, graduationYear: parseInt(e.target.value) }))}
                        />
                        <p className="mt-1 text-xs text-blue-500">
                          {createForm.lateralEntry
                            ? `Auto-calculated: ${createForm.admissionYear || new Date().getFullYear()} + 3 years (lateral entry)`
                            : `Auto-calculated: ${createForm.admissionYear || new Date().getFullYear()} + 4 years`}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="lateralEntry"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                          checked={createForm.lateralEntry || false}
                          onChange={(e) => {
                            const isLateral = e.target.checked;
                            setCreateForm((prev) => {
                              const admissionYear = prev.admissionYear || new Date().getFullYear();
                              const totalYears = isLateral ? 3 : 4;
                              const calculatedGraduationYear = admissionYear + totalYears;
                              return {
                                ...prev,
                                lateralEntry: isLateral,
                                graduationYear: calculatedGraduationYear
                              };
                            });
                          }}
                        />
                        <label htmlFor="lateralEntry" className="ml-2 block text-sm text-blue-700 dark:text-blue-300">
                          Lateral Entry (joined in 2nd year)
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {createForm.role === 'faculty' && (
                  <div className="col-span-2 space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Room No *</label>
                    <input
                      className="pr-3 py-2 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={(createForm as any).roomNo || ''}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, roomNo: e.target.value }))}
                      required
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role *</label>
                  <select
                    className="mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white py-2 px-3"
                    value={createForm.role}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as 'admin' | 'user' | 'organizer' | 'faculty' | 'student' }))}
                    required
                  >
                    <option value="student">Student</option>
                    <option value="organizer">Organizer</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="col-span-2 flex justify-end space-x-3 mt-2">
                  <button type="button" onClick={() => setShowCreateForm(false)} className="px-5 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">Cancel</button>
                  <button type="submit" className="px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">Create User</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditForm && selectedUser && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-900 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl px-6 py-5 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                    Edit User: {selectedUser.name}
                  </h2>
                  <button type="button" onClick={() => setShowEditForm(false)} className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
                <form onSubmit={handleEditUser} className="space-y-5 px-6 py-6">
                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Registration ID *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                    value={editForm.regId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, regId: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">College Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                    value={editForm.college || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, college: e.target.value }))}
                    placeholder="Enter college name"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Department *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                      value={editForm.department}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">{editForm.role === 'faculty' ? 'Room No *' : 'Section'}</label>
                    <input
                      type="text"
                      required={editForm.role === 'faculty'}
                      className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                      value={(editForm.role === 'faculty' ? (editForm as any).roomNo : editForm.section) || ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, ...(prev.role === 'faculty' ? { roomNo: e.target.value } : { section: e.target.value }) }))}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {editForm.role === 'student' && (
                    <div>
                      <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Year *</label>
                      <select
                        required
                        className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                        value={editForm.year}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, year: e.target.value }))}
                      >
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Mobile *</label>
                    <input
                      type="tel"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                      value={editForm.mobile}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, mobile: e.target.value }))}
                    />
                  </div>
                </div>
                
                {/* Admission Fields for Students */}
                {editForm.role === 'student' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Admission Month
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          value={editForm.admissionMonth || 7}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, admissionMonth: parseInt(e.target.value) }))}
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
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Admission Year
                        </label>
                        <input
                          type="number"
                          min={1990}
                          max={new Date().getFullYear() + 10}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          value={editForm.admissionYear || new Date().getFullYear()}
                          onChange={(e) => {
                            const admissionYear = parseInt(e.target.value) || new Date().getFullYear();
                            setEditForm((prev) => {
                              // Lateral entry students join in 2nd year, so they need 3 more years (2nd, 3rd, 4th)
                              const totalYears = prev.lateralEntry ? 3 : 4;
                              const calculatedGraduationYear = admissionYear + totalYears;
                              return { 
                                ...prev, 
                                admissionYear,
                                graduationYear: calculatedGraduationYear
                              };
                            });
                          }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Expected Graduation Year
                      </label>
                      <input
                        type="number"
                        min={editForm.admissionYear || 1990}
                        max={(editForm.admissionYear || new Date().getFullYear()) + 4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        value={editForm.graduationYear || new Date().getFullYear() + 4}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, graduationYear: parseInt(e.target.value) }))}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {editForm.lateralEntry 
                          ? `Auto-calculated: ${editForm.admissionYear || new Date().getFullYear()} + 3 years (lateral entry)`
                          : `Auto-calculated: ${editForm.admissionYear || new Date().getFullYear()} + 4 years`
                        }
                      </p>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="lateralEntry"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={editForm.lateralEntry || false}
                        onChange={(e) => {
                          const isLateral = e.target.checked;
                          setEditForm((prev) => {
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
                      />
                      <label htmlFor="lateralEntry" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Lateral Entry (joined in 2nd year)
                      </label>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role *
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={editForm.role}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as 'admin' | 'user' | 'organizer' | 'faculty' | 'student' }))}
                  >
                    <option value="student">Student</option>
                    <option value="organizer">Organizer</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Update User
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditForm(false);
                      setSelectedUser(null);
                    }}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showPasswordForm && selectedUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Change Password for: {selectedUser.name}
              </h2>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
                  >
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setSelectedUser(null);
                      setPasswordForm({ newPassword: '', confirmPassword: '' });
                    }}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminUsers;
