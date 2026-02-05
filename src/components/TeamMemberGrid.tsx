import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Crown,
  UserPlus,
  Clock,
  Mail,
  Building,
  GraduationCap,
  UserMinus,
  ExternalLink,
} from 'lucide-react';
import { User, TeamJoinRequest } from '../types';

interface TeamMember {
  userId: User;
  role: 'leader' | 'member';
  joinedAt: Date;
}

interface TokenInvitation {
  _id: string;
  invitedEmail: string;
  inviteType: 'platform_user' | 'non_platform';
  status: string;
  createdAt: Date;
}

interface TeamMemberGridProps {
  members: TeamMember[];
  maxMembers: number;
  sentRequests: TeamJoinRequest[];
  tokenInvitations: TokenInvitation[];
  isLeader: boolean;
  deadlinePassed: boolean;
  currentUserId: string;
  onInviteClick: () => void;
  onRemoveMember: (userId: string) => void;
  onCancelInvite: (requestId: string) => void;
  onCancelTokenInvite: (tokenId: string) => void;
}

const TeamMemberGrid: React.FC<TeamMemberGridProps> = ({
  members,
  maxMembers,
  sentRequests,
  tokenInvitations,
  isLeader,
  deadlinePassed,
  currentUserId,
  onInviteClick,
  onRemoveMember,
  onCancelInvite,
  onCancelTokenInvite,
}) => {
  // Calculate slots
  const filledSlots = members.length;
  const pendingSlots = sentRequests.length + tokenInvitations.length;
  const emptySlots = Math.max(0, maxMembers - filledSlots - pendingSlots);

  // Create slot array for grid display
  const slots: Array<{
    type: 'member' | 'pending' | 'pending_token' | 'empty';
    data?: TeamMember | TeamJoinRequest | TokenInvitation;
    index: number;
  }> = [];

  // Add member slots
  members.forEach((member, index) => {
    slots.push({ type: 'member', data: member, index });
  });

  // Add pending request slots
  sentRequests.forEach((request, index) => {
    slots.push({ type: 'pending', data: request, index: filledSlots + index });
  });

  // Add pending token invitation slots
  tokenInvitations.forEach((token, index) => {
    slots.push({ type: 'pending_token', data: token, index: filledSlots + sentRequests.length + index });
  });

  // Add empty slots
  for (let i = 0; i < emptySlots; i++) {
    slots.push({ type: 'empty', index: filledSlots + pendingSlots + i });
  }

  const renderMemberSlot = (member: TeamMember, index: number) => {
    const user = member.userId;
    const isCurrentUser = (user._id || (user as any).id) === currentUserId;
    const isLeaderMember = member.role === 'leader';

    return (
      <motion.div
        key={user._id || (user as any).id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className={`relative bg-gradient-to-br ${
          isLeaderMember
            ? 'from-yellow-50 to-orange-50 border-yellow-300'
            : 'from-purple-50 to-indigo-50 border-purple-200'
        } border-2 rounded-xl p-4 flex flex-col items-center text-center`}
      >
        {/* Leader crown badge */}
        {isLeaderMember && (
          <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1.5 shadow-lg">
            <Crown className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Avatar */}
        <div className={`w-16 h-16 rounded-full ${
          isLeaderMember ? 'bg-yellow-200' : 'bg-purple-200'
        } flex items-center justify-center mb-3 overflow-hidden ring-2 ${
          isLeaderMember ? 'ring-yellow-300' : 'ring-purple-300'
        }`}>
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={`text-2xl font-bold ${
              isLeaderMember ? 'text-yellow-600' : 'text-purple-600'
            }`}>
              {user.name?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name */}
        <Link 
          to={`/user/${user._id || (user as any).id}`}
          className="font-semibold text-gray-900 truncate w-full hover:text-purple-600 hover:underline transition-colors"
        >
          {user.name}
          {isCurrentUser && <span className="text-xs text-gray-500 ml-1">(You)</span>}
        </Link>

        {/* Role badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 ${
          isLeaderMember
            ? 'bg-yellow-200 text-yellow-700'
            : 'bg-purple-200 text-purple-700'
        }`}>
          {isLeaderMember ? 'Leader' : 'Member'}
        </span>

        {/* Details */}
        <div className="mt-2 space-y-0.5 text-xs text-gray-500">
          {user.department && (
            <div className="flex items-center justify-center gap-1">
              <Building className="w-3 h-3" />
              <span className="truncate">{user.department}</span>
            </div>
          )}
          {user.year && (
            <div className="flex items-center justify-center gap-1">
              <GraduationCap className="w-3 h-3" />
              <span>Year {user.year}</span>
            </div>
          )}
        </div>

        {/* Remove button (for leader to remove members) */}
        {isLeader && !isLeaderMember && !isCurrentUser && !deadlinePassed && (
          <button
            onClick={() => onRemoveMember(user._id || (user as any).id)}
            className="absolute top-2 left-2 p-1.5 text-red-500 hover:bg-red-100 rounded-full transition-colors"
            title="Remove member"
          >
            <UserMinus className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    );
  };

  const renderPendingSlot = (request: TeamJoinRequest, index: number) => {
    const targetUser = request.toUserId as User;

    return (
      <motion.div
        key={request._id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className="relative bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-dashed border-amber-300 rounded-xl p-4 flex flex-col items-center text-center"
      >
        {/* Pending badge */}
        <div className="absolute -top-2 -right-2 bg-amber-400 rounded-full p-1.5 shadow-lg animate-pulse">
          <Clock className="w-4 h-4 text-white" />
        </div>

        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-3 overflow-hidden ring-2 ring-amber-200">
          {targetUser?.avatar ? (
            <img
              src={targetUser.avatar}
              alt={targetUser.name}
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <span className="text-2xl font-bold text-amber-400">
              {targetUser?.name?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Name */}\n        {targetUser?._id || (targetUser as any)?.id ? (\n          <Link \n            to={`/user/${targetUser._id || (targetUser as any).id}`}\n            className=\"font-semibold text-gray-700 truncate w-full hover:text-amber-600 hover:underline transition-colors\"\n          >\n            {targetUser?.name || 'Unknown'}\n          </Link>\n        ) : (\n          <h4 className=\"font-semibold text-gray-700 truncate w-full\">\n            {targetUser?.name || 'Unknown'}\n          </h4>\n        )}

        {/* Status badge */}
        <span className="text-xs px-2 py-0.5 rounded-full mt-1 bg-amber-200 text-amber-700">
          Pending Invite
        </span>

        {/* Details */}
        <div className="mt-2 text-xs text-gray-500">
          <div className="flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Waiting response...</span>
          </div>
        </div>

        {/* Cancel button */}
        {isLeader && !deadlinePassed && (
          <button
            onClick={() => onCancelInvite(request._id)}
            className="mt-2 text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Cancel Invite
          </button>
        )}
      </motion.div>
    );
  };

  const renderTokenPendingSlot = (token: TokenInvitation, index: number) => {
    return (
      <motion.div
        key={token._id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className="relative bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-dashed border-blue-300 rounded-xl p-4 flex flex-col items-center text-center"
      >
        {/* Email invite badge */}
        <div className="absolute -top-2 -right-2 bg-blue-400 rounded-full p-1.5 shadow-lg animate-pulse">
          <Mail className="w-4 h-4 text-white" />
        </div>

        {/* Avatar placeholder */}
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-3 ring-2 ring-blue-200">
          <Mail className="w-8 h-8 text-blue-400" />
        </div>

        {/* Email */}
        <h4 className="font-semibold text-gray-700 truncate w-full text-sm">
          {token.invitedEmail}
        </h4>

        {/* Status badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 ${
          token.inviteType === 'non_platform'
            ? 'bg-blue-200 text-blue-700'
            : 'bg-cyan-200 text-cyan-700'
        }`}>
          {token.inviteType === 'non_platform' ? 'Invited to Register' : 'Invited to Event'}
        </span>

        {/* Details */}
        <div className="mt-2 text-xs text-gray-500">
          <div className="flex items-center justify-center gap-1">
            <ExternalLink className="w-3 h-3" />
            <span>Email sent</span>
          </div>
        </div>

        {/* Cancel button */}
        {isLeader && !deadlinePassed && (
          <button
            onClick={() => onCancelTokenInvite(token._id)}
            className="mt-2 text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Cancel Invite
          </button>
        )}
      </motion.div>
    );
  };

  const renderEmptySlot = (index: number) => {
    const canInvite = isLeader && !deadlinePassed;

    return (
      <motion.div
        key={`empty-${index}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        onClick={canInvite ? onInviteClick : undefined}
        className={`relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-center min-h-[180px] ${
          canInvite ? 'cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-colors group' : ''
        }`}
      >
        <div className={`w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-3 ${
          canInvite ? 'group-hover:bg-purple-200' : ''
        }`}>
          <UserPlus className={`w-8 h-8 text-gray-400 ${
            canInvite ? 'group-hover:text-purple-500' : ''
          }`} />
        </div>
        <span className={`text-sm text-gray-500 ${
          canInvite ? 'group-hover:text-purple-600' : ''
        }`}>
          {canInvite ? 'Click to Invite' : 'Empty Slot'}
        </span>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Team capacity indicator */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-600" />
          <span className="font-medium text-gray-700">Team Members</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${
            filledSlots >= maxMembers ? 'text-green-600' : 'text-purple-600'
          }`}>
            {filledSlots}/{maxMembers}
          </span>
          {pendingSlots > 0 && (
            <span className="text-amber-600 text-xs">
              (+{pendingSlots} pending)
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full flex">
          <div
            className="bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${(filledSlots / maxMembers) * 100}%` }}
          />
          <div
            className="bg-amber-300 transition-all duration-500"
            style={{ width: `${(pendingSlots / maxMembers) * 100}%` }}
          />
        </div>
      </div>

      {/* Member grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {slots.map((slot) => {
          if (slot.type === 'member') {
            return renderMemberSlot(slot.data as TeamMember, slot.index);
          }
          if (slot.type === 'pending') {
            return renderPendingSlot(slot.data as TeamJoinRequest, slot.index);
          }
          if (slot.type === 'pending_token') {
            return renderTokenPendingSlot(slot.data as TokenInvitation, slot.index);
          }
          return renderEmptySlot(slot.index);
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center text-xs text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-300" />
          <span>Leader</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-purple-400" />
          <span>Member</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-amber-300" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-300" />
          <span>Empty</span>
        </div>
      </div>
    </div>
  );
};

export default TeamMemberGrid;
