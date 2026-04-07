import { format, parseISO, isValid } from 'date-fns';

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  invalid?: boolean;
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, 'EEE d MMM yyyy') : iso; // e.g. "Mon 7 Apr 2026"
  } catch {
    return iso;
  }
}

export function DateInput({ value, onChange, min, max, className = '', invalid = false }: DateInputProps) {
  const display = formatDisplay(value);

  return (
    <div className={`relative ${className}`}>
      {/* Visible styled display */}
      <div
        className={`w-full border rounded px-2 py-1.5 text-sm flex items-center justify-between pointer-events-none select-none ${
          invalid
            ? 'border-red-400 bg-red-50 text-red-700'
            : 'border-gray-300 bg-white text-gray-800'
        }`}
      >
        <span>{display || <span className="text-gray-400">Select date</span>}</span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      </div>
      {/* Native input — transparent but interactive, covers the display */}
      <input
        type="date"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ fontSize: '16px' }} // prevent iOS zoom
      />
    </div>
  );
}
