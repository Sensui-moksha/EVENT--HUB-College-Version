import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Info, CheckCircle, XCircle } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  buttonText?: string;
}

/**
 * Beautiful Alert Modal
 * Matches EventHub's glassmorphism theme with gradients
 */
export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
  buttonText = 'OK',
}) => {
  const variantStyles = {
    danger: {
      icon: XCircle,
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/20',
      buttonBg: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
      headerGradient: 'from-red-600/20 via-purple-600/20 to-pink-600/20',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/20',
      buttonBg: 'bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800',
      headerGradient: 'from-amber-600/20 via-orange-600/20 to-red-600/20',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      buttonBg: 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800',
      headerGradient: 'from-blue-600/20 via-indigo-600/20 to-purple-600/20',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/20',
      buttonBg: 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800',
      headerGradient: 'from-green-600/20 via-emerald-600/20 to-teal-600/20',
    },
  };

  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-md"
            >
              {/* Glassmorphism Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-purple-900/95 to-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl">
                {/* Gradient Header Background */}
                <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-br ${style.headerGradient} opacity-30 blur-2xl`} />
                
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all z-10"
                >
                  <X size={20} />
                </button>

                {/* Content */}
                <div className="relative p-6 sm:p-8">
                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <div className={`p-4 rounded-2xl ${style.iconBg} backdrop-blur-sm`}>
                      <Icon size={40} className={style.iconColor} strokeWidth={2} />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-white text-center mb-3">
                    {title}
                  </h3>

                  {/* Message */}
                  <p className="text-white/70 text-center mb-8 leading-relaxed whitespace-pre-line">
                    {message}
                  </p>

                  {/* Action Button */}
                  <button
                    onClick={onClose}
                    className={`w-full px-6 py-3 rounded-xl ${style.buttonBg} text-white font-semibold shadow-lg transition-all`}
                  >
                    {buttonText}
                  </button>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl" />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AlertModal;
