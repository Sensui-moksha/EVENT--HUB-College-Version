import React, { useState, useCallback } from 'react';
import { useEvents } from '../contexts/EventContext.tsx';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/Toast';
import { Event, MultiEventRegistration } from '../types';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Plus,
  Minus,
  QrCode,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface MultiEventRegistrationProps {
  availableEvents: Event[];
  onRegistrationComplete?: (result: MultiEventRegistration) => void;
}

const MultiEventRegistrationComponent: React.FC<MultiEventRegistrationProps> = ({ 
  availableEvents, 
  onRegistrationComplete 
}) => {
  const { registerForMultipleEvents, loading } = useEvents();
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [registrationResult, setRegistrationResult] = useState<MultiEventRegistration | null>(null);
  const [showResult, setShowResult] = useState(false);

  const toggleEventSelection = useCallback((eventId: string) => {
    const newSelection = new Set(selectedEvents);
    if (newSelection.has(eventId)) {
      newSelection.delete(eventId);
    } else {
      newSelection.add(eventId);
    }
    setSelectedEvents(newSelection);
  }, [selectedEvents]);

  const handleSubmitRegistration = async () => {
    if (!user) {
      addToast({ 
        type: 'error', 
        title: 'Authentication Required',
        message: 'Please log in to register for events'
      });
      return;
    }

    if (selectedEvents.size === 0) {
      addToast({ 
        type: 'warning', 
        title: 'No Events Selected',
        message: 'Please select at least one event to register'
      });
      return;
    }

    try {
      const result = await registerForMultipleEvents(Array.from(selectedEvents));
      setRegistrationResult(result);
      setShowResult(true);
      
      if (result.successfulRegistrations > 0) {
        addToast({
          type: 'success',
          title: 'Registration Successful',
          message: `Successfully registered for ${result.successfulRegistrations} out of ${result.totalEvents} events`
        });
      }
      
      if (result.failedRegistrations.length > 0) {
        addToast({
          type: 'warning',
          title: 'Partial Registration',
          message: `Failed to register for ${result.failedRegistrations.length} events. Check details below.`
        });
      }

      onRegistrationComplete?.(result);
    } catch (error) {
      console.error('Registration error:', error);
      addToast({ 
        type: 'error', 
        title: 'Registration Failed',
        message: 'Registration failed. Please try again.'
      });
    }
  };

  const renderEventCard = (event: Event) => {
    const isSelected = selectedEvents.has(event.id);
    const isEventFull = event.currentParticipants >= event.maxParticipants;
    const isDeadlinePassed = new Date() > new Date(event.registrationDeadline);
    const canRegister = !isEventFull && !isDeadlinePassed && event.status === 'upcoming';

    return (
      <div
        key={event.id}
        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : canRegister
            ? 'border-gray-200 hover:border-gray-300'
            : 'border-red-200 bg-red-50 cursor-not-allowed opacity-60'
        }`}
        onClick={() => canRegister && toggleEventSelection(event.id)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">{event.title}</h3>
              {isSelected && <CheckCircle className="w-5 h-5 text-blue-500" />}
              {!canRegister && <XCircle className="w-5 h-5 text-red-500" />}
            </div>
            
            <p className="text-gray-600 mb-3 line-clamp-2">{event.description}</p>
            
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(event.date).toLocaleDateString()}</span>
                <Clock className="w-4 h-4 ml-2" />
                <span>{event.time}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{event.venue}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{event.currentParticipants} / {event.maxParticipants} registered</span>
              </div>
            </div>

            {!canRegister && (
              <div className="mt-2 text-sm text-red-600 font-medium">
                {isEventFull && "Event is full"}
                {isDeadlinePassed && "Registration deadline passed"}
                {event.status !== 'upcoming' && `Event is ${event.status}`}
              </div>
            )}
          </div>
          
          <button
            type="button"
            className={`ml-4 p-2 rounded-full ${
              isSelected 
                ? 'bg-blue-500 text-white' 
                : canRegister
                ? 'bg-gray-100 hover:bg-gray-200'
                : 'bg-gray-50 cursor-not-allowed'
            }`}
            disabled={!canRegister}
          >
            {isSelected ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  };

  const renderRegistrationResult = () => {
    if (!registrationResult || !showResult) return null;

    return (
      <div className="mt-6 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <QrCode className="w-6 h-6" />
          Registration Results
        </h3>
        
        <div className="mb-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-600 font-medium">
              ✓ Successful: {registrationResult.successfulRegistrations}
            </span>
            <span className="text-red-600 font-medium">
              ✗ Failed: {registrationResult.failedRegistrations.length}
            </span>
            <span className="text-gray-600">
              Total: {registrationResult.totalEvents}
            </span>
          </div>
        </div>

        {/* Successful Registrations with QR Codes */}
        {registrationResult.registrations.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Successfully Registered Events (QR Codes Generated)
            </h4>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {registrationResult.registrations.map((registration) => (
                <div key={registration.id} className="p-6 bg-white border-2 border-green-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  {/* Event Info Header */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">Successfully Registered</span>
                    </div>
                    <h5 className="font-bold text-gray-900 text-lg mb-1">
                      {registration.event.title}
                    </h5>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span>📅 {new Date(registration.event.date).toLocaleDateString()}</span>
                      <span>🕒 {registration.event.time}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-3">
                      📍 {registration.event.venue}
                    </div>
                  </div>

                  {/* QR Code Section */}
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="mb-3">
                      <h6 className="font-semibold text-gray-700 text-sm mb-2">Event QR Code</h6>
                      <p className="text-xs text-gray-600 mb-3">
                        Show this QR code at the event entrance for attendance
                      </p>
                    </div>
                    
                    {registration.qrCode && (
                      <div className="flex flex-col items-center">
                        <img 
                          src={registration.qrCode} 
                          alt={`QR Code for ${registration.event.title}`}
                          className="w-32 h-auto border border-gray-300 rounded-lg mb-2 bg-white"
                        />
                        <div className="text-xs text-gray-500 break-all max-w-full">
                          ID: {registration.registrationId}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Download/Share Options */}
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => {
                        // Create a downloadable link for the QR code
                        if (registration.qrCode) {
                          const link = document.createElement('a');
                          link.href = registration.qrCode;
                          link.download = `${registration.event.title}-QR-Code.png`;
                          link.click();
                        }
                      }}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      💾 Download QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Registrations */}
        {registrationResult.failedRegistrations.length > 0 && (
          <div>
            <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Failed Registrations
            </h4>
            <div className="space-y-2">
              {registrationResult.failedRegistrations.map((failure, index) => {
                const event = availableEvents.find(e => e.id === failure.eventId);
                return (
                  <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="font-medium text-red-800">
                      {event?.title || 'Unknown Event'}
                    </div>
                    <div className="text-sm text-red-600">
                      {failure.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowResult(false)}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Close Results
        </button>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Authentication Required</h3>
        <p className="text-gray-600">Please log in to register for events.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Multi-Event Registration
        </h2>
        <p className="text-gray-600 mb-4">
          Select multiple events to register for all at once. Each event will generate a unique QR code with the event name included.
        </p>
        
        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <QrCode className="w-4 h-4" />
            <span>Unique QR per event</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <Calendar className="w-4 h-4" />
            <span>Event name on QR code</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <CheckCircle className="w-4 h-4" />
            <span>Secure validation</span>
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      {selectedEvents.size > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">
            Selected Events ({selectedEvents.size})
          </h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedEvents).map(eventId => {
              const event = availableEvents.find(e => e.id === eventId);
              return (
                <span key={eventId} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {event?.title || 'Unknown Event'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Selection */}
      <div className="space-y-4 mb-6">
        {availableEvents.map(renderEventCard)}
      </div>

      {/* Registration Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmitRegistration}
          disabled={selectedEvents.size === 0 || loading}
          className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
            selectedEvents.size > 0 && !loading
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Registering...
            </span>
          ) : (
            `Register for ${selectedEvents.size} Event${selectedEvents.size !== 1 ? 's' : ''}`
          )}
        </button>
      </div>

      {/* Registration Results */}
      {renderRegistrationResult()}
    </div>
  );
};

export default MultiEventRegistrationComponent;
