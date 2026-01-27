import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../contexts/EventContext';
import WaitingListManager from '../components/WaitingListManager';
import { motion } from 'framer-motion';
import { pageVariants } from '../utils/animations';
import { useToast } from '../components/ui/Toast';

const OrganizerRegistration: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, register, logout, loading } = useAuth();
  const { events, registrations } = useEvents();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const event = events.find(e => (e as any)._id === eventId || e.id === eventId);

  const isOrganizer = () => {
    if (!user || !event) return false;
    const organizerId = (event as any).organizerId || (event as any).organizer?._id || (event as any).organizer?.id;
    if ((user as any).role === 'admin') return true;
    const userId = (user as any).id || (user as any)._id;
    return String(organizerId) === String(userId);
  };

  // Public (not logged in): form state for organizer signup (keep hooks at top level)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    mobile: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      addToast({ type: 'error', title: 'Password mismatch', message: 'Passwords do not match.' });
      return;
    }
    if (formData.password.length < 6) {
      addToast({ type: 'error', title: 'Weak password', message: 'Password should be at least 6 characters.' });
      return;
    }
    if (!formData.name.trim() || !formData.email.trim() || !formData.mobile.trim()) {
      addToast({ type: 'error', title: 'Missing fields', message: 'Please fill all required fields.' });
      return;
    }
    try {
      await register({ ...formData, role: 'organizer' } as any);
      addToast({ type: 'success', title: 'Registered', message: 'You are now registered as an organizer.' });
      navigate(`/events/${eventId}`);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Registration failed', message: err?.message || 'Failed to register' });
    }
  };

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Event not found</h2>
          <p className="text-gray-600">The event you're looking for doesn't exist or hasn't loaded yet.</p>
          <div className="mt-4">
            <button onClick={() => navigate('/events')} className="px-4 py-2 bg-blue-600 text-white rounded">Back to events</button>
          </div>
        </div>
      </div>
    );
  }

  // If user is logged in and is the organizer (or admin), show management UI
  if (user && isOrganizer()) {
    const attendees = registrations.filter(r => String(r.eventId) === String(eventId) && r.approvalStatus === 'approved');

    return (
      <motion.div
        className="min-h-screen pt-24 pb-8"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Organizer Registration — {event.title}</h1>
              <p className="text-sm text-gray-600 mt-1">Manage waiting list and attendees for this event</p>
            </div>
            <div>
              <button onClick={() => navigate(`/events/${eventId}`)} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">Back to event</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <WaitingListManager eventId={eventId!} eventTitle={event.title} onUpdate={() => { /* refresh handled globally */ }} />
            </div>

            <div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Attendees ({attendees.length})</h3>
                <div className="mt-3 space-y-2">
                  {attendees.length === 0 ? (
                    <p className="text-sm text-gray-500">No attendees yet.</p>
                  ) : (
                    attendees.map((a: any) => (
                      <div key={a._id || a.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{a.user?.name || a.user?.email || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">Reg ID: {a.registrationId}</div>
                        </div>
                        <div className="text-xs text-gray-500">{new Date(a.approvedAt || a.registeredAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // If user is logged in but not the organizer, prompt to logout to register as organizer
  if (user && !isOrganizer()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">You are signed in</h2>
          <p className="text-gray-600">You are signed in as <strong>{(user as any).email || (user as any).name}</strong>. To register as an organizer for this event, please log out first.</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button onClick={() => { logout(); addToast({ type: 'info', title: 'Logged out', message: 'You can now register as an organizer.' }); }} className="px-4 py-2 bg-red-600 text-white rounded">Log out</button>
            <button onClick={() => navigate(`/events/${eventId}`)} className="px-4 py-2 bg-gray-100 rounded">Back to Event</button>
          </div>
        </div>
      </div>
    );
  }

  // Public (not logged in): show organizer signup form with role fixed to 'organizer'

  return (
    <motion.div
      className="min-h-screen pt-24 pb-8 flex items-center justify-center"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="max-w-lg w-full bg-white rounded-lg shadow border p-6">
        <h2 className="text-xl font-semibold mb-2">Organizer Signup — {event.title}</h2>
        <p className="text-sm text-gray-600 mb-4">Register as the event organizer. Your account will have the organizer role.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mobile</label>
            <input name="mobile" value={formData.mobile} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Department (optional)</label>
            <input name="department" value={formData.department} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input name="password" type="password" value={formData.password} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button disabled={loading} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create organizer account</button>
            <button type="button" onClick={() => navigate(`/events/${eventId}`)} className="px-3 py-2 bg-gray-100 rounded">Back to event</button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default OrganizerRegistration;
