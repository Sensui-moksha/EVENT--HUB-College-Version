import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
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
 * Responsive analog clock interface — centered overlay on mobile, dropdown on desktop.
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

  // Responsive clock size: measure available space
  const [clockSize, setClockSize] = useState(260);

  const updateClockSize = useCallback(() => {
    const vw = window.innerWidth;
    if (vw < 360) {
      setClockSize(200);
    } else if (vw < 480) {
      setClockSize(220);
    } else {
      setClockSize(260);
    }
  }, []);

  useEffect(() => {
    updateClockSize();
    window.addEventListener('resize', updateClockSize);
    return () => window.removeEventListener('resize', updateClockSize);
  }, [updateClockSize]);

  // Derived radius for number positioning (scales with clock size)
  const numberRadius = useMemo(() => (clockSize / 2) - 35, [clockSize]);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(':').map(Number);
      setSelectedHour(hours === 0 ? 12 : hours > 12 ? hours - 12 : hours);
      setSelectedMinute(minutes);
      setPeriod(hours >= 12 ? 'PM' : 'AM');
    }
  }, [value]);

  // Lock body scroll when picker is open on mobile
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
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

  // Shared logic: resolve angle → hour/minute from a pointer position
  const resolveFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dx = clientX - rect.left - centerX;
    const dy = clientY - rect.top - centerY;

    const angleRad = Math.atan2(dy, dx);
    const angleDeg = ((angleRad * 180 / Math.PI) + 90 + 360) % 360;

    if (mode === 'hour') {
      let hour = Math.round(angleDeg / 30);
      if (hour === 0) hour = 12;
      setSelectedHour(hour);
      setTimeout(() => setMode('minute'), 200);
    } else {
      const nearestFive = Math.round(angleDeg / 30) * 5 % 60;
      setSelectedMinute(nearestFive);
    }
  }, [mode]);

  const handleClockClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON') return;
    resolveFromPointer(event.clientX, event.clientY);
  };

  // Touch support for the clock face
  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON') return;
    const touch = event.changedTouches[0];
    if (touch) {
      resolveFromPointer(touch.clientX, touch.clientY);
    }
  }, [resolveFromPointer]);

  const renderClockNumbers = () => {
    const numbers = mode === 'hour'
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : Array.from({ length: 12 }, (_, i) => i * 5);

    // Responsive number button size
    const btnSize = clockSize < 230 ? 32 : 36;

    return numbers.map((num, index) => {
      const angleDeg = mode === 'hour'
        ? ((index + 1) * 30) - 90
        : (index * 30) - 90;

      const angleRad = angleDeg * (Math.PI / 180);
      const x = Math.cos(angleRad) * numberRadius;
      const y = Math.sin(angleRad) * numberRadius;

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
          className={`absolute rounded-full flex items-center justify-center font-medium transition-all z-10 ${
            isSelected
              ? 'text-transparent'
              : 'text-gray-700 hover:bg-violet-100 active:bg-violet-200'
          }`}
          style={{
            width: `${btnSize}px`,
            height: `${btnSize}px`,
            fontSize: clockSize < 230 ? '12px' : '14px',
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
    const angleDeg = mode === 'hour'
      ? ((selectedHour % 12) * 30) - 90
      : (selectedMinute * 6) - 90;

    const angleRad = angleDeg * (Math.PI / 180);
    const x = Math.cos(angleRad) * numberRadius;
    const y = Math.sin(angleRad) * numberRadius;

    const indicatorSize = clockSize < 230 ? 34 : 40;

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

        {/* Hand line */}
        <div
          className="absolute bg-violet-600 z-20"
          style={{
            width: `${numberRadius - 20}px`,
            height: '2px',
            left: '50%',
            top: '50%',
            transform: `rotate(${angleDeg}deg)`,
            transformOrigin: '0 50%'
          }}
        />

        {/* Circle with selected number at the end */}
        <div
          className="absolute bg-violet-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-30"
          style={{
            width: `${indicatorSize}px`,
            height: `${indicatorSize}px`,
            fontSize: clockSize < 230 ? '12px' : '14px',
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

  // ---------- Picker card (shared between desktop dropdown & mobile overlay) ----------
  const pickerCard = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-[320px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 text-white p-3 sm:p-4">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <span className="text-xs sm:text-sm font-medium opacity-90">Select Time</span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setMode('hour')}
            className={`text-3xl sm:text-4xl font-bold px-2 py-1 rounded-lg transition-all ${
              mode === 'hour' ? 'bg-white/20' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {selectedHour.toString().padStart(2, '0')}
          </button>
          <span className="text-2xl sm:text-3xl opacity-60">:</span>
          <button
            type="button"
            onClick={() => setMode('minute')}
            className={`text-3xl sm:text-4xl font-bold px-2 py-1 rounded-lg transition-all ${
              mode === 'minute' ? 'bg-white/20' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {selectedMinute.toString().padStart(2, '0')}
          </button>
          <div className="ml-auto flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setPeriod('AM')}
              className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                period === 'AM' ? 'bg-white/30' : 'opacity-60 hover:opacity-100'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => setPeriod('PM')}
              className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                period === 'PM' ? 'bg-white/30' : 'opacity-60 hover:opacity-100'
              }`}
            >
              PM
            </button>
          </div>
        </div>
      </div>

      {/* Clock Face */}
      <div className="p-4 sm:p-8 flex justify-center">
        <div
          ref={clockRef}
          onClick={handleClockClick}
          onTouchEnd={handleTouchEnd}
          className="relative rounded-full bg-gradient-to-br from-violet-50 to-purple-50 cursor-pointer shadow-inner touch-none"
          style={{ width: `${clockSize}px`, height: `${clockSize}px` }}
        >
          {renderClockNumbers()}
          {renderClockHand()}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-3 sm:p-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm sm:text-base"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="px-5 sm:px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-lg font-medium hover:from-violet-700 hover:to-purple-800 transition-all shadow-lg shadow-violet-500/30 text-sm sm:text-base"
        >
          OK
        </button>
      </div>
    </motion.div>
  );

  // ---------- Render ----------
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
          onClick={() => { setIsOpen(true); setMode('hour'); }}
          readOnly
          required={required}
          placeholder="Select time"
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all cursor-pointer bg-white"
        />
      </div>

      {/* Clock Picker — portal-based centered overlay (works on mobile & desktop) */}
      <AnimatePresence>
        {isOpen && ReactDOM.createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
            onClick={() => setIsOpen(false)}
          >
            {pickerCard}
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimePicker;
