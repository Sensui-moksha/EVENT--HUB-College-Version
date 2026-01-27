import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../contexts/EventContext.tsx';
import QRScanner from '../components/QRScanner';
import { QrCode, Users, CheckCircle, XCircle, Clock, Search } from 'lucide-react';

const QRScannerPage: React.FC = () => {
  const { user } = useAuth();
  const { events } = useEvents();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalScans: 0,
    successfulScans: 0,
    failedScans: 0,
  });

  // Only allow access to admin users or event organizers
  if (!user || (user.role !== 'admin' && user.role !== 'organizer')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const userEvents = user.role === 'admin' 
    ? events 
    : events.filter(event => event.organizer === user.id);

  const handleScanResult = (result: any) => {
    const newScan = {
      ...result,
      timestamp: new Date(),
      scannedBy: user.id,
    };
    
    setScanHistory(prev => [newScan, ...prev]);
    
    setStats(prev => ({
      totalScans: prev.totalScans + 1,
      successfulScans: result.success ? prev.successfulScans + 1 : prev.successfulScans,
      failedScans: !result.success ? prev.failedScans + 1 : prev.failedScans,
    }));
  };

  return (
    <motion.div 
      className="min-h-screen bg-gray-50 pt-24 pb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <QrCode className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">QR Scanner</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Scan QR codes to mark attendance for event participants
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.totalScans}</p>
                <p className="text-sm text-gray-600">Total Scans</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.successfulScans}</p>
                <p className="text-sm text-gray-600">Successful</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.failedScans}</p>
                <p className="text-sm text-gray-600">Failed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* QR Scanner Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Scanner</h2>
            
            {/* Event Selection */}
            <div className="mb-6">
              <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Event
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  id="event-select"
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select an event...</option>
                  {userEvents.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.title} - {new Date(event.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* QR Scanner Component */}
            {selectedEvent ? (
              <QRScanner
                eventId={selectedEvent}
                onScanComplete={handleScanResult}
              />
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Please select an event to start scanning</p>
              </div>
            )}
          </div>

          {/* Scan History Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Scan History</h2>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {scanHistory.length > 0 ? (
                scanHistory.map((scan, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      scan.success
                        ? 'bg-green-50 border-green-400'
                        : 'bg-red-50 border-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        {scan.success ? (
                          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 mr-2" />
                        )}
                        <span className={`font-medium ${
                          scan.success ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {scan.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {scan.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-700">
                      {scan.participantName && (
                        <p><strong>Participant:</strong> {scan.participantName}</p>
                      )}
                      {scan.eventTitle && (
                        <p><strong>Event:</strong> {scan.eventTitle}</p>
                      )}
                      {scan.message && (
                        <p><strong>Message:</strong> {scan.message}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No scans recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">How to Use</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">Camera Scanning:</h4>
              <ul className="space-y-1">
                <li>• Select an event from the dropdown</li>
                <li>• Click "Start Camera" to begin scanning</li>
                <li>• Point the camera at the QR code</li>
                <li>• The system will automatically detect and validate</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Manual Entry:</h4>
              <ul className="space-y-1">
                <li>• Click "Manual Entry" if camera is not available</li>
                <li>• Enter the QR code data manually</li>
                <li>• Click "Validate" to process the entry</li>
                <li>• Results will appear in the scan history</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default QRScannerPage;
