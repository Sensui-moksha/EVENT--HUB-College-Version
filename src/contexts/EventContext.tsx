import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Event, Registration, EventResult, MultiEventRegistration, QRValidationResult } from '../types';
import { useAuth } from './AuthContext';
import { useConnection } from './ConnectionContext';
import { cacheManager, cacheKeys, CACHE_TTL, invalidateCache } from '../utils/cacheManager';
import { API_BASE_URL } from '../utils/api';

interface EventContextType {
  events: Event[];
  registrations: Registration[];
  results: EventResult[];
  registerForEvent: (eventId: string) => Promise<{ ok: boolean; pending?: boolean; already?: boolean; rejected?: boolean; message?: string }>; 
  registerForMultipleEvents: (eventIds: string[]) => Promise<MultiEventRegistration>;
  unregisterFromEvent: (eventId: string) => Promise<boolean>;
  removeParticipant: (eventId: string, userId: string) => Promise<boolean>;
  validateQRCode: (qrData: string, eventId?: string, scannedBy?: string, location?: string) => Promise<QRValidationResult>;
  createEvent: (eventData: Omit<Event, 'id' | 'createdAt' | 'currentParticipants' | 'organizer'>) => Promise<boolean>;
  updateEvent: (eventId: string, eventData: Partial<Event>) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
    deleteEvents: (eventIds: string[]) => Promise<{ success: string[]; failed: { eventId: string; reason: string }[] }>;
  addResult: (eventId: string, results: Omit<EventResult, 'id' | 'eventId' | 'createdAt'>[]) => Promise<boolean>;
  loading: boolean;
  isRefreshing: boolean;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const useEvents = () => {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
};

interface EventProviderProps {
  children: ReactNode;
}

export const EventProvider: React.FC<EventProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { checkConnection } = useConnection();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<EventResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [subEventCounts, setSubEventCounts] = useState<Record<string, number>>({});
  
  // Prevent duplicate fetches in React StrictMode
  const fetchInProgress = useRef(false);
  const initialFetchDone = useRef(false);

  // Merge sub-event counts into events so UI can show badges
  const enrichWithSubEventCounts = (list: any[], countsMap: Record<string, number>) => {
    return list.map((e: any) => {
      const key = e._id || e.id;
      const count = countsMap[key];
      return count !== undefined ? { ...e, subEventCount: count } : e;
    });
  };

    // Bulk delete events
    const deleteEvents = async (eventIds: string[]): Promise<{ success: string[]; failed: { eventId: string; reason: string }[] }> => {
      setLoading(true);
      const success: string[] = [];
      const failed: { eventId: string; reason: string }[] = [];
      for (const eventId of eventIds) {
        try {
          const ok = await deleteEvent(eventId);
          if (ok) {
            success.push(eventId);
          } else {
            failed.push({ eventId, reason: 'Delete failed' });
          }
        } catch (err: any) {
          failed.push({ eventId, reason: err?.message || 'Unknown error' });
        }
      }
      setLoading(false);
      await refreshData();
      return { success, failed };
    };

  // Safe response parser to avoid "Unexpected end of JSON input" when
  // the server returns empty responses (e.g. 403 with no body).
  const parseResponse = async (res: Response) => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      return { _rawText: text };
    }
  };

  // Fetch events from backend with caching
  const fetchEvents = async (forceRefresh = false) => {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedEvents = cacheManager.get<Event[]>(cacheKeys.events());
        if (cachedEvents) {
          setEvents(enrichWithSubEventCounts(cachedEvents, subEventCounts));
          // Refresh in background
          fetchEventsFromServer();
          return;
        }
      }
      
      await fetchEventsFromServer();
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setEvents([]);
    }
  };

  // Actual server fetch (separated for caching)
  const fetchEventsFromServer = async () => {
    try {
      const res = await fetch('/api/events');
      const data = await parseResponse(res);
      let eventList = [];
      if (res.ok && Array.isArray(data)) {
        eventList = data;
      } else if (res.ok && Array.isArray(data.events)) {
        eventList = data.events;
      }
      if (eventList.length > 0) {
        // Process event dates to ensure they're proper Date objects
        const processedEvents = eventList.map((event: any) => ({
          ...event,
          id: event._id || event.id, // Use _id from MongoDB, fallback to id
          date: new Date(event.date),
          registrationDeadline: new Date(event.registrationDeadline),
          createdAt: new Date(event.createdAt),
          // Ensure organizer field exists - backend populates organizerId with user data
          organizer: event.organizer || (typeof event.organizerId === 'object' ? event.organizerId : null)
        }));
        
        // Cache the processed events
        cacheManager.set(cacheKeys.events(), processedEvents, { ttl: CACHE_TTL.EVENTS });
        
        // Immediately enrich with any known counts (from cache)
        setEvents(enrichWithSubEventCounts(processedEvents, subEventCounts));
        // Fetch missing sub-event counts in the background (cached per event)
        updateSubEventCounts(processedEvents);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('Failed to fetch events from server:', error);
      // Check connection status when fetch fails
      checkConnection();
    }
  };

  // Fetch sub-event counts for events lacking it and cache results
  // Uses sequential batching to avoid rate limiting (429 errors)
  const updateSubEventCounts = async (eventsList: any[]) => {
    try {
      const ids = eventsList.map((e: any) => e._id || e.id).filter(Boolean);
      const missing = ids.filter((id: string) => subEventCounts[id] === undefined);
      if (missing.length === 0) return;

      // Limit to first 20 events and process in small batches to avoid rate limiting
      const toFetch = missing.slice(0, 20);
      const BATCH_SIZE = 3; // Process 3 requests at a time
      const results: { id: string; count: number }[] = [];

      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        const batch = toFetch.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (id: string) => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/events/${id}/sub-events`);
              if (res.status === 429) {
                // Rate limited - skip this one
                console.warn('Rate limited fetching sub-events for', id);
                return { id, count: 0 };
              }
              const data = await parseResponse(res);
              // Accept various shapes: { subEvents: [] } | [] | { count }
              const count = Array.isArray(data?.subEvents)
                ? data.subEvents.length
                : Array.isArray(data)
                ? data.length
                : typeof data?.count === 'number'
                ? data.count
                : 0;
              return { id, count };
            } catch (err) {
              console.warn('Failed to fetch sub-events for', id, err);
              return { id, count: 0 };
            }
          })
        );
        results.push(...batchResults);
        
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < toFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setSubEventCounts((prev) => {
        const next = { ...prev };
        results.forEach(({ id, count }) => (next[id] = count));
        return next;
      });

      // Update existing events with new counts
      setEvents((prev) => enrichWithSubEventCounts(prev as any[], Object.fromEntries(results.map(r => [r.id, r.count])) as Record<string, number>));
    } catch (err) {
      console.warn('updateSubEventCounts error', err);
    }
  };

  // Fetch registrations with caching
  const fetchRegistrations = async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cachedRegistrations = cacheManager.get<Registration[]>(cacheKeys.registrations());
        if (cachedRegistrations) {
          setRegistrations(cachedRegistrations);
          // Refresh in background
          fetchRegistrationsFromServer();
          return;
        }
      }
      
      await fetchRegistrationsFromServer();
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
    }
  };

  // Actual server fetch for registrations
  const fetchRegistrationsFromServer = async () => {
    try {
      const res = await fetch('/api/registrations', { credentials: 'include' });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Failed to fetch registrations: HTTP', res.status, data);
        setRegistrations([]); // Set empty array on error
        // Check connection status when fetch fails
        checkConnection();
        return;
      }
      if (data && Array.isArray(data.registrations)) {
        // Cache the registrations
        cacheManager.set(cacheKeys.registrations(), data.registrations, { ttl: CACHE_TTL.REGISTRATIONS });
        setRegistrations(data.registrations);
      } else {
        console.warn('Registrations response shape unexpected:', data);
        setRegistrations([]); // Set empty array on unexpected response
      }
    } catch (error) {
      console.error('Failed to fetch registrations from server:', error);
      setRegistrations([]); // Set empty array on error
      // Check connection status when fetch fails
      checkConnection();
    }
  };

  useEffect(() => {
    // Prevent duplicate fetches in React StrictMode
    if (initialFetchDone.current || fetchInProgress.current) return;
    
    // Initial data fetch
    const loadInitialData = async () => {
      fetchInProgress.current = true;
      setLoading(true);
      try {
        await Promise.all([fetchEvents(), fetchRegistrations()]);
      } finally {
        setLoading(false);
        fetchInProgress.current = false;
        initialFetchDone.current = true;
      }
    };

    loadInitialData();

    // Set up auto-refresh every 30 seconds (reduced from 5s due to caching)
    const refreshInterval = setInterval(() => {
      if (!fetchInProgress.current) {
        fetchEvents();
        fetchRegistrations();
      }
    }, 30000);

    // Set up visibility change listener to refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden && !fetchInProgress.current) {
        fetchEvents();
        fetchRegistrations();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up force refresh listener for manual triggers
    const handleForceRefresh = async () => {
      if (!fetchInProgress.current) {
        setIsRefreshing(true);
        try {
          await Promise.all([fetchEvents(), fetchRegistrations()]);
        } finally {
          setIsRefreshing(false);
        }
      }
    };

    window.addEventListener('forceRefresh', handleForceRefresh);

    // Cleanup
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('forceRefresh', handleForceRefresh);
    };
  }, []);

  // Auto-refresh data after any mutation (with cache invalidation)
  const refreshData = async () => {
    // Invalidate relevant caches
    invalidateCache.onEventChange();
    invalidateCache.onRegistrationChange();
    // Force refresh from server
    await Promise.all([fetchEvents(true), fetchRegistrations(true)]);
  };

  const registerForEvent = async (eventId: string): Promise<{ ok: boolean; pending?: boolean; already?: boolean; rejected?: boolean; message?: string }> => {
    if (!user) return { ok: false, message: 'Not authenticated' };
    setLoading(true);
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        console.error('Event not found:', eventId);
        return { ok: false, message: 'Event not found' };
      }

      // Use the original _id for the backend API call
      const backendEventId = (event as any)._id || event.id;
      // ...removed console log for production...

      const res = await fetch(`/api/events/${backendEventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Register API error:', res.status, data);
        if (res.status === 409) {
          // Handle known conflict states
          if (data?.status === 'pending') {
            return { ok: true, pending: true, message: data?.message || 'Registration pending approval' };
          }
          if (data?.status === 'rejected') {
            return { ok: false, rejected: true, message: data?.message || 'Registration rejected' };
          }
          return { ok: false, already: true, message: data?.error || 'Already registered' };
        }
        return { ok: false, message: data?.error || 'Registration failed' };
      }
      if (data && data.registration) {
        // Auto-refresh all data after successful registration
        await refreshData();
        const pending = data?.approvalStatus === 'pending' || data?.requiresApproval === true || data?.deadlinePassed === true;
        return { ok: true, pending, message: data?.message };
      }
      console.warn('Register response unexpected:', data);
      return { ok: false, message: 'Unexpected server response' };
    } catch (error) {
      console.error('Registration failed:', error);
      return { ok: false, message: 'Network error' };
    } finally {
      setLoading(false);
    }
  };

  const registerForMultipleEvents = async (eventIds: string[]): Promise<MultiEventRegistration> => {
    if (!user) {
      return {
        eventIds,
        userId: '',
        registrations: [],
        totalEvents: eventIds.length,
        successfulRegistrations: 0,
        failedRegistrations: eventIds.map(id => ({ eventId: id, reason: 'User not authenticated' }))
      };
    }

    setLoading(true);
    try {
      // Convert frontend event IDs to backend IDs
      const backendEventIds = eventIds.map(eventId => {
        const event = events.find(e => e.id === eventId || (e as any)._id === eventId);
        return (event && (event as any)._id) ? (event as any)._id : eventId;
      });

      const res = await fetch('/api/events/register-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user._id,
          eventIds: backendEventIds
        })
      });

      const data = await parseResponse(res);

      if (!res.ok) {
        console.error('Register-multiple API error:', res.status, data);
        return {
          eventIds,
          userId: user._id || '',
          registrations: [],
          totalEvents: eventIds.length,
          successfulRegistrations: 0,
          failedRegistrations: eventIds.map(id => ({ eventId: id, reason: data?.error || 'Registration failed' }))
        };
      }

      await fetchRegistrations(); // Refresh registrations
      return {
        eventIds,
        userId: user._id || '',
        registrations: data?.registrations || [],
        totalEvents: data?.totalEvents || eventIds.length,
        successfulRegistrations: data?.successfulRegistrations || 0,
        failedRegistrations: data?.failedRegistrations || []
      };
    } catch (error) {
      console.error('Multi-event registration failed:', error);
      return {
        eventIds,
        userId: user._id || '',
        registrations: [],
        totalEvents: eventIds.length,
        successfulRegistrations: 0,
        failedRegistrations: eventIds.map(id => ({ eventId: id, reason: 'Network error' }))
      };
    } finally {
      setLoading(false);
    }
  };

  const validateQRCode = async (
    qrData: string, 
    eventId?: string, 
    scannedBy?: string, 
    location?: string
  ): Promise<QRValidationResult> => {
    try {
      const res = await fetch('/api/qr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          qrData, 
          eventId, 
          scannedBy, 
          location 
        })
      });

      const data = await parseResponse(res);

      if (!res.ok) {
        console.error('QR validate API error:', res.status, data);
        return { valid: false, reason: data?.reason || 'QR validation failed' };
      }

      if (data.valid) {
        await fetchRegistrations(); // Refresh registrations if scan was valid
      }
      return data;
    } catch (error) {
      console.error('QR validation error:', error);
      return {
        valid: false,
        reason: 'Network error during QR validation'
      };
    }
  };

  const unregisterFromEvent = async (eventId: string): Promise<boolean> => {
    if (!user) return false;
    setLoading(true);
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        console.error('Event not found:', eventId);
        return false;
      }

      // Use the original _id for the backend API call
      const backendEventId = (event as any)._id || event.id;

      const res = await fetch(`/api/events/${backendEventId}/unregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Unregister API error:', res.status, data);
        return false;
      }
      if (data.success) {
        // Auto-refresh all data after successful unregistration
        await refreshData();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Unregistration failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeParticipant = async (eventId: string, userId: string): Promise<boolean> => {
    if (!user) return false;
    
    // Permission is enforced server-side (event owner + admin only)
    // Client-side: just check user is logged in

    setLoading(true);
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        console.error('Event not found:', eventId);
        return false;
      }

      // Use the original _id for the backend API call
      const backendEventId = (event as any)._id || event.id;

      const res = await fetch(`/api/events/${backendEventId}/remove-participant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: userId,
          removedBy: user._id 
        })
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Remove participant API error:', res.status, data);
        return false;
      }
      if (data.success) {
        // Auto-refresh all data after successful participant removal
        await refreshData();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Remove participant failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (eventData: Omit<Event, 'id' | 'createdAt' | 'currentParticipants' | 'organizer'>): Promise<boolean> => {
    if (!user) return false;
    setLoading(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventData, organizerId: user._id })
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Create event API error:', res.status, data);
        if (data?.error) throw new Error(data.error);
        throw new Error('Event creation failed');
      }
      if (data.event) {
        // Auto-refresh all data after successful event creation
        await refreshData();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Event creation failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateEvent = async (eventId: string, eventData: Partial<Event>): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Update event API error:', res.status, data);
        if (data?.error) throw new Error(data.error);
        throw new Error('Event update failed');
      }
      if (data.event) {
        const updatedEvent = { ...data.event, id: data.event._id };
        setEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
        await refreshData(); // Instant refresh after update
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Event update failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (eventId: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Always use _id for backend
      const event = events.find(e => e.id === eventId || (e as any)._id === eventId);
      const backendEventId = (event && (event as any)._id) ? (event as any)._id : eventId;
      const res = await fetch(`/api/events/${backendEventId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?._id || user?.id }),
        credentials: 'include'
      });
      
      // If response is ok (200-299), deletion was successful
      if (res.ok) {
        // IMMEDIATE: Remove from local state first for instant UI update
        setEvents(prev => prev.filter(e => {
          const eId = (e as any)._id || e.id;
          return eId !== eventId && eId !== backendEventId;
        }));
        
        // IMMEDIATE: Clear all related caches including localStorage
        invalidateCache.onEventChange(eventId);
        invalidateCache.onGalleryChange(eventId);
        invalidateCache.onRegistrationChange(eventId);
        
        // Clear the main events cache to force fresh data
        cacheManager.invalidate(cacheKeys.events());
        cacheManager.invalidate(cacheKeys.event(eventId));
        cacheManager.invalidate(cacheKeys.event(backendEventId));
        
        // Force a fresh fetch from server in background (no cache)
        setTimeout(() => {
          fetchEvents(true); // Force refresh
        }, 100);
        
        return true;
      }
      
      // If not ok, try to get error details
      const data = await parseResponse(res);
      console.error('Delete event API error:', res.status, data);
      return false;
    } catch (error) {
      console.error('Event deletion failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addResult = async (eventId: string, resultData: Omit<EventResult, 'id' | 'eventId' | 'createdAt'>[]): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: resultData })
      });
      const data = await parseResponse(res);
      if (!res.ok) {
        console.error('Add results API error:', res.status, data);
        return false;
      }
      if (data.results) {
        setResults(prev => [...prev, ...data.results]);
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'completed' as const } : e));
        await refreshData(); // Instant refresh after results
        return true;
      }
      return false;
    } catch (error) {
      console.error('Adding results failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    events,
    registrations,
    results,
    registerForEvent,
    registerForMultipleEvents,
    unregisterFromEvent,
    removeParticipant,
    validateQRCode,
    createEvent,
    updateEvent,
    deleteEvent,
      deleteEvents,
    addResult,
    loading,
    isRefreshing,
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
};