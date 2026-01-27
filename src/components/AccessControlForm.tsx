import { AccessControl, AccessControlType } from '../types/subEvent';
import { Users, GraduationCap, Briefcase, Globe } from 'lucide-react';

interface AccessControlFormProps {
  value: AccessControl;
  onChange: (value: AccessControl) => void;
}

const DEPARTMENTS = ['CSE','IT','AI & DS','AI & ML','ECE','EEE','Mechanical','Civil','Others'];
const YEARS = [1, 2, 3, 4];
const ROLES = ['student', 'faculty', 'organizer', 'admin'] as const;

export default function AccessControlForm({ value, onChange }: AccessControlFormProps) {
  const handleTypeChange = (type: AccessControlType) => {
    onChange({
      type,
      allowedDepartments: [],
      allowedYears: [],
      allowedRoles: []
    });
  };

  const handleDepartmentToggle = (dept: string) => {
    const current = value.allowedDepartments || [];
    const updated = current.includes(dept)
      ? current.filter(d => d !== dept)
      : [...current, dept];
    onChange({ ...value, allowedDepartments: updated });
  };

  const handleYearToggle = (year: number) => {
    const current = value.allowedYears || [];
    const updated = current.includes(year)
      ? current.filter(y => y !== year)
      : [...current, year];
    onChange({ ...value, allowedYears: updated });
  };

  const handleRoleToggle = (role: typeof ROLES[number]) => {
    const current = value.allowedRoles || [];
    const updated = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];
    onChange({ ...value, allowedRoles: updated });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Access Control Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleTypeChange('everyone')}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
              value.type === 'everyone'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">Everyone</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleTypeChange('students_only')}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
              value.type === 'students_only'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="text-sm font-medium">Students Only</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleTypeChange('faculty_only')}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
              value.type === 'faculty_only'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span className="text-sm font-medium">Faculty Only</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleTypeChange('custom')}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
              value.type === 'custom'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Custom</span>
          </button>
        </div>
      </div>

      {value.type === 'custom' && (
        <div className="space-y-4 p-5 bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-lg">
          {/* Departments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed Departments (leave empty for all)
            </label>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map(dept => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => handleDepartmentToggle(dept)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
                    value.allowedDepartments?.includes(dept)
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          {/* Years */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed Years (leave empty for all)
            </label>
            <div className="flex gap-2">
              {YEARS.map(year => (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleYearToggle(year)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
                    value.allowedYears?.includes(year)
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  Year {year}
                </button>
              ))}
            </div>
          </div>

          {/* Roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed Roles (leave empty for all)
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleToggle(role)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all shadow-sm ${
                    value.allowedRoles?.includes(role)
                      ? 'bg-blue-600 text-white shadow-blue-200'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
