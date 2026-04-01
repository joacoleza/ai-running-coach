import { useState, useEffect } from 'react';
import { fetchUnlinkedRuns, linkRun } from '../../hooks/useRuns';
import type { Run } from '../../hooks/useRuns';

interface LinkRunModalProps {
  weekNumber: number;
  dayLabel: string;
  dayGuidelines: string;
  onLinked: () => void;  // called after successful link (parent refreshes plan)
  onClose: () => void;
}

function formatRunDate(isoDate: string): string {
  // Format as "Monday 03/04/2026" (day-of-week + DD/MM/YYYY)
  const d = new Date(isoDate + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${weekday} ${dd}/${mm}/${yyyy}`;
}

function formatPace(pace: number): string {
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}/km`;
}

export function LinkRunModal({ weekNumber, dayLabel, dayGuidelines, onLinked, onClose }: LinkRunModalProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchUnlinkedRuns(100)
      .then(setRuns)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load runs');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleLink = async (run: Run) => {
    setIsLinking(true);
    setError(null);
    try {
      await linkRun(run._id, weekNumber, dayLabel);
      window.dispatchEvent(new Event('plan-updated'));
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link run');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Link a run to Week {weekNumber} Day {dayLabel}
          </h2>
          {dayGuidelines && (
            <p className="mt-1 text-sm text-gray-500">Target: {dayGuidelines}</p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Search input */}
          {!isLoading && runs.length > 0 && (
            <div className="mb-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by date or distance..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
              <svg className="h-5 w-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Loading runs...
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No unlinked runs available. Log a run from the Runs page first.
            </p>
          ) : (() => {
            const filtered = runs.filter(r => {
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return formatRunDate(r.date).toLowerCase().includes(q)
                || String(r.distance).includes(q);
            });

            return filtered.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No runs match your search.
              </p>
            ) : (
              <>
                {search.trim() && (
                  <p className="text-xs text-gray-400 mb-2">
                    Showing {filtered.length} of {runs.length} runs
                  </p>
                )}
                <ul className="space-y-2">
                  {filtered.map((run) => (
                    <li
                      key={run._id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <span className="text-sm text-gray-700">
                        {formatRunDate(run.date)} &middot; {run.distance}km &middot; {formatPace(run.pace)}
                      </span>
                      <button
                        onClick={() => { void handleLink(run); }}
                        disabled={isLinking}
                        className="cursor-pointer ml-3 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLinking ? 'Linking...' : 'Link'}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="cursor-pointer w-full text-sm text-gray-600 hover:text-gray-800 font-medium py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
