import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UsageMeResponse {
  allTime: { cost: number; messages: number };
  thisMonth: { cost: number; messages: number };
  monthly: Array<{ year: number; month: number; cost: number; messages: number }>;
}

function formatCost(n: number): string {
  return '$' + n.toFixed(2);
}

function formatMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export function Usage() {
  const { token } = useAuth();
  const [data, setData] = useState<UsageMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/usage/me', {
          headers: { 'X-Authorization': `Bearer ${token ?? ''}` },
        });
        if (!res.ok) {
          setError('Failed to load usage data. Please refresh the page.');
          setLoading(false);
          return;
        }
        const json = await res.json() as UsageMeResponse;
        setData(json);
      } catch {
        setError('Failed to load usage data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }
    fetchUsage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Usage</h1>

      {loading && (
        <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-500 mb-1">All-time</p>
              <p className="text-2xl font-bold text-gray-900">{formatCost(data.allTime.cost)}</p>
              <p className="text-xs text-gray-400 mt-1">{data.allTime.messages} messages</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-500 mb-1">This month</p>
              <p className="text-2xl font-bold text-gray-900">{formatCost(data.thisMonth.cost)}</p>
              <p className="text-xs text-gray-400 mt-1">{data.thisMonth.messages} messages</p>
            </div>
          </div>

          {/* Monthly breakdown table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left bg-gray-50 border-b border-gray-200">Month</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left bg-gray-50 border-b border-gray-200">Cost</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left bg-gray-50 border-b border-gray-200">Messages</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-gray-400 text-sm text-center p-8">
                      No usage recorded yet
                    </td>
                  </tr>
                ) : (
                  data.monthly.map((row) => (
                    <tr key={`${row.year}-${row.month}`} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 text-sm text-gray-700">{formatMonth(row.year, row.month)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatCost(row.cost)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.messages}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
