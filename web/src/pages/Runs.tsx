import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchRuns } from '../hooks/useRuns';
import type { Run } from '../hooks/useRuns';
import { RunEntryForm } from '../components/runs/RunEntryForm';
import { RunDetailModal } from '../components/runs/RunDetailModal';

const PAGE_SIZE = 20;

function formatRunDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${weekday} ${dd}/${mm}/${d.getFullYear()}`;
}

function formatPace(pace: number): string {
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

interface RunRowProps {
  run: Run;
  onClick: () => void;
}

function RunRow({ run, onClick }: RunRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 hover:bg-gray-50 border-b border-gray-100 flex items-center justify-between cursor-pointer"
    >
      <div>
        <div className="font-medium text-gray-900">{formatRunDate(run.date)}</div>
        <div className="text-sm text-gray-500">
          {run.distance}km &middot; {run.duration} &middot; {formatPace(run.pace)}
          {run.avgHR ? ` · ${run.avgHR}bpm` : ''}
        </div>
      </div>
      {run.weekNumber && (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full ml-2 whitespace-nowrap">
          Week {run.weekNumber} &middot; Day {run.dayLabel}
        </span>
      )}
    </button>
  );
}

interface FilterPanelProps {
  dateFrom: string;
  dateTo: string;
  distanceMin: string;
  distanceMax: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onDistanceMinChange: (v: string) => void;
  onDistanceMaxChange: (v: string) => void;
  onClear: () => void;
}

function FilterPanel({
  dateFrom,
  dateTo,
  distanceMin,
  distanceMax,
  onDateFromChange,
  onDateToChange,
  onDistanceMinChange,
  onDistanceMaxChange,
  onClear,
}: FilterPanelProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 space-y-3 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Min distance (km)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={distanceMin}
            onChange={(e) => onDistanceMinChange(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Max distance (km)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={distanceMax}
            onChange={(e) => onDistanceMaxChange(e.target.value)}
            placeholder="Any"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button
        onClick={onClear}
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Clear filters
      </button>
    </div>
  );
}

export function Runs() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [distanceMin, setDistanceMin] = useState('');
  const [distanceMax, setDistanceMax] = useState('');

  // Use refs for offset and total to avoid stale closures in IntersectionObserver
  const offsetRef = useRef(0);
  const totalRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Prevent concurrent loads (reset + observer firing simultaneously on filter change)
  const loadingRef = useRef(false);

  // loadRuns accepts filters as params and reads offset from ref — no stale closure issues
  const loadRuns = useCallback(
    async (reset: boolean, filters: { dateFrom?: string; dateTo?: string; distanceMin?: number; distanceMax?: number }) => {
      if (loadingRef.current) return; // prevent concurrent loads (race between reset and observer)
      loadingRef.current = true;
      const currentOffset = reset ? 0 : offsetRef.current;
      if (reset) {
        setIsLoading(true);
        offsetRef.current = 0;
      } else {
        setIsLoadingMore(true);
      }
      try {
        const result = await fetchRuns({
          limit: PAGE_SIZE,
          offset: currentOffset,
          ...filters,
        });
        setRuns((prev) => (reset ? result.runs : [...prev, ...result.runs]));
        totalRef.current = result.total;
        setTotalAll(result.totalAll);
        offsetRef.current = reset ? result.runs.length : currentOffset + result.runs.length;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load runs');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [] // no dependencies — filters come as params, offset is a ref
  );

  // Helper to build current filters from state — stable reference when filters haven't changed
  const currentFilters = useCallback(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    distanceMin: distanceMin ? parseFloat(distanceMin) : undefined,
    distanceMax: distanceMax ? parseFloat(distanceMax) : undefined,
  }), [dateFrom, dateTo, distanceMin, distanceMax]);

  // Load on mount and filter changes
  useEffect(() => {
    void loadRuns(true, currentFilters());
  }, [loadRuns, currentFilters]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && offsetRef.current < totalRef.current && !isLoadingMore) {
        void loadRuns(false, currentFilters());
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [isLoadingMore, loadRuns, currentFilters]);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDistanceMin('');
    setDistanceMax('');
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Runs</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Filter
          </button>
          <button
            onClick={() => setShowLogForm(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Log a run
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel
          dateFrom={dateFrom}
          dateTo={dateTo}
          distanceMin={distanceMin}
          distanceMax={distanceMax}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onDistanceMinChange={setDistanceMin}
          onDistanceMaxChange={setDistanceMax}
          onClear={clearFilters}
        />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Runs list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading runs...</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 text-sm">No runs yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Log your first run using the button above.
            </p>
          </div>
        ) : (
          <>
            {runs.map((run) => (
              <RunRow
                key={run._id}
                run={run}
                onClick={() => setSelectedRun(run)}
              />
            ))}
          </>
        )}
        <div ref={sentinelRef} />
        {isLoadingMore && (
          <div className="p-4 text-center text-gray-400 text-sm">Loading more...</div>
        )}
      </div>

      {/* Run count */}
      {!isLoading && runs.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-3">
          Showing {runs.length} of {totalAll} run{totalAll !== 1 ? 's' : ''}
        </p>
      )}

      {/* Log a run modal */}
      {showLogForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowLogForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 my-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-gray-900 mb-3">Log a run</h2>
            <RunEntryForm
              onSave={() => {
                setShowLogForm(false);
                void loadRuns(true, currentFilters());
              }}
              onCancel={() => setShowLogForm(false)}
            />
          </div>
        </div>
      )}

      {/* Run detail modal */}
      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onUpdated={(updated) => {
            setRuns((prev) =>
              prev.map((r) => (r._id === updated._id ? updated : r))
            );
            setSelectedRun(updated);
          }}
          onDeleted={(id) => {
            setRuns((prev) => prev.filter((r) => r._id !== id));
            totalRef.current = Math.max(0, totalRef.current - 1);
            setTotalAll((t) => Math.max(0, t - 1));
            offsetRef.current = Math.max(0, offsetRef.current - 1);
            setSelectedRun(null);
          }}
        />
      )}
    </div>
  );
}
