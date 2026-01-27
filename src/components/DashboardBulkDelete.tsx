import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useEvents } from '../contexts/EventContext.tsx';
import EventCard from './EventCard';

interface DashboardBulkDeleteProps {
  userEvents: any[];
}

const DashboardBulkDelete: React.FC<DashboardBulkDeleteProps> = ({ userEvents }) => {
  const { deleteEvents, loading } = useEvents();
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const handleSelectEvent = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEvents.length === userEvents.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(userEvents.map(e => e.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEvents.length === 0) return;
    const confirmed = window.confirm(`Delete ${selectedEvents.length} selected events?`);
    if (!confirmed) return;
    await deleteEvents(selectedEvents);
    setSelectedEvents([]);
  };

  return (
    <div>
      <div className="flex items-center mb-4 gap-4">
        <button
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={handleSelectAll}
          disabled={userEvents.length === 0}
        >
          {selectedEvents.length === userEvents.length && userEvents.length > 0
            ? 'Deselect All'
            : 'Select All'}
        </button>
        <button
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          onClick={handleBulkDelete}
          disabled={selectedEvents.length === 0 || loading}
        >
          <Trash2 className="w-4 h-4 inline mr-1" /> Delete Selected
        </button>
        {selectedEvents.length > 0 && (
          <span className="text-sm text-gray-600">{selectedEvents.length} selected</span>
        )}
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {userEvents.map(event => (
          <div key={event.id} className="relative">
            <input
              type="checkbox"
              className="absolute top-2 left-2 w-5 h-5 z-10"
              checked={selectedEvents.includes(event.id)}
              onChange={() => handleSelectEvent(event.id)}
              title="Select event"
            />
            <EventCard event={event} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardBulkDelete;