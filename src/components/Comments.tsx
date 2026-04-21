import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Send, Reply, Clock } from 'lucide-react';
import { Comment as CommentType } from '../types';
import { API_BASE_URL } from '../utils/api';

interface CommentsProps {
  eventId: string;
  eventStatus?: string; // Add event status to check if comments should be disabled
}

const Comments: React.FC<CommentsProps> = ({ eventId, eventStatus }) => {
  const { user } = useAuth();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // Check if comments are disabled (event completed or cancelled)
  const commentsDisabled = eventStatus === 'completed' || eventStatus === 'cancelled';

  useEffect(() => {
    fetchComments();
  }, [eventId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/comments`);
      const data = await response.json();
      // Ensure data is an array
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !user) return;

    setPosting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          content: newComment,
          parentId: replyTo
        })
      });

      if (response.ok) {
        const comment = await response.json();
        setComments(prev => [comment, ...prev]);
        setNewComment('');
        setReplyTo(null);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setPosting(false);
    }
  };

  const getUserName = (userId: string | any): string => {
    if (typeof userId === 'string') return 'User';
    return userId?.name || 'User';
  };

  const getUserId = (userId: string | any): string | null => {
    if (typeof userId === 'string') return userId;
    return userId?._id || userId?.id || null;
  };

  const getUserRole = (userId: string | any): string | null => {
    if (typeof userId === 'string') return null;
    return userId?.role || null;
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return null;
    
    const roleConfig = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-700 border-red-300' },
      organizer: { label: 'Organizer', color: 'bg-purple-100 text-purple-700 border-purple-300' },
      student: { label: 'Student', color: 'bg-blue-100 text-blue-700 border-blue-300' },
      faculty: { label: 'Faculty', color: 'bg-green-100 text-green-700 border-green-300' }
    };

    const config = roleConfig[role as keyof typeof roleConfig] || { label: role, color: 'bg-gray-100 text-gray-700 border-gray-300' };
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }
    return 'just now';
  };

  const topLevelComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Comments</h3>
          <p className="text-sm text-gray-600">{comments.length} comment{comments.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* New Comment Input */}
      {user && !commentsDisabled && (
        <div className="mb-6">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
              <Reply className="w-4 h-4" />
              <span>Replying to comment...</span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-red-500 hover:text-red-700 ml-auto"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePostComment()}
                placeholder={replyTo ? "Write a reply..." : "Write a comment..."}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              />
              <button
                onClick={handlePostComment}
                disabled={!newComment.trim() || posting}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Disabled Message */}
      {commentsDisabled && (
        <div className="mb-6 p-4 bg-gray-100 rounded-xl border border-gray-300">
          <p className="text-gray-600 text-center">
            💬 Comments are disabled for {eventStatus === 'completed' ? 'completed' : 'cancelled'} events
          </p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No comments yet</p>
          <p className="text-gray-400 text-sm">Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {topLevelComments.map((comment) => (
              <motion.div
                key={comment._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="border-b border-gray-100 pb-4 last:border-0"
              >
                {/* Main Comment */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm">
                    {getUserName(comment.userId).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {getUserId(comment.userId) ? (
                            <Link 
                              to={`/user/${getUserId(comment.userId)}`}
                              className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {getUserName(comment.userId)}
                            </Link>
                          ) : (
                            <span className="font-semibold text-gray-900">{getUserName(comment.userId)}</span>
                          )}
                          {getRoleBadge(getUserRole(comment.userId))}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(comment.createdAt)}
                      </div>
                    </div>
                    <p className="text-gray-700">{comment.content}</p>
                  </div>
                  {user && !commentsDisabled && (
                    <button
                      onClick={() => setReplyTo(comment._id)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 flex items-center gap-1"
                    >
                      <Reply className="w-3 h-3" />
                      Reply
                    </button>
                  )}
                </div>
              </div>                {/* Replies */}
                {getReplies(comment._id).map((reply) => (
                  <motion.div
                    key={reply._id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="ml-12 mt-3 flex gap-3"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-xs">
                      {getUserName(reply.userId).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="bg-blue-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {getUserId(reply.userId) ? (
                              <Link 
                                to={`/user/${getUserId(reply.userId)}`}
                                className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {getUserName(reply.userId)}
                              </Link>
                            ) : (
                              <span className="font-semibold text-gray-900 text-sm">{getUserName(reply.userId)}</span>
                            )}
                            {getRoleBadge(getUserRole(reply.userId))}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(reply.createdAt)}
                          </div>
                        </div>
                        <p className="text-gray-700 text-sm">{reply.content}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default memo(Comments);
