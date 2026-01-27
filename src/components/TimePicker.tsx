import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X } from 'lucide-react';

interface TimePickerProps {
  value: string; // HH:mm format
  onChange: (time: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

/**
 * Google-style Clock Time Picker
 * Beautiful analog clock interface for time selection
 */
export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  required = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(':').map(Number);
      setSelectedHour(hours === 0 ? 12 : hours > 12 ? hours - 12 : hours);
      setSelectedMinute(minutes);
      setPeriod(hours >= 12 ? 'PM' : 'AM');
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const formatTime = () => {
    const hour = selectedHour.toString().padStart(2, '0');
    const minute = selectedMinute.toString().padStart(2, '0');
    return `${hour}:${minute} ${period}`;
  };

  const handleConfirm = () => {
    let hour24 = selectedHour;
    if (period === 'PM' && selectedHour !== 12) hour24 += 12;
    if (period === 'AM' && selectedHour === 12) hour24 = 0;
    
    const timeString = `${hour24.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
    onChange(timeString);
    setIsOpen(false);
  };

  const handleClockClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!clockRef.current) return;
    
    // Check if we clicked on a button (number) - if so, let the button handle it
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON') return;
    
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const clickX = event.clientX - rect.left - centerX;
    const clickY = event.clientY - rect.top - centerY;
    
    // Calculate angle from center, with 0° at top (12 o'clock position)
    const angleRad = Math.atan2(clickY, clickX);
    const angleDeg = ((angleRad * 180 / Math.PI) + 90 + 360) % 360;
    
    if (mode === 'hour') {
      let hour = Math.round(angleDeg / 30);
      if (hour === 0) hour = 12;
      setSelectedHour(hour);
      setTimeout(() => setMode('minute'), 200);
    } else {
      // Snap to nearest 5-minute interval
      const nearestFive = Math.round(angleDeg / 30) * 5 % 60;
      setSelectedMinute(nearestFive);
    }
  };

  const renderClockNumbers = () => {
    const numbers = mode === 'hour' 
      ? Array.from({ length: 12 }, (_, i) => i + 1) 
      : Array.from({ length: 12 }, (_, i) => i * 5);
    
    return numbers.map((num, index) => {
      // For hours: 12 is at top (index 11), 1 at top-right (index 0), etc.
      // For minutes: 0 is at top (index 0), 5 at top-right (index 1), etc.
      const angleDeg = mode === 'hour' 
        ? ((index + 1) * 30) - 90
        : (index * 30) - 90;
      
      const angleRad = angleDeg * (Math.PI / 180);
      const radius = 95;
      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;
      
      const isSelected = mode === 'hour' 
        ? num === selectedHour 
        : num === selectedMinute;
      
      return (
        <button
          key={num}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (mode === 'hour') {
              setSelectedHour(num);
              setTimeout(() => setMode('minute'), 200);
            } else {
              setSelectedMinute(num);
            }
          }}
          className={`absolute w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all z-10 ${
            isSelected
              ? 'text-transparent'
              : 'text-gray-700 hover:bg-violet-100'
          }`}
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {mode === 'minute' ? num.toString().padStart(2, '0') : num}
        </button>
      );
    });
  };

  const renderClockHand = () => {
    // Calculate the angle for the hand
    // Hours: 12 at top (-90°), 3 at right (0°), 6 at bottom (90°), 9 at left (180°)
    // Minutes: 0 at top (-90°), 15 at right (0°), 30 at bottom (90°), 45 at left (180°)
    const angleDeg = mode === 'hour' 
      ? ((selectedHour % 12) * 30) - 90
      : (selectedMinute * 6) - 90;
    
    const angleRad = angleDeg * (Math.PI / 180);
    const radius = 95;
    const x = Math.cos(angleRad) * radius;
    const y = Math.sin(angleRad) * radius;

    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Center dot */}
        <div 
          className="absolute w-3 h-3 bg-violet-600 rounded-full z-30"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
        
        {/* Hand line - from center to the number */}
        <div
          className="absolute bg-violet-600 z-20"
          style={{
            width: `${radius - 20}px`,
            height: '2px',
            left: '50%',
            top: '50%',
            transform: `rotate(${angleDeg}deg)`,
            transformOrigin: '0 50%'
          }}
        />
        
        {/* Circle with selected number at the end */}
        <div
          className="absolute w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-30"
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {mode === 'hour' ? selectedHour : selectedMinute.toString().padStart(2, '0')}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      {/* Input Display */}
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={value ? formatTime() : ''}
          onClick={() => setIsOpen(true)}
          readOnly
          required={required}
          placeholder="Select time"
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all cursor-pointer bg-white"
        />
      </div>

      {/* Clock Picker Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{ width: '320px' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-violet-600 to-purple-700 text-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-90">Select Time</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('hour')}
                  className={`text-4xl font-bold px-2 py-1 rounded-lg transition-all ${
                    mode === 'hour' ? 'bg-white/20' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {selectedHour.toString().padStart(2, '0')}
                </button>
                <span className="text-3xl opacity-60">:</span>
                <button
                  type="button"
                  onClick={() => setMode('minute')}
                  className={`text-4xl font-bold px-2 py-1 rounded-lg transition-all ${
                    mode === 'minute' ? 'bg-white/20' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {selectedMinute.toString().padStart(2, '0')}
                </button>
                <div className="ml-auto flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setPeriod('AM')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                      period === 'AM' ? 'bg-white/30' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('PM')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                      period === 'PM' ? 'bg-white/30' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* Clock Face */}
            <div className="p-8">
              <div
                ref={clockRef}
                onClick={handleClockClick}
                className="relative w-full aspect-square rounded-full bg-gradient-to-br from-violet-50 to-purple-50 cursor-pointer shadow-inner"
                style={{ width: '260px', height: '260px', margin: '0 auto' }}
              >
                {renderClockNumbers()}
                {renderClockHand()}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-lg font-medium hover:from-violet-700 hover:to-purple-800 transition-all shadow-lg shadow-violet-500/30"
              >
                OK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimePicker;
