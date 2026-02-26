import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Component, ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { EventProvider } from './contexts/EventContext.tsx';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { ToastProvider } from './components/ui/Toast';
import BackgroundJobToast from './components/BackgroundJobToast';
import ConnectionStatusBanner from './components/ConnectionStatusBanner';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import OverlayFooter from './components/OverlayFooter';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Events from './pages/Events';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import AdminUsers from './pages/AdminUsers';
import QRScannerPage from './pages/QRScannerPage';
import Notifications from './pages/Notifications';
import NotificationPreferences from './pages/NotificationPreferences';
import PrivacySettings from './pages/PrivacySettings';
import EventAnalytics from './pages/EventAnalytics';
import SendAnnouncement from './pages/SendAnnouncement';
import ProtectedRoute from './components/ProtectedRoute';
import EventDetails from './pages/EventDetails';
import CreateEvent from './pages/CreateEvent';
import CreateSubEvent from './pages/CreateSubEvent';
import EditSubEvent from './pages/EditSubEvent';
import SubEventDetails from './pages/SubEventDetails';
import CalendarPage from './pages/CalendarPage';
import WaitlistManagement from './pages/WaitlistManagement';
import VerifyRegistration from './pages/VerifyRegistration';
import Gallery from './pages/Gallery';
import GalleryDetail from './pages/GalleryDetail';
import GalleryManager from './pages/GalleryManager';
import JoinTeam from './pages/JoinTeam';
import ExternalAPI from './pages/ExternalAPI';

// Simple error boundary
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    // ...removed console log for production...
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '80px 40px 40px 40px', 
          minHeight: '100vh',
          backgroundColor: '#1a1a2e',
          color: 'white'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            backgroundColor: '#16213e',
            borderRadius: '12px',
            padding: '32px',
            border: '1px solid #e94560'
          }}>
            <h1 style={{ 
              color: '#e94560', 
              fontSize: '24px', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              ⚠️ Something went wrong
            </h1>
            <p style={{ color: '#a0a0a0', marginBottom: '16px' }}>
              An error occurred while rendering this page. Please try refreshing or go back.
            </p>
            <div style={{
              backgroundColor: '#0f0f23',
              padding: '16px',
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '300px'
            }}>
              <pre style={{ 
                color: '#ff6b6b', 
                fontSize: '14px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0
              }}>
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '20px',
                padding: '12px 24px',
                backgroundColor: '#e94560',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Scroll progress bar for mobile screens
function ScrollProgressBar() {
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) : 0;
      setScroll(progress);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Only show on mobile screens
  return (
    <div className="lg:hidden fixed top-0 left-0 w-full z-[60] pointer-events-none">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-b-full shadow-lg transition-all duration-300" style={{ width: `${scroll * 100}%` }} />
    </div>
  );
}
function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/verify-registration/:registrationId" element={
          <ErrorBoundary>
            <VerifyRegistration />
          </ErrorBoundary>
        } />
        <Route path="/join-team/:token" element={
          <ErrorBoundary>
            <JoinTeam />
          </ErrorBoundary>
        } />
        <Route path="/login" element={
          <ErrorBoundary>
            <Login />
          </ErrorBoundary>
        } />
        <Route path="/register" element={
          <ErrorBoundary>
            <Register />
          </ErrorBoundary>
        } />
        <Route path="/events" element={
          <ErrorBoundary>
            <Events />
          </ErrorBoundary>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Dashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Profile />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/user/:userId" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <UserProfile />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/admin-users" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <AdminUsers />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/events/:id" element={
          <ErrorBoundary>
            <EventDetails />
          </ErrorBoundary>
        } />
        <Route path="/events/:id/edit" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <CreateEvent />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/events/:eventId/waitlist" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <WaitlistManagement />
            </ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/create-event" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <CreateEvent />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/events/:eventId/create-sub-event" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <CreateSubEvent />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/sub-events/:id" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <SubEventDetails />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/sub-events/:id/edit" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <EditSubEvent />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/gallery" element={
          <ErrorBoundary>
            <Gallery />
          </ErrorBoundary>
        } />
        <Route path="/gallery/:eventId" element={
          <ErrorBoundary>
            <GalleryDetail />
          </ErrorBoundary>
        } />
        <Route path="/dashboard/gallery/:eventId" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <GalleryManager />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Notifications />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/notification-preferences" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <NotificationPreferences />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/privacy-settings" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PrivacySettings />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/event-analytics" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <EventAnalytics />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/send-announcement" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <SendAnnouncement />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/qr-scanner" element={
          <ProtectedRoute>
            <ErrorBoundary>
              <QRScannerPage />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/external-api" element={
          <ErrorBoundary>
            <ExternalAPI />
          </ErrorBoundary>
        } />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ConnectionProvider>
            <NotificationProvider>
              <EventProvider>
                <Router>
                  <ScrollToTop />
                  <ScrollProgressBar />
                  <ConnectionStatusBanner />
                  <div className="min-h-screen flex flex-col">
                    <Navbar />
                    <main className="flex-1 pb-16 lg:pb-0">
                      <AnimatedRoutes />
                    </main>
                    <BottomNav />
                    <OverlayFooter />
                    {/* Background job progress toasts */}
                    <BackgroundJobToast />
                  </div>
                </Router>
              </EventProvider>
            </NotificationProvider>
          </ConnectionProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;