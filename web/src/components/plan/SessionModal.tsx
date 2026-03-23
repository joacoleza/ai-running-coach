import { useState } from 'react';
import type { PlanSession } from '../../hooks/usePlan';

interface SessionModalProps {
  session: PlanSession;
  units: string;
  onSave: (sessionId: string, updates: Partial<PlanSession>) => Promise<void>;
  onClose: () => void;
}

export function SessionModal({ session, units, onSave, onClose }: SessionModalProps) {
  const [editing, setEditing] = useState<Partial<PlanSession>>({});
  const [saving, setSaving] = useState(false);

  const current = { ...session, ...editing };

  const handleFieldChange = (field: keyof PlanSession, value: string | number | boolean) => {
    setEditing(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (Object.keys(editing).length === 0) { onClose(); return; }
    setSaving(true);
    try {
      await onSave(session.id, editing);
      onClose();
    } catch {
      // Error handled by usePlan
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async () => {
    setSaving(true);
    try {
      await onSave(session.id, { completed: !session.completed });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Session Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input type="date" value={current.date} onChange={e => handleFieldChange('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Distance ({units})</label>
            <input type="number" step="0.1" value={current.distance} onChange={e => handleFieldChange('distance', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Duration (minutes)</label>
            <input type="number" value={current.duration ?? ''} onChange={e => handleFieldChange('duration', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Average Pace (mm:ss)</label>
            <input type="text" value={current.avgPace ?? ''} onChange={e => handleFieldChange('avgPace', e.target.value)}
              placeholder="e.g. 5:30"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Average BPM</label>
            <input type="number" value={current.avgBpm ?? ''} onChange={e => handleFieldChange('avgBpm', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={current.notes} onChange={e => handleFieldChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={handleToggleComplete} disabled={saving}
            className={`flex-1 px-4 py-2 rounded text-sm font-medium ${
              session.completed
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            } disabled:opacity-50`}>
            {session.completed ? 'Mark Incomplete' : 'Mark Complete'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
