import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { buttonVariants } from '../utils/animations';

interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  children,
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-300 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg',
    secondary: 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700',
    ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
    danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-md hover:shadow-lg',
    success: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-2.5 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`;

  return (
    <motion.button
      variants={buttonVariants}
      initial="rest"
      whileHover={!disabled && !isLoading ? "hover" : "rest"}
      whileTap={!disabled && !isLoading ? "tap" : "rest"}
      className={buttonClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
          />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <span>{children}</span>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </motion.button>
  );
};

export default AnimatedButton;
