import React, { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { motion } from 'framer-motion';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Split value into individual digits
  const otpValues = value.split('').concat(Array(length).fill('')).slice(0, length);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Auto-submit when all digits are entered
  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const focusInput = (index: number) => {
    const targetIndex = Math.max(0, Math.min(index, length - 1));
    inputRefs.current[targetIndex]?.focus();
    setActiveIndex(targetIndex);
  };

  const handleChange = (index: number, digit: string) => {
    if (disabled) return;

    // Only allow numbers
    if (!/^\d*$/.test(digit)) return;

    const newOtp = otpValues.slice();
    newOtp[index] = digit.slice(-1); // Take only the last character
    const newValue = newOtp.join('').slice(0, length);
    onChange(newValue);

    // Move to next input if digit was entered
    if (digit && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case 'Backspace':
        e.preventDefault();
        if (otpValues[index]) {
          // Clear current input
          handleChange(index, '');
        } else if (index > 0) {
          // Move to previous input and clear it
          focusInput(index - 1);
          handleChange(index - 1, '');
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focusInput(index - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focusInput(index + 1);
        break;
      case 'Delete':
        e.preventDefault();
        handleChange(index, '');
        break;
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    
    if (pastedData) {
      onChange(pastedData);
      // Focus on the next empty input or the last input
      const nextIndex = Math.min(pastedData.length, length - 1);
      focusInput(nextIndex);
    }
  };

  const handleFocus = (index: number) => {
    setActiveIndex(index);
    // Select the input content
    inputRefs.current[index]?.select();
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {Array.from({ length }).map((_, index) => (
        <motion.input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={otpValues[index]}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          className={`
            w-10 h-12 sm:w-12 sm:h-14 
            text-center text-xl sm:text-2xl font-bold
            border-2 rounded-lg
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-1
            ${disabled 
              ? 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed' 
              : error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-300 bg-red-50'
                : activeIndex === index
                  ? 'border-neutral-800 focus:ring-neutral-400 bg-white'
                  : otpValues[index]
                    ? 'border-neutral-400 bg-white'
                    : 'border-neutral-300 bg-white hover:border-neutral-400'
            }
          `}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          whileFocus={{ scale: 1.05 }}
        />
      ))}
    </div>
  );
};

export default OTPInput;
