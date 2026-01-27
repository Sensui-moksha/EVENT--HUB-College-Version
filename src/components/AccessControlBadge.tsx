import { AccessControl } from '../types/subEvent';
import { Globe, GraduationCap, Briefcase, Users, Building2, Calendar, UserCircle } from 'lucide-react';

interface AccessControlBadgeProps {
  accessControl?: AccessControl;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export default function AccessControlBadge({ 
  accessControl, 
  size = 'md',
  showDetails = false 
}: AccessControlBadgeProps) {
  // Handle undefined or missing accessControl
  if (!accessControl || !accessControl.type) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full font-semibold shadow-sm ring-1 ${
        size === 'sm' ? 'text-xs px-2 py-1' : 
        size === 'md' ? 'text-sm px-3 py-1.5' : 
        'text-base px-4 py-2'
      } bg-green-100 text-green-800 ring-green-300`}>
        <Globe className={
          size === 'sm' ? 'w-3 h-3' : 
          size === 'md' ? 'w-4 h-4' : 
          'w-5 h-5'
        } />
        <span>Open to Everyone</span>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-3.5 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const iconBubbleSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  };

  const getIcon = () => {
    switch (accessControl.type) {
      case 'everyone':
        return <Globe className={iconSizes[size]} />;
      case 'students_only':
        return <GraduationCap className={iconSizes[size]} />;
      case 'faculty_only':
        return <Briefcase className={iconSizes[size]} />;
      case 'custom':
        return <Users className={iconSizes[size]} />;
      default:
        return <Globe className={iconSizes[size]} />;
    }
  };

  const getLabel = () => {
    switch (accessControl.type) {
      case 'everyone':
        return 'Open to Everyone';
      case 'students_only':
        return 'Students Only';
      case 'faculty_only':
        return 'Faculty Only';
      case 'custom':
        return 'Custom Access';
      default:
        return 'Open';
    }
  };

  const getColorClasses = () => {
    switch (accessControl.type) {
      case 'everyone':
        return 'bg-green-200 text-green-900 ring-2 ring-green-400 shadow dark:bg-green-900/40 dark:text-green-200 dark:ring-green-700';
      case 'students_only':
        return 'bg-blue-200 text-blue-900 ring-2 ring-blue-400 shadow dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-700';
      case 'faculty_only':
        return 'bg-purple-200 text-purple-900 ring-2 ring-purple-400 shadow dark:bg-purple-900/40 dark:text-purple-200 dark:ring-purple-700';
      case 'custom':
        return 'bg-orange-200 text-orange-900 ring-2 ring-orange-400 shadow dark:bg-orange-900/40 dark:text-orange-200 dark:ring-orange-700';
      default:
        return 'bg-gray-200 text-gray-900 ring-2 ring-gray-400 shadow dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600';
    }
  };

  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center gap-2 rounded-full font-semibold ${sizeClasses[size]} ${getColorClasses()}`}>
        <span className={`inline-flex items-center justify-center rounded-full bg-white/85 text-inherit border border-white/60 ${iconBubbleSizes[size]}`}>
          {getIcon()}
        </span>
        <span>{getLabel()}</span>
      </div>

      {showDetails && accessControl.type === 'custom' && (
        <div className="flex flex-wrap gap-2 mt-2">
          {accessControl.allowedDepartments && accessControl.allowedDepartments.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
              <Building2 className="w-3 h-3" />
              <span>{accessControl.allowedDepartments.join(', ')}</span>
            </div>
          )}
          
          {accessControl.allowedYears && accessControl.allowedYears.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
              <Calendar className="w-3 h-3" />
              <span>Year {accessControl.allowedYears.join(', ')}</span>
            </div>
          )}
          
          {accessControl.allowedRoles && accessControl.allowedRoles.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
              <UserCircle className="w-3 h-3" />
              <span className="capitalize">{accessControl.allowedRoles.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
