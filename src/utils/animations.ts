// Animation configurations for Framer Motion
import { Variants } from 'framer-motion';

// ============================================
// PAGE TRANSITIONS
// ============================================

// Page transition animations - smooth and professional
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94], // Custom easing curve
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.55, 0.06, 0.55, 0.06],
    },
  },
};

// ============================================
// BASIC ANIMATIONS
// ============================================

// Fade in animation - minimal and clean
export const fadeInVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

// Fast fade in
export const fadeInFastVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

// ============================================
// SLIDE ANIMATIONS
// ============================================

// Slide in from left
export const slideInLeftVariants: Variants = {
  hidden: {
    x: -50,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Slide in from right
export const slideInRightVariants: Variants = {
  hidden: {
    x: 50,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Slide in from bottom
export const slideInBottomVariants: Variants = {
  hidden: {
    y: 50,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Slide in from top
export const slideInTopVariants: Variants = {
  hidden: {
    y: -50,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// ============================================
// SCALE ANIMATIONS
// ============================================

// Scale in animation - smooth growth
export const scaleInVariants: Variants = {
  hidden: {
    scale: 0.9,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Pop in animation - playful but professional
export const popInVariants: Variants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
      duration: 0.4,
    },
  },
};

// ============================================
// MODAL & OVERLAY ANIMATIONS
// ============================================

// Modal animations - professional entry/exit
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: {
      duration: 0.2,
      ease: [0.55, 0.06, 0.55, 0.06],
    },
  },
};

// Backdrop animation - smooth overlay
export const backdropVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

// Drawer slide animation (from right)
export const drawerVariants: Variants = {
  hidden: {
    x: '100%',
    transition: {
      type: 'tween',
      duration: 0.3,
      ease: [0.55, 0.06, 0.55, 0.06],
    },
  },
  visible: {
    x: 0,
    transition: {
      type: 'tween',
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// ============================================
// STAGGER & LIST ANIMATIONS
// ============================================

// Stagger children animation - cascading effect
export const staggerContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// Fast stagger for quick lists
export const staggerFastVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// List item animation
export const listItemVariants: Variants = {
  hidden: {
    x: -20,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

// ============================================
// HOVER & INTERACTION ANIMATIONS
// ============================================

// Card hover animation - subtle lift
export const cardHoverVariants: Variants = {
  rest: {
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
  tap: {
    scale: 0.98,
    y: 0,
  },
};

// Button animation - professional interaction
export const buttonVariants: Variants = {
  rest: {
    scale: 1,
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
  tap: {
    scale: 0.95,
  },
};

// Subtle button hover (for icon buttons)
export const iconButtonVariants: Variants = {
  rest: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.1,
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
  tap: { scale: 0.9 },
};

// ============================================
// SPECIAL EFFECTS
// ============================================

// Success animation (for registration success, confirmations)
export const successVariants: Variants = {
  hidden: {
    scale: 0,
    opacity: 0,
    rotate: -180,
  },
  visible: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      duration: 0.5,
    },
  },
};

// Bounce animation - attention grabber (use sparingly)
export const bounceVariants: Variants = {
  initial: {
    y: 0,
  },
  animate: {
    y: [-8, 0, -8],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Pulse animation - subtle breathing effect
export const pulseVariants: Variants = {
  initial: {
    scale: 1,
    opacity: 1,
  },
  animate: {
    scale: [1, 1.03, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Rotate in animation
export const rotateInVariants: Variants = {
  hidden: {
    rotate: -90,
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    rotate: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// ============================================
// NOTIFICATION ANIMATIONS
// ============================================

// Notification slide in (from right)
export const notificationVariants: Variants = {
  hidden: {
    x: 400,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 20,
      duration: 0.4,
    },
  },
  exit: {
    x: 400,
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: [0.55, 0.06, 0.55, 0.06],
    },
  },
};

// Toast notification (from bottom)
export const toastVariants: Variants = {
  hidden: {
    y: 100,
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
    },
  },
  exit: {
    y: 100,
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// LOADING & SKELETON ANIMATIONS
// ============================================

// Shimmer loading effect
export const shimmerVariants: Variants = {
  initial: {
    backgroundPosition: '-200% 0',
  },
  animate: {
    backgroundPosition: '200% 0',
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// Spinner animation
export const spinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================
// FORM ANIMATIONS
// ============================================

// Form field focus animation
export const formFieldVariants: Variants = {
  rest: {
    scale: 1,
    borderColor: '#e5e7eb',
  },
  focus: {
    scale: 1.01,
    borderColor: '#3b82f6',
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
};

// Form error shake animation
export const errorShakeVariants: Variants = {
  initial: { x: 0 },
  shake: {
    x: [-10, 10, -10, 10, 0],
    transition: {
      duration: 0.4,
      ease: 'easeInOut',
    },
  },
};

// ============================================
// UTILITY ANIMATIONS
// ============================================

// Smooth height expand/collapse
export const expandVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
};

// Smooth opacity transition
export const opacityVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

