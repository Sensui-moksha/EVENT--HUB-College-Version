import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { 
  Megaphone, 
  Send, 
  AlertCircle,
  Users,
  MessageSquare,
  Sparkles,
  User,
  Search,
  X,
  Check,
  Mail,
  UserCheck,
  Globe,
  Loader2,
  Building2
} from 'lucide-react';
import { pageVariants } from '../utils/animations';

interface UserType {
  _id: string;
  name: string;
  email: string;
  role: string;
}

const SendAnnouncement: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [sending, setSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState<string>('');
  
  // Recipient selection
  const [recipientType, setRecipientType] = useState<'everyone' | 'college' | 'selected'>('everyone');
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [totalUserCount, setTotalUserCount] = useState(0);
  const [collegeUserCount, setCollegeUserCount] = useState(0);
  const userCollege = (user as any)?.college || '';

  // Fetch all users for selection
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          // Handle both array and object with users property
          const usersArray = Array.isArray(data) ? data : (data.users || []);
          setAllUsers(usersArray);
          setTotalUserCount(usersArray.length);
          // Count users from same college
          const collegeUsers = usersArray.filter((u: UserType & { college?: string }) => 
            u.college && userCollege && u.college.toLowerCase() === userCollege.toLowerCase()
          );
          setCollegeUserCount(collegeUsers.length);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setAllUsers([]);
        setTotalUserCount(0);
      } finally {
        setLoadingUsers(false);
      }
    };
    
    if (user?.role === 'admin' || user?.role === 'organizer') {
      fetchUsers();
    }
  }, [user?.role]);

  // Filter users based on search
  const filteredUsers = Array.isArray(allUsers) ? allUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredUsers.map(u => u._id);
    setSelectedUsers(prev => {
      const newSelected = [...prev];
      filteredIds.forEach(id => {
        if (!newSelected.includes(id)) {
          newSelected.push(id);
        }
      });
      return newSelected;
    });
  };

  const deselectAll = () => {
    setSelectedUsers([]);
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      addToast({
        type: 'error',
        title: 'Missing Information',
        message: 'Please enter both title and message.',
      });
      return;
    }

    if (recipientType === 'selected' && selectedUsers.length === 0) {
      addToast({
        type: 'error',
        title: 'No Recipients',
        message: 'Please select at least one user to send the announcement.',
      });
      return;
    }

    setSending(true);
    
    // Calculate target user count for progress display
    const targetCount = recipientType === 'everyone' 
      ? totalUserCount 
      : recipientType === 'college' 
        ? collegeUserCount 
        : selectedUsers.length;
    
    setSendingProgress(`Sending mails to ${targetCount} users...`);
    
    try {
      const endpoint = recipientType === 'everyone' 
        ? '/api/notifications/broadcast'
        : '/api/notifications/broadcast/targeted';
      
      // For college-only, get user IDs from that college
      let targetIds = selectedUsers;
      if (recipientType === 'college') {
        targetIds = allUsers
          .filter((u: UserType & { college?: string }) => 
            u.college && userCollege && u.college.toLowerCase() === userCollege.toLowerCase()
          )
          .map(u => u._id);
      }
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          title: title.trim(),
          message: message.trim(),
          priority: priority,
          ...((recipientType === 'selected' || recipientType === 'college') && { targetUserIds: targetIds })
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addToast({
          type: 'success',
          title: 'Announcement Sent! 🎉',
          message: `Sent to ${data.count} user${data.count !== 1 ? 's' : ''} • ${data.emailsSent || 0} email${(data.emailsSent || 0) !== 1 ? 's' : ''} delivered`,
        });
        // Clear form
        setTitle('');
        setMessage('');
        setPriority('normal');
        setSelectedUsers([]);
        setRecipientType('everyone');
      } else {
        throw new Error('Failed to send announcement');
      }
    } catch (error) {
      console.error('Error sending announcement:', error);
      addToast({
        type: 'error',
        title: 'Send Failed',
        message: 'Could not send announcement. Please try again.',
      });
    } finally {
      setSending(false);
      setSendingProgress('');
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'organizer') {
    return (
      <motion.div
        className="min-h-screen pt-20 pb-8 px-4"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only admins and organizers can send announcements.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 pt-20 pb-24 px-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4 shadow-lg">
            <Megaphone className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Send Announcement
          </h1>
          <p className="text-gray-600 text-lg">
            Broadcast important messages to users
          </p>
        </motion.div>

        {/* Recipient Type Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Everyone Option */}
            <button
              type="button"
              onClick={() => setRecipientType('everyone')}
              className={`p-5 rounded-2xl border-2 transition-all text-left ${
                recipientType === 'everyone'
                  ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-500/20'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  recipientType === 'everyone' ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-600'
                }`}>
                  <Globe className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${recipientType === 'everyone' ? 'text-purple-900' : 'text-gray-900'}`}>
                      Reach Everyone
                    </h3>
                    {recipientType === 'everyone' && (
                      <Check className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Send to all registered users
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-full">
                      <Users className="w-4 h-4" />
                      {totalUserCount} users
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full">
                      <Mail className="w-4 h-4" />
                      + Email
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* My College Only Option */}
            <button
              type="button"
              onClick={() => setRecipientType('college')}
              className={`p-5 rounded-2xl border-2 transition-all text-left ${
                recipientType === 'college'
                  ? 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/20'
                  : 'border-gray-200 bg-white hover:border-amber-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  recipientType === 'college' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600'
                }`}>
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${recipientType === 'college' ? 'text-amber-900' : 'text-gray-900'}`}>
                      My College Only
                    </h3>
                    {recipientType === 'college' && (
                      <Check className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate" title={userCollege || 'Your college'}>
                    {userCollege ? (userCollege.length > 25 ? userCollege.substring(0, 25) + '...' : userCollege) : 'Your college students'}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-full">
                      <Users className="w-4 h-4" />
                      {collegeUserCount} users
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full">
                      <Mail className="w-4 h-4" />
                      + Email
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Selected Users Option */}
            <button
              type="button"
              onClick={() => setRecipientType('selected')}
              className={`p-5 rounded-2xl border-2 transition-all text-left ${
                recipientType === 'selected'
                  ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  recipientType === 'selected' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
                }`}>
                  <UserCheck className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${recipientType === 'selected' ? 'text-blue-900' : 'text-gray-900'}`}>
                      Select Recipients
                    </h3>
                    {recipientType === 'selected' && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose specific users to notify
                  </p>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium rounded-full">
                      <User className="w-4 h-4" />
                      {selectedUsers.length} selected
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </motion.div>

        {/* User Selection Panel (shown when 'selected' is chosen) */}
        <AnimatePresence>
          {recipientType === 'selected' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Select Users
                    <span className="text-sm font-normal text-gray-500">
                      ({selectedUsers.length} of {allUsers.length} selected)
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Selected Users Tags */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4 p-3 bg-blue-50 rounded-xl">
                    {selectedUsers.slice(0, 10).map(userId => {
                      const u = allUsers.find(user => user._id === userId);
                      return u ? (
                        <span
                          key={userId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-sm rounded-full shadow-sm"
                        >
                          {u.name}
                          <button
                            type="button"
                            onClick={() => toggleUserSelection(userId)}
                            className="hover:bg-blue-100 rounded-full p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ) : null;
                    })}
                    {selectedUsers.length > 10 && (
                      <span className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                        +{selectedUsers.length - 10} more
                      </span>
                    )}
                  </div>
                )}

                {/* User List */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <span className="ml-2 text-gray-600">Loading users...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No users found</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filteredUsers.map(u => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => toggleUserSelection(u._id)}
                          className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors ${
                            selectedUsers.includes(u._id) ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                            selectedUsers.includes(u._id)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-medium text-gray-900">{u.name}</div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              u.role === 'organizer' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {u.role}
                            </span>
                            {selectedUsers.includes(u._id) && (
                              <Check className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Announcement Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200"
        >
          <form onSubmit={handleSendAnnouncement} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Announcement Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Important: System Maintenance Schedule"
                maxLength={100}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">Keep it clear and concise</p>
                <p className="text-xs text-gray-400">{title.length}/100</p>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement message here. Be clear and informative..."
                rows={6}
                maxLength={500}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all resize-none"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  <MessageSquare className="w-3 h-3 inline mr-1" />
                  This message will appear in user notifications
                </p>
                <p className="text-xs text-gray-400">{message.length}/500</p>
              </div>
            </div>

            {/* Priority Level */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Importance Level
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'low', label: 'Low', color: 'gray', icon: '📌', desc: 'General info' },
                  { value: 'normal', label: 'Normal', color: 'blue', icon: '📢', desc: 'Regular update' },
                  { value: 'high', label: 'High', color: 'orange', icon: '⚠️', desc: 'Important' },
                  { value: 'urgent', label: 'Urgent', color: 'red', icon: '🚨', desc: 'Critical' },
                ].map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setPriority(level.value as any)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      priority === level.value
                        ? level.color === 'gray'
                          ? 'border-gray-400 bg-gray-50 shadow-md'
                          : level.color === 'blue'
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : level.color === 'orange'
                          ? 'border-orange-500 bg-orange-50 shadow-md'
                          : 'border-red-500 bg-red-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{level.icon}</div>
                    <div className={`font-semibold mb-0.5 ${
                      priority === level.value
                        ? level.color === 'gray'
                          ? 'text-gray-900'
                          : level.color === 'blue'
                          ? 'text-blue-900'
                          : level.color === 'orange'
                          ? 'text-orange-900'
                          : 'text-red-900'
                        : 'text-gray-700'
                    }`}>
                      {level.label}
                    </div>
                    <div className="text-xs text-gray-500">{level.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {(title || message) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200"
              >
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Preview
                </h4>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    {title && <h5 className="font-semibold text-gray-900 flex-1">{title}</h5>}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      priority === 'urgent'
                        ? 'bg-red-100 text-red-700'
                        : priority === 'high'
                        ? 'bg-orange-100 text-orange-700'
                        : priority === 'normal'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {priority.toUpperCase()}
                    </span>
                  </div>
                  {message && <p className="text-sm text-gray-600">{message}</p>}
                </div>
              </motion.div>
            )}

            {/* Recipient Summary */}
            <div className={`rounded-xl p-4 border ${
              recipientType === 'everyone' 
                ? 'bg-purple-50 border-purple-200' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                {recipientType === 'everyone' ? (
                  <Globe className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <UserCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className={`font-semibold text-sm mb-1 ${
                    recipientType === 'everyone' ? 'text-purple-900' : 'text-blue-900'
                  }`}>
                    {recipientType === 'everyone' 
                      ? `Broadcasting to ${totalUserCount} users`
                      : `Sending to ${selectedUsers.length} selected user${selectedUsers.length !== 1 ? 's' : ''}`
                    }
                  </h4>
                  <p className={`text-xs ${
                    recipientType === 'everyone' ? 'text-purple-700' : 'text-blue-700'
                  }`}>
                    {recipientType === 'everyone'
                      ? 'All registered users will receive this announcement via notification and email.'
                      : 'Only the selected users will receive this announcement via notification and email.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <motion.button
                type="submit"
                disabled={sending || !title.trim() || !message.trim() || (recipientType === 'selected' && selectedUsers.length === 0)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{sendingProgress || 'Sending...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send to {
                      recipientType === 'everyone' 
                        ? `${totalUserCount} Users` 
                        : recipientType === 'college'
                          ? `${collegeUserCount} College Users`
                          : `${selectedUsers.length} User${selectedUsers.length !== 1 ? 's' : ''}`
                    }</span>
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-white rounded-xl shadow-md p-6 border border-gray-200"
        >
          <h3 className="font-semibold text-gray-900 mb-3">📝 Best Practices</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <span>Use <strong>Reach Everyone</strong> for general announcements that apply to all users</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <span>Use <strong>Select Recipients</strong> for targeted messages to specific users or groups</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <span>Keep messages concise and include all relevant details</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <span>Set appropriate importance level: <strong>Urgent</strong> for critical updates, <strong>Normal</strong> for regular info</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">•</span>
              <span>Users will receive both in-app notifications and emails</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SendAnnouncement;
