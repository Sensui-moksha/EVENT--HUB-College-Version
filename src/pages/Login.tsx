import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { pageVariants, fadeInVariants } from '../utils/animations';
import { Eye, EyeOff } from 'lucide-react';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const formCardRef = useRef<HTMLDivElement>(null);

  const { login, loading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [forgotOpen, setForgotOpen] = useState(false);

  // Auto-scroll to show the full login card on mobile when page loads
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formCardRef.current && window.innerWidth < 1024) {
        formCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300); // Small delay to let the page render first
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for empty fields
    if (!email.trim() || !password.trim()) {
      addToast({
        type: 'error',
        title: 'Missing Fields',
        message: 'Please enter both email and password.',
      });
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      addToast({
        type: 'success',
        title: 'Welcome back!',
        message: 'You have successfully logged in.',
      });
      navigate('/'); // Redirect to Home page
    } else {
      // Show specific error message (e.g., "Account pending approval")
      addToast({
        type: 'error',
        title: 'Login Failed',
        message: result.error || 'Invalid credentials or server error.',
      });
    }
  };

  return (
    <motion.div 
      className="min-h-screen bg-neutral-100 w-full overflow-x-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-neutral-200 z-10">
        <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 py-2 xs:py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="text-lg xs:text-xl sm:text-2xl font-bold tracking-tight">
            <span className="text-neutral-800">Event</span> <span className="text-neutral-600">Hub</span>
          </Link>
          <div className="flex items-center space-x-2 xs:space-x-3 sm:space-x-6 text-xs xs:text-xs sm:text-sm">
            <Link to="/" className="text-neutral-700 hover:text-neutral-900 transition-colors">Home</Link>
            <Link to="/login" className="text-neutral-700 hover:text-neutral-900 transition-colors hidden xs:inline">Login</Link>
            <Link to="/register" className="text-neutral-700 hover:text-neutral-900 transition-colors">Register</Link>
          </div>
        </div>
      </nav>

      <div className="min-h-screen flex pt-12 xs:pt-14 sm:pt-16">
        {/* Left Side - Form Section (Scrollable) */}
        <motion.div 
          className="w-full lg:w-1/2 flex items-center justify-center p-3 xs:p-4 sm:p-6 md:p-12 overflow-y-auto py-6 xs:py-8"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div 
            ref={formCardRef}
            className="w-full max-w-md bg-white rounded-lg xs:rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-neutral-200 p-4 xs:p-6 sm:p-8 md:p-10"
            variants={fadeInVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
          >
            {/* Mobile Logo - visible only on small screens */}
            <motion.div
              className="lg:hidden mb-6 xs:mb-8 flex justify-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="bg-neutral-50 rounded-xl xs:rounded-2xl p-3 xs:p-4 shadow-md border border-neutral-200">
                <img 
                  src="/logo-small.png" 
                  alt="College Logo" 
                  className="h-12 xs:h-14 sm:h-16 w-auto object-contain mx-auto"
                />
              </div>
            </motion.div>

            {/* Header */}
            <motion.div 
              className="mb-6 xs:mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <h2 className="text-2xl xs:text-2xl sm:text-3xl font-bold text-neutral-900 mb-1 xs:mb-2 font-elegant tracking-tight">
                Welcome back
              </h2>
              <p className="text-neutral-700 text-xs xs:text-sm sm:text-sm font-elegant">
                Access your account to discover & manage events.
              </p>
            </motion.div>

            {/* Login Form */}
            <motion.form 
              className="space-y-4 xs:space-y-5" 
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div>
                <label htmlFor="email" className="block text-xs xs:text-sm sm:text-sm font-semibold text-neutral-800 mb-1.5 xs:mb-2">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white text-sm xs:text-base"
                  placeholder=""
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs xs:text-sm sm:text-sm font-semibold text-neutral-800 mb-1.5 xs:mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pr-10 xs:pr-12 pl-3 xs:pl-4 py-2.5 xs:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white text-sm xs:text-base"
                    placeholder=""
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-2 xs:px-3 flex items-center text-neutral-500 hover:text-neutral-700 min-h-[44px]"
                  >
                    {showPassword ? <EyeOff className="w-4 xs:w-5 h-4 xs:h-5" /> : <Eye className="w-4 xs:w-5 h-4 xs:h-5" />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3 xs:py-3.5 px-3 xs:px-4 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg mt-5 xs:mt-6 text-sm xs:text-base min-h-[44px]"
              >
                {loading ? 'Entering...' : 'Login'}
              </button>

              <div className="text-center pt-2 xs:pt-3">
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs xs:text-sm text-neutral-700 hover:text-neutral-900 underline"
                  aria-label="Forgot Password"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Footer */}
              <div className="text-center pt-3 xs:pt-4">
                <p className="text-xs xs:text-sm text-neutral-600">
                  New to this Website?{' '}
                  <Link to="/register" className="text-neutral-800 hover:text-neutral-900 font-semibold underline">
                    Sign up
                  </Link>
                </p>
              </div>
            </motion.form>
          </motion.div>
        </motion.div>

        {/* Right Side - Quote Section (Fixed, Non-Scrollable) */}
        <motion.div 
          className="hidden lg:flex lg:w-1/2 bg-neutral-50 items-center justify-center p-12 fixed right-0 top-0 bottom-0"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="max-w-lg text-center">
            {/* College Logo */}
            <motion.div
              className="mb-12"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="flex justify-center mb-6">
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-neutral-200">
                  <img 
                    src="/logo-small.png" 
                    alt="College Logo" 
                    className="h-20 w-auto object-contain mx-auto"
                  />
                </div>
              </div>
            </motion.div>

            {/* Quote */}
            <motion.blockquote 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <p className="text-4xl font-serif italic text-neutral-800 leading-relaxed">
                "Education is one thing no one can take away from you."
              </p>
              <footer className="text-neutral-600 text-lg">
                — Elin Nordegren
              </footer>
            </motion.blockquote>
          </div>
        </motion.div>
      </div>
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </motion.div>
  );
}

export default Login;