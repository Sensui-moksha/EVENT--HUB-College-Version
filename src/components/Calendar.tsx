import { useMemo, useState, useEffect, useRef } from 'react';
import { useEvents } from '../contexts/EventContext.tsx';
import { Event } from '../types';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FocusTrap from 'focus-trap-react';

// Category color mapping — adjust to taste
const CATEGORY_COLORS: Record<string, string> = {
  technical: 'bg-indigo-600',
  cultural: 'bg-pink-600',
  sports: 'bg-emerald-600',
  workshop: 'bg-amber-500',
  seminar: 'bg-sky-600',
};

const pad = (n: number) => n.toString().padStart(2, '0');

// Normalize a date (Date or ISO string) to a local Date at midnight (Y-M-D) to avoid
// timezone-induced day shifts when parsing ISO strings like '2026-01-01'.
const normalizeToLocalDate = (input: Date | string | undefined) => {
  if (!input) return new Date();
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  // If string, try to extract YYYY-MM-DD prefix and build local Date
  const s = String(input);
  const dateOnly = s.slice(0, 10); // YYYY-MM-DD
  const parts = dateOnly.split('-').map(p => parseInt(p, 10));
  if (parts.length === 3 && !Number.isNaN(parts[0])) {
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }
  // Fallback: create Date from input and normalize
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const toDateKey = (d: Date | string | undefined) => {
  const nd = normalizeToLocalDate(d);
  return `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}`;
};

  // Format date to Google Calendar/ICS timestamp: YYYYMMDDTHHMMSSZ (UTC)
  const toUTCStamp = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const mm = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    return `${y}${m}${day}T${hh}${mm}${ss}Z`;
  };

  // Combine event.date (Date) and event.time (HH:mm) into a Date object
  const combineDateTime = (date: Date, time?: string) => {
    const d = new Date(date);
    if (!time) return d;
    const parts = time.split(':').map(p => parseInt(p, 10));
    if (parts.length >= 1) d.setHours(parts[0]);
    if (parts.length >= 2) d.setMinutes(parts[1]);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  };

  const googleCalendarUrl = (ev: Event) => {
    try {
      const startLocal = combineDateTime(new Date(ev.date), ev.time);
      const endLocal = new Date(startLocal.getTime() + 1000 * 60 * 60 * 2); // default 2 hours
      const start = toUTCStamp(startLocal);
      const end = toUTCStamp(endLocal);
      const text = encodeURIComponent(ev.title || 'Event');
      const details = encodeURIComponent(ev.description || '');
      const location = encodeURIComponent(ev.venue || '');
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}&dates=${start}%2F${end}`;
    } catch (e) {
      return '#';
    }
  };

  const androidIntentUrl = (ev: Event) => {
    try {
      const startLocal = combineDateTime(new Date(ev.date), ev.time);
      const endLocal = new Date(startLocal.getTime() + 1000 * 60 * 60 * 2);
      const title = encodeURIComponent(ev.title || 'Event');
      const description = encodeURIComponent(ev.description || '');
      const location = encodeURIComponent(ev.venue || '');
      const beginTime = startLocal.getTime();
      const endTime = endLocal.getTime();

      // Build intent URI; l.beginTime and l.endTime are long extras
      // Example: intent://#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.item/event;S.title=...;S.description=...;S.eventLocation=...;l.beginTime=...;l.endTime=...;end
      const parts = [
        'intent://#Intent',
        'action=android.intent.action.INSERT',
        'type=vnd.android.cursor.item/event',
        `S.title=${title}`,
        `S.description=${description}`,
        `S.eventLocation=${location}`,
        `l.beginTime=${beginTime}`,
        `l.endTime=${endTime}`,
        'end'
      ];

      return parts.join(';');
    } catch (e) {
      return '#';
    }
  };

  const generateICS = (ev: Event) => {
    const uid = `${ev.id}-${Date.now()}@eventhub.local`;
    const start = toUTCStamp(combineDateTime(new Date(ev.date), ev.time));
    const end = toUTCStamp(new Date(new Date(combineDateTime(new Date(ev.date), ev.time)).getTime() + 1000 * 60 * 60 * 2));
    const escapeICSText = (s: string) =>
      s
        .replace(/\\/g, '\\\\') // backslash -> \\\\ (escaped for ICS)
        .replace(/\r?\n/g, '\\n') // newline -> \n
        .replace(/,/g, '\\,') // comma -> \\,
        .replace(/;/g, '\\;'); // semicolon -> \;

    const description = escapeICSText(ev.description || '');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EventHub//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toUTCStamp(new Date())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${ev.venue || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    return lines.join('\r\n');
  };

  const downloadICS = (ev: Event) => {
    const ics = generateICS(ev);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (ev.title || 'event').replace(/[^a-z0-9-_]/gi, '_').toLowerCase();

    // Heuristic: on mobile devices, opening the blob URL will usually prompt the device
    // to offer importing the .ics into the native calendar app. On desktop, force download.
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

    try {
      if (isMobile) {
        // Try opening in a new window/tab so the OS can handle the .ics (may prompt to add to calendar)
        const opened = window.open(url, '_blank');
        if (!opened) {
          // Popup blocked, fallback to navigating the current window
          window.location.href = url;
        }
      } else {
        // Desktop: trigger a download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle}.ics`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      // Cleanup object URL after a slight delay to allow navigation/download to start
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  };

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export default function CalendarComponent() {
  const { events, registrations } = useEvents();
  const [fetchedEvents, setFetchedEvents] = useState<Event[] | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');

  // Map events by date key YYYY-MM-DD
  // Ensure calendar shows all events regardless of the user by merging context events
  // with a direct fetch to /api/events (fallback). This covers cases where the
  // EventContext might filter events by user or role.
  useEffect(() => {
    // Only fetch on mount (or when fetchedEvents is null) - use refetchEvents to force reload
    let cancelled = false;
    const fetchAll = async () => {
      try {
        const res = await fetch('/api/events');
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        let eventList: any[] = [];
        if (Array.isArray(data)) eventList = data;
        else if (data && Array.isArray(data.events)) eventList = data.events;

        if (!cancelled) {
          const processed = eventList.map((ev: any) => ({
            ...ev,
            id: ev._id || ev.id,
            // normalize date to local Y-M-D (midnight)
            date: normalizeToLocalDate(ev.date),
            registrationDeadline: ev.registrationDeadline ? normalizeToLocalDate(ev.registrationDeadline) : undefined,
            createdAt: ev.createdAt ? normalizeToLocalDate(ev.createdAt) : undefined,
          })) as Event[];
          setFetchedEvents(processed);
        }
      } catch (err) {
        console.error('Failed to fetch events for calendar fallback', err);
        if (!cancelled) setFetchedEvents([]);
      }
    };
    if (fetchedEvents === null) fetchAll();
    return () => { cancelled = true; };
  }, [fetchedEvents]);

  // Exposed refetch function
  const refetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      let eventList: any[] = [];
      if (Array.isArray(data)) eventList = data;
      else if (data && Array.isArray(data.events)) eventList = data.events;
      const processed = eventList.map((ev: any) => ({
        ...ev,
        id: ev._id || ev.id,
        date: normalizeToLocalDate(ev.date),
        registrationDeadline: ev.registrationDeadline ? normalizeToLocalDate(ev.registrationDeadline) : undefined,
        createdAt: ev.createdAt ? normalizeToLocalDate(ev.createdAt) : undefined,
      })) as Event[];
      setFetchedEvents(processed);
    } catch (err) {
      console.error('Refetch failed', err);
    }
  };

  const mergedEvents = useMemo(() => {
    const map = new Map<string, Event>();
    (fetchedEvents || []).forEach(e => { if (e && e.id) map.set(String(e.id), e); });
    (events || []).forEach(e => { if (e && e.id) map.set(String(e.id), e); });
    return Array.from(map.values());
  }, [events, fetchedEvents]);

  const eventsByDate = useMemo(() => {
    let source = mergedEvents;
    
    // If "My events" mode, filter to only show events the user has registered for
    if (viewMode === 'mine') {
      const registeredEventIds = new Set(
        registrations.map(reg => String(reg.eventId))
      );
      source = mergedEvents.filter(event => 
        registeredEventIds.has(String(event.id))
      );
    }
    
    const map: Record<string, Event[]> = {};
    (source || []).forEach(e => {
      const key = toDateKey(e.date);
      if (!map[key]) map[key] = [];
      const ev = { ...e, date: normalizeToLocalDate(e.date) } as Event;
      map[key].push(ev);
    });
    return map;
  }, [mergedEvents, registrations, viewMode]);

  const firstDay = useMemo(() => startOfMonth(current), [current]);
  const lastDay = useMemo(() => endOfMonth(current), [current]);

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    // Determine how many blank days at start (Sunday = 0)
    const startWeekday = firstDay.getDay();
    // Fill previous month's tail
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() - (i + 1));
      days.push(d);
    }

    // This month's days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(current.getFullYear(), current.getMonth(), i));
    }

    // Fill next month's head to complete the last week
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1];
      const d = new Date(last);
      d.setDate(last.getDate() + 1);
      days.push(d);
    }

    return days;
  }, [current, firstDay, lastDay]);

  const prevMonth = () => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  const nextMonth = () => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDate(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // focus-trap-react will manage focus trapping when modal is present

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-8 py-4 md:py-8 transition-all duration-300">
  <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">Calendar</h2>
            <p className="text-xs sm:text-sm text-gray-500">Browse events by date</p>
          </div>
          {/* Month Navigation - Always visible */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={prevMonth}
              aria-label="Previous month"
              className="p-1.5 sm:p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md"
            >
              <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>
            <div className="px-2 sm:px-6 py-1 sm:py-2 font-semibold text-sm sm:text-lg text-gray-800 min-w-[100px] sm:min-w-[160px] text-center">
              {current.toLocaleString(undefined, { month: 'short', year: 'numeric' })}
            </div>
            <button
              onClick={nextMonth}
              aria-label="Next month"
              className="p-1.5 sm:p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md"
            >
              <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
        
        {/* Controls Row - Legend, View Toggle, Refresh */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          {/* Legend - Hidden on very small screens */}
          <div className="hidden md:flex flex-wrap items-center gap-2 sm:gap-3">
            {Object.keys(CATEGORY_COLORS).map(cat => (
              <div key={cat} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <span className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${CATEGORY_COLORS[cat]}`}></span>
                <span className="capitalize text-gray-600">{cat}</span>
              </div>
            ))}
          </div>
          
          {/* View Toggle and Refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <div className="inline-flex rounded-md bg-gray-100 p-0.5 sm:p-1">
              <button
                onClick={() => setViewMode('all')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded ${viewMode === 'all' ? 'bg-white shadow' : 'text-gray-600'}`}
                aria-pressed={viewMode === 'all'}
              >
                All
              </button>
              <button
                onClick={() => setViewMode('mine')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded ${viewMode === 'mine' ? 'bg-white shadow' : 'text-gray-600'}`}
                aria-pressed={viewMode === 'mine'}
              >
                My events
              </button>
            </div>
            <button
              onClick={() => refetchEvents()}
              title="Refresh events"
              className="px-2 sm:px-3 py-1 bg-gray-100 rounded text-xs sm:text-sm hover:bg-gray-200"
            >
              Refresh
            </button>
            <div className="text-xs sm:text-sm text-gray-500">
              {Object.keys(eventsByDate).reduce((acc, k) => acc + (eventsByDate[k]?.length || 0), 0)} events
            </div>
          </div>
        </div>
      </div>

  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center min-h-[300px] sm:min-h-[350px] md:min-h-[420px] lg:min-h-[500px]">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-xs text-gray-500 py-1 sm:hidden">{d}</div>
        ))}
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-xs text-gray-500 py-1 hidden sm:block">{d}</div>
        ))}

        {calendarDays.map((day, idx) => {
          const key = toDateKey(day);
          const isCurrentMonth = day.getMonth() === current.getMonth();
          const hasEvents = !!eventsByDate[key] && eventsByDate[key].length > 0;
          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(key)}
              className={`min-h-[50px] sm:min-h-[80px] p-1 sm:p-2 flex flex-col items-start justify-between border rounded-md transition-colors text-left
                ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                ${hasEvents ? 'ring-2 ring-blue-200' : 'hover:bg-gray-100'}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs sm:text-sm font-medium">{day.getDate()}</span>
                {hasEvents && (
                  <span className="bg-blue-600 text-white text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 rounded-full">
                    {eventsByDate[key].length}
                  </span>
                )}
              </div>
              <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs w-full hidden sm:block">
                {hasEvents && eventsByDate[key].slice(0,2).map(ev => (
                  <div key={ev.id} className="truncate text-gray-700">{ev.title}</div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <FocusTrap
            active
            focusTrapOptions={{
              initialFocus: '#calendar-close-btn',
              // fallbackFocus helps in testing/environments where the initially targeted element
              // might not be present immediately. Use the modal container when available.
              fallbackFocus: () => modalRef.current as HTMLElement,
              onActivate: () => {
                // store last focused element to restore later
                lastFocusedRef.current = document.activeElement as HTMLElement | null;
              },
              onDeactivate: () => {
                // restore focus to the element that opened the modal
                lastFocusedRef.current?.focus();
              }
            }}
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-modal-title"
              className="bg-white max-w-2xl w-full rounded-lg shadow-lg overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 id="calendar-modal-title" className="font-semibold">Events on {selectedDate}</h3>
                <button
                  id="calendar-close-btn"
                  onClick={() => setSelectedDate(null)}
                  aria-label="Close events modal"
                  className="text-gray-600 px-2 py-1"
                >
                  Close
                </button>
              </div>
              <div className="p-4">
              {/* ARIA live region for screen readers */}
              <div aria-live="polite" className="sr-only" data-testid="aria-live">
                {eventsByDate[selectedDate] ? `${eventsByDate[selectedDate].length} events on ${selectedDate}` : `No events on ${selectedDate}`}
              </div>
              {(eventsByDate[selectedDate] && eventsByDate[selectedDate].length > 0) ? (
                <ul className="space-y-3">
                  {eventsByDate[selectedDate].map(ev => (
                    <li key={ev.id} className="border rounded p-3 flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[ev.category] || 'bg-gray-300'}`}></span>
                          <Link to={`/events/${ev.id || (ev as any)._id}`} className="text-blue-600 font-medium">{ev.title}</Link>
                        </div>
                        <div className="text-sm text-gray-600">{ev.time} • {ev.venue}</div>
                        <div className="text-xs text-gray-500 mt-1">{ev.description}</div>
                      </div>
                      <div className="ml-0 sm:ml-4 text-right flex flex-col items-end gap-2">
                        <div className="text-sm text-gray-500">{new Date(ev.date).toLocaleString()}</div>
                        <div className="flex gap-2 mt-2">
                          <a
                            href={googleCalendarUrl(ev)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Add to Google
                          </a>
                          {/Android/i.test(navigator.userAgent) && (
                            <a
                              href={androidIntentUrl(ev)}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                              Open in Android
                            </a>
                          )}
                          <button
                            onClick={() => downloadICS(ev)}
                            className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm hover:bg-gray-200"
                          >
                            Add to Calendar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">No events on this date.</p>
              )}
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  );
}
