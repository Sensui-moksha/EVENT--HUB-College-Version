import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { pageVariants, fadeInVariants } from '../utils/animations';
import { Eye, EyeOff } from 'lucide-react';
import EmailVerificationModal from '../components/EmailVerificationModal';

const Register: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const DEFAULT_COLLEGE = 'DVR & Dr. HS MIC College of Technology';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'organizer' | 'faculty',
    college: DEFAULT_COLLEGE,
    isOtherCollege: false,
    department: '',
    section: '',
    roomNo: '',
    mobile: '',
    isLateralEntry: false,
    year: 1,
    admissionMonth: 7, // Default to July
    admissionYear: currentYear,
    graduationYear: currentYear + 4, // Default to 4 years from current year
    regId: '',
  });
  // Show/hide toggles for password fields
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const { register, loading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const departments = [
    'CSE',
    'IT',
    'AI & DS',
    'AI & ML',
    'ECE',
    'EEE',
    'Mechanical',
    'Civil',
    'Others',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      addToast({
        type: 'error',
        title: 'Password Mismatch',
        message: 'Passwords do not match.',
      });
      return;
    }

    if (formData.password.length < 6) {
      addToast({
        type: 'error',
        title: 'Weak Password',
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }
    if (!formData.name.trim()) {
      addToast({
        type: 'error',
        title: 'Full Name Required',
        message: 'Please enter your full name.',
      });
      return;
    }
    if (!formData.email.trim()) {
      addToast({
        type: 'error',
        title: 'Email Required',
        message: 'Please enter your email address.',
      });
      return;
    }
    
    // Email validation with common typo detection
    const emailLower = formData.email.toLowerCase();
    
    // Skip typo check for educational/college emails
    const isEducationalEmail = 
      emailLower.endsWith('.edu') ||
      emailLower.endsWith('.edu.in') ||
      emailLower.endsWith('.ac.in') ||
      emailLower.endsWith('.ac.uk') ||
      emailLower.endsWith('.edu.au') ||
      emailLower.includes('.college') ||
      emailLower.includes('.university') ||
      emailLower.includes('.school') ||
      emailLower.includes('.institute');
    
    // Only check for typos on common consumer email domains
    if (!isEducationalEmail) {
      const commonTypos: { [key: string]: string } = {
        'gamil.com': 'gmail.com',
        'gmial.com': 'gmail.com',
        'gmal.com': 'gmail.com',
        'gmaill.com': 'gmail.com',
        'gnail.com': 'gmail.com',
        'gmail.con': 'gmail.com',
        'gmail.co': 'gmail.com',
        'yaho.com': 'yahoo.com',
        'yahooo.com': 'yahoo.com',
        'yahoo.con': 'yahoo.com',
        'hotmal.com': 'hotmail.com',
        'hotmai.com': 'hotmail.com',
        'outlok.com': 'outlook.com',
      };
      
      for (const [typo, correct] of Object.entries(commonTypos)) {
        if (emailLower.endsWith(typo)) {
          addToast({
            type: 'error',
            title: 'Email Typo Detected',
            message: `Did you mean "${formData.email.replace(typo, correct)}"? Please check your email address.`,
          });
          return;
        }
      }
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      addToast({
        type: 'error',
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
      });
      return;
    }
    
    if (!formData.department.trim()) {
      addToast({
        type: 'error',
        title: 'Department Required',
        message: 'Please select your department.',
      });
      return;
    }
    if (!formData.college || !formData.college.trim()) {
      addToast({
        type: 'error',
        title: 'College Required',
        message: 'Please select or enter your college name.',
      });
      return;
    }
    if (formData.role === 'student' && (!formData.admissionMonth || !formData.admissionYear || !formData.graduationYear)) {
      addToast({
        type: 'error',
        title: 'Academic Years Required',
        message: 'Please select your admission month, admission year, and expected graduation year.',
      });
      return;
    }
    if (formData.role === 'student' && formData.graduationYear <= formData.admissionYear) {
      addToast({
        type: 'error',
        title: 'Invalid Years',
        message: 'Graduation year must be after admission year.',
      });
      return;
    }
    if (formData.role === 'student' && (formData.graduationYear - formData.admissionYear) > (formData.isLateralEntry ? 3 : 4)) {
      addToast({
        type: 'error',
        title: 'Invalid Duration',
        message: `Course duration cannot exceed ${formData.isLateralEntry ? 3 : 4} years. Please check your admission and graduation years.`,
      });
      return;
    }
    if (formData.role === 'student' && !formData.section.trim()) {
      addToast({
        type: 'error',
        title: 'Section Required',
        message: 'Please enter your section.',
      });
      return;
    }
    if (formData.role === 'faculty' && !formData.roomNo.trim()) {
      addToast({
        type: 'error',
        title: 'Room No Required',
        message: 'Please enter your room number.',
      });
      return;
    }
    if (!formData.mobile.trim() || !/^\d{10}$/.test(formData.mobile)) {
      addToast({
        type: 'error',
        title: 'Mobile Number Required',
        message: 'Please enter a valid 10-digit mobile number.',
      });
      return;
    }
    if ((formData.role === 'student' || formData.role === 'faculty') && !formData.regId.trim()) {
      addToast({
        type: 'error',
        title: 'Registration ID Required',
        message: 'Please enter your Registration ID.',
      });
      return;
    }

    // If email not verified, show verification modal
    if (!emailVerified) {
      setShowEmailVerification(true);
      return;
    }

    // Proceed with registration after email verification
    await completeRegistration();
  };

  const completeRegistration = async () => {
    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      college: formData.college,
      department: formData.department,
      section: formData.role === 'student' ? formData.section : undefined, // Include section for students
      roomNo: formData.role === 'faculty' ? formData.roomNo : undefined, // Include room no for faculty
      branch: formData.department, // Send branch as department value
      mobile: formData.mobile,
      year: formData.role === 'student' ? formData.year : (undefined as unknown as number),
      admissionMonth: formData.role === 'student' ? formData.admissionMonth : undefined,
      admissionYear: formData.role === 'student' ? formData.admissionYear : undefined,
      graduationYear: formData.role === 'student' ? formData.graduationYear : undefined,
      regId: (formData.role === 'student' || formData.role === 'faculty') ? formData.regId : undefined,
    });
    if (result.success) {
      if (result.pendingApproval) {
        // Account created but needs admin approval
        addToast({
          type: 'info',
          title: 'Registration Submitted',
          message: result.message || 'Your account is pending admin approval. You will be able to login once approved.',
        });
        navigate('/login'); // Redirect to login page
      } else {
        // Account created and approved
        addToast({
          type: 'success',
          title: 'Account Created!',
          message: 'Welcome to EventHub!',
        });
        navigate('/'); // Redirect to Home page
      }
    } else {
      // Determine the appropriate title based on the error
      let errorTitle = 'Registration Failed';
      if (result.error?.toLowerCase().includes('email')) {
        errorTitle = 'Email Already Exists';
      } else if (result.error?.toLowerCase().includes('name')) {
        errorTitle = 'Name Already Exists';
      } else if (result.error?.toLowerCase().includes('registration id') || result.error?.toLowerCase().includes('roll number')) {
        errorTitle = 'Registration ID Already Exists';
      }
      
      addToast({
        type: 'error',
        title: errorTitle,
        message: result.error || 'Please try again later.',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updates: any = {
        [name]: (name === 'year' || name === 'admissionMonth' || name === 'admissionYear' || name === 'graduationYear') ? parseInt(value) : value,
      };
      
      // Reset email verification if email changes
      if (name === 'email' && prev.email !== value) {
        setEmailVerified(false);
      }
      
      // Auto-adjust graduation year when admission year changes
      if (name === 'admissionYear') {
        const newAdmissionYear = parseInt(value);
        const duration = prev.isLateralEntry ? 3 : 4;
        // If graduation year is more than duration from new admission year, adjust it
        if (prev.graduationYear > newAdmissionYear + duration) {
          updates.graduationYear = newAdmissionYear + duration;
        }
        // If graduation year is less than or equal to admission year, set it to admission year + duration
        if (prev.graduationYear <= newAdmissionYear) {
          updates.graduationYear = newAdmissionYear + duration;
        }
      }
      
      return { ...prev, ...updates };
    });
  };

  // College select (default vs others)
  const handleCollegeOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFormData(prev => {
      if (val === 'others') {
        return { ...prev, isOtherCollege: true, college: '' };
      }
      return { ...prev, isOtherCollege: false, college: DEFAULT_COLLEGE };
    });
  };

  // Toggle lateral entry and auto-adjust fields
  const handleLateralChange = (isLE: boolean) => {
    setFormData(prev => {
      const duration = isLE ? 3 : 4;
      const desiredGrad = (prev.admissionYear || currentYear) + duration;
      const next: any = {
        ...prev,
        isLateralEntry: isLE,
        graduationYear: desiredGrad,
      };
      // Lateral entry students typically start from 2nd year
      if (isLE) {
        if (prev.year < 2) next.year = 2;
      } else {
        // When switching back to non-LE, default to 1st year
        next.year = 1;
      }
      return next;
    });
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
          <Link 
            to="/" 
            className="text-lg xs:text-xl sm:text-2xl font-bold tracking-tight"
          >
            <span className="text-neutral-800">Event</span> <span className="text-neutral-600">Hub</span>
          </Link>
          <div className="flex items-center space-x-2 xs:space-x-3 sm:space-x-6 text-xs xs:text-xs sm:text-sm">
            <Link to="/" className="text-neutral-700 hover:text-neutral-900 transition-colors">Home</Link>
            <Link to="/login" className="text-neutral-700 hover:text-neutral-900 transition-colors">Login</Link>
            <Link to="/register" className="text-neutral-700 hover:text-neutral-900 transition-colors hidden xs:inline">Register</Link>
          </div>
        </div>
      </nav>

      <div className="min-h-screen flex pt-12 xs:pt-14 sm:pt-16">
        {/* Left Side - Quote Section (Fixed, Non-Scrollable) */}
        <motion.div 
          className="hidden lg:flex lg:w-1/2 bg-neutral-50 items-center justify-center p-6 xl:p-12 fixed left-0 top-14 sm:top-16 bottom-0"
          initial={{ opacity: 0, x: -50 }}
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
                    className="h-20 w-auto object-contain mx-auto transition-transform hover:scale-105"
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
                "The more that you read, the more things you will know, the more that you learn, the more places you'll go."
              </p>
              <footer className="text-neutral-600 text-lg">
                — Dr. Seuss
              </footer>
            </motion.blockquote>
          </div>
        </motion.div>

        {/* Right Side - Form Section (Scrollable) */}
        <motion.div 
          className="w-full lg:w-1/2 lg:ml-[50%] flex items-center justify-center p-3 xs:p-4 sm:p-6 md:p-12 overflow-y-auto min-h-screen"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div 
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
                  className="h-12 xs:h-14 sm:h-16 w-auto object-contain mx-auto transition-transform hover:scale-105"
                />
              </div>
            </motion.div>

            {/* Header */}
            <motion.div 
              className="mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold text-neutral-900 mb-2">
                Join the EventHub
              </h2>
            </motion.div>

            {/* Registration Form */}
            <motion.form 
              className="space-y-5" 
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {/* Username/Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-neutral-800 mb-2">
                  Username
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                  placeholder="Enter Your Name"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-neutral-800 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white ${
                    formData.email && !formData.email.toLowerCase().match(/\.(edu|ac\.|college|university|school|institute)/) && (
                      formData.email.toLowerCase().includes('gamil.com') ||
                      formData.email.toLowerCase().includes('gmial.com') ||
                      formData.email.toLowerCase().includes('gmal.com') ||
                      formData.email.toLowerCase().includes('gnail.com') ||
                      formData.email.toLowerCase().includes('yaho.com') ||
                      formData.email.toLowerCase().includes('hotmal.com')
                    ) ? 'border-yellow-500 bg-yellow-50' : 'border-neutral-300'
                  }`}
                  placeholder="Enter Your Email (personal or college)"
                />
                {/* Email typo warning - only for non-educational emails */}
                {formData.email && !formData.email.toLowerCase().match(/\.(edu|ac\.|college|university|school|institute)/) && formData.email.toLowerCase().includes('gamil.com') && (
                  <p className="text-yellow-600 text-xs mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Did you mean <strong>gmail.com</strong>? (not "gamil.com")
                  </p>
                )}
                {formData.email && !formData.email.toLowerCase().match(/\.(edu|ac\.|college|university|school|institute)/) && formData.email.toLowerCase().includes('gmial.com') && (
                  <p className="text-yellow-600 text-xs mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Did you mean <strong>gmail.com</strong>? (not "gmial.com")
                  </p>
                )}
                {emailVerified && (
                  <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Email verified
                  </p>
                )}
              </div>

              {/* Reg. ID (for students and faculty) — moved up under Email */}
              {(formData.role === 'student' || formData.role === 'faculty') && (
                <div>
                  <label htmlFor="regId" className="block text-sm font-semibold text-neutral-800 mb-2">
                    Registration ID / Roll Number
                  </label>
                  <input
                    id="regId"
                    name="regId"
                    type="text"
                    required
                    value={formData.regId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white uppercase"
                    placeholder={formData.role === 'student' ? 'e.g., 22A91A0501' : 'e.g., FAC001'}
                  />
                  <p className="text-neutral-500 text-xs mt-1">
                    {formData.role === 'student' 
                      ? 'Enter your college roll number (must be unique)'
                      : 'Enter your faculty ID (must be unique)'
                    }
                  </p>
                </div>
              )}

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-neutral-800 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pr-12 pl-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                    placeholder="Enter your Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-neutral-500 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-neutral-800 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full pr-12 pl-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                    placeholder="Enter your Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-neutral-500 hover:text-neutral-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* College (above Role) */}
              <div>
                <label htmlFor="collegeOption" className="block text-sm font-semibold text-neutral-800 mb-2">College</label>
                <select
                  id="collegeOption"
                  name="collegeOption"
                  value={formData.isOtherCollege ? 'others' : 'default'}
                  onChange={handleCollegeOptionChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                >
                  <option value="default">{DEFAULT_COLLEGE}</option>
                  <option value="others">Others</option>
                </select>
              </div>
              {formData.isOtherCollege && (
                <div>
                  <label htmlFor="college" className="block text-sm font-semibold text-neutral-800 mb-2">Enter College Name</label>
                  <input
                    id="college"
                    name="college"
                    type="text"
                    value={formData.college}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                    placeholder="Your College Name"
                  />
                </div>
              )}

              {/* Role (hidden selector for secret organizer) */}
              <div>
                <label htmlFor="role" className="block text-sm font-semibold text-neutral-800 mb-2">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                >
                  <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </div>

              {/* Department */}
              <div>
                <label htmlFor="department" className="block text-sm font-semibold text-neutral-800 mb-2">
                  Department
                </label>
                <select
                  id="department"
                  name="department"
                  required
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Section (Student) / Room No (Faculty) */}
              {formData.role === 'student' ? (
                <div>
                  <label htmlFor="section" className="block text-sm font-semibold text-neutral-800 mb-2">
                    Section
                  </label>
                  <input
                    id="section"
                    name="section"
                    type="text"
                    required
                    value={formData.section}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                    placeholder="e.g., A, B, C"
                  />
                </div>
              ) : formData.role === 'faculty' ? (
                <div>
                  <label htmlFor="roomNo" className="block text-sm font-semibold text-neutral-800 mb-2">
                    Room No
                  </label>
                  <input
                    id="roomNo"
                    name="roomNo"
                    type="text"
                    required
                    value={formData.roomNo}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                    placeholder="Enter your room number"
                  />
                </div>
              ) : null}

              {/* Mobile Number */}
              <div>
                <label htmlFor="mobile" className="block text-sm font-semibold text-neutral-800 mb-2">
                  Mobile Number
                </label>
                <input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  required
                  pattern="\d{10}"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                  placeholder="10-digit mobile number"
                />
              </div>

              {/* Lateral Entry check */}
              {formData.role === 'student' && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-800 mb-2">
                    Are you a lateral entry student?
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="isLateralEntry"
                        checked={!formData.isLateralEntry}
                        onChange={() => handleLateralChange(false)}
                        className="h-4 w-4 text-neutral-700"
                      />
                      <span className="text-neutral-700">No</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="isLateralEntry"
                        checked={formData.isLateralEntry}
                        onChange={() => handleLateralChange(true)}
                        className="h-4 w-4 text-neutral-700"
                      />
                      <span className="text-neutral-700">Yes</span>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">If yes, your course duration becomes 3 years (starting from 2nd year).</p>
                </div>
              )}

              {/* Admission Date (for students only) */}
              {formData.role === 'student' && (
                <>
                  <div>
                    <label htmlFor="admissionMonth" className="block text-sm font-semibold text-neutral-800 mb-2">
                      Admission Month
                    </label>
                    <select
                      id="admissionMonth"
                      name="admissionMonth"
                      value={formData.admissionMonth}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                    >
                      <option value={1}>January</option>
                      <option value={2}>February</option>
                      <option value={3}>March</option>
                      <option value={4}>April</option>
                      <option value={5}>May</option>
                      <option value={6}>June</option>
                      <option value={7}>July</option>
                      <option value={8}>August</option>
                      <option value={9}>September</option>
                      <option value={10}>October</option>
                      <option value={11}>November</option>
                      <option value={12}>December</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="admissionYear" className="block text-sm font-semibold text-neutral-800 mb-2">
                      Admission Year
                    </label>
                    <input
                      id="admissionYear"
                      name="admissionYear"
                      type="number"
                      min="1990"
                      max={new Date().getFullYear() + 10}
                      value={formData.admissionYear}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                      placeholder="e.g., 2022"
                    />
                  </div>

                  <div>
                    <label htmlFor="graduationYear" className="block text-sm font-semibold text-neutral-800 mb-2">
                      Expected Graduation Year
                    </label>
                    <input
                      id="graduationYear"
                      name="graduationYear"
                      type="number"
                      min={formData.admissionYear || 1990}
                      max={(formData.admissionYear || new Date().getFullYear()) + (formData.isLateralEntry ? 3 : 4)}
                      value={formData.graduationYear}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                      placeholder="e.g., 2026"
                    />
                  </div>

                  <div>
                    <label htmlFor="year" className="block text-sm font-semibold text-neutral-800 mb-2">
                      Current Year of Study
                    </label>
                    <select
                      id="year"
                      name="year"
                      value={formData.year}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all bg-white"
                    >
                      <option value={1}>1st Year</option>
                      <option value={2}>2nd Year</option>
                      <option value={3}>3rd Year</option>
                      <option value={4}>4th Year</option>
                    </select>
                  </div>
                </>
              )}

              

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg mt-6"
              >
                {loading ? 'Creating Account...' : emailVerified ? 'Complete Registration' : 'Verify Email & Join'}
              </button>

              {/* Email Verified Badge */}
              {emailVerified && (
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm mt-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Email verified</span>
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-4">
                <p className="text-sm text-neutral-600">
                  Already a Releam User? Enter{' '}
                  <Link to="/login" className="text-neutral-800 hover:text-neutral-900 font-semibold underline">
                    here
                  </Link>
                </p>
              </div>
            </motion.form>
          </motion.div>
        </motion.div>
      </div>

      {/* Email Verification Modal */}
      <EmailVerificationModal
        isOpen={showEmailVerification}
        email={formData.email}
        username={formData.name}
        purpose="registration"
        onVerified={() => {
          setEmailVerified(true);
          setShowEmailVerification(false);
          addToast({
            type: 'success',
            title: 'Email Verified!',
            message: 'Your email has been verified. Completing registration...',
          });
          // Auto-submit after verification
          setTimeout(() => {
            completeRegistration();
          }, 500);
        }}
        onClose={() => setShowEmailVerification(false)}
        onBack={() => setShowEmailVerification(false)}
      />
    </motion.div>
  );
};

export default Register;