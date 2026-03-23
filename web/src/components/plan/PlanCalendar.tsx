import { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { PlanSession } from '../../hooks/usePlan';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
});

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: PlanSession;
}

interface PlanCalendarProps {
  sessions: PlanSession[];
  units: string;
  onSelectSession: (session: PlanSession) => void;
}

// Color coding by session type (derived from notes field)
function getSessionColor(notes: string, completed: boolean): string {
  if (completed) return '#10B981'; // green for completed
  const lower = notes.toLowerCase();
  if (lower.includes('long')) return '#8B5CF6';    // purple
  if (lower.includes('tempo')) return '#F59E0B';   // amber
  if (lower.includes('interval') || lower.includes('speed')) return '#EF4444'; // red
  if (lower.includes('recovery') || lower.includes('rest')) return '#6B7280'; // gray
  if (lower.includes('cross') || lower.includes('xt')) return '#06B6D4'; // cyan
  return '#3B82F6'; // blue default (easy run)
}

export function PlanCalendar({ sessions, units, onSelectSession }: PlanCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const events: CalendarEvent[] = useMemo(() =>
    sessions.map(session => {
      const date = new Date(session.date + 'T08:00:00');
      const label = session.notes.split(/[.!,\n]/)[0]?.trim() || 'Run';
      return {
        title: `${label} - ${session.distance}${units}`,
        start: date,
        end: new Date(date.getTime() + (session.duration || 60) * 60 * 1000),
        resource: session,
      };
    }),
    [sessions, units]
  );

  // Navigate to the first session date when sessions load
  const firstSessionDate = useMemo(() => {
    if (sessions.length === 0) return new Date();
    return new Date(sessions[0].date + 'T08:00:00');
  }, [sessions]);

  return (
    <div style={{ height: 600 }}>
      <Calendar
        localizer={localizer}
        events={events}
        date={currentDate}
        onNavigate={setCurrentDate}
        defaultDate={firstSessionDate}
        defaultView="week"
        views={['week'] as View[]}
        style={{ height: '100%' }}
        onSelectEvent={(event) => onSelectSession((event as CalendarEvent).resource)}
        startAccessor="start"
        endAccessor="end"
        eventPropGetter={(event) => ({
          style: {
            backgroundColor: getSessionColor((event as CalendarEvent).resource.notes, (event as CalendarEvent).resource.completed),
            borderRadius: '4px',
            border: 'none',
            color: 'white',
            fontSize: '12px',
          },
        })}
      />
    </div>
  );
}
