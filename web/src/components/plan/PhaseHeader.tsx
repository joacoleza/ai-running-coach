import { useState, useRef, useEffect } from 'react';
import type { PlanPhase } from '../../hooks/usePlan';

interface PhaseHeaderProps {
  phase: PlanPhase;
  phaseIndex: number;
  isLastPhase: boolean;
  totalPhases: number;
  onUpdatePhase: (phaseIndex: number, updates: { name?: string; description?: string }) => Promise<void>;
  onDeletePhase?: () => Promise<void>;
  readonly?: boolean;
}

export function PhaseHeader({
  phase,
  phaseIndex,
  isLastPhase,
  totalPhases,
  onUpdatePhase,
  onDeletePhase,
  readonly,
}: PhaseHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleValue, setTitleValue] = useState(phase.name);
  const [descValue, setDescValue] = useState(phase.description);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep local state in sync when phase prop changes
  useEffect(() => { setTitleValue(phase.name); }, [phase.name]);
  useEffect(() => { setDescValue(phase.description); }, [phase.description]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingDesc) descTextareaRef.current?.focus();
  }, [editingDesc]);

  const saveTitle = async () => {
    if (isSavingTitle) return;
    const trimmed = titleValue.trim();
    if (!trimmed) {
      setTitleError('Phase name cannot be empty');
      return;
    }
    if (trimmed === phase.name) {
      setEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    setTitleError(null);
    try {
      await onUpdatePhase(phaseIndex, { name: trimmed });
      setEditingTitle(false);
    } catch (err) {
      setTitleError(err instanceof Error ? err.message : 'Failed to update phase name');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const cancelTitle = () => {
    setTitleValue(phase.name);
    setTitleError(null);
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    if (isSavingDesc) return;
    if (descValue === phase.description) {
      setEditingDesc(false);
      return;
    }
    setIsSavingDesc(true);
    setDescError(null);
    try {
      await onUpdatePhase(phaseIndex, { description: descValue });
      setEditingDesc(false);
    } catch (err) {
      setDescError(err instanceof Error ? err.message : 'Failed to update phase description');
    } finally {
      setIsSavingDesc(false);
    }
  };

  const cancelDesc = () => {
    setDescValue(phase.description);
    setDescError(null);
    setEditingDesc(false);
  };

  const handleDelete = async () => {
    if (!onDeletePhase) return;
    const confirmed = window.confirm(`Delete the last phase "${phase.name}"? This cannot be undone.`);
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await onDeletePhase();
    } catch (err) {
      // Surface error somehow — alert is acceptable for a destructive action
      alert(err instanceof Error ? err.message : 'Failed to delete phase');
    } finally {
      setIsDeleting(false);
    }
  };

  const showDeleteButton = isLastPhase && totalPhases > 1 && !readonly;

  return (
    <div className="mb-2">
      {editingTitle && !readonly ? (
        <div className="flex items-center gap-2 mb-1">
          <input
            ref={titleInputRef}
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void saveTitle(); }
              if (e.key === 'Escape') cancelTitle();
            }}
            onBlur={() => void saveTitle()}
            disabled={isSavingTitle}
            className="text-xl font-bold text-gray-900 border-b-2 border-blue-400 outline-none bg-transparent flex-1 text-[16px]"
            aria-label="Phase name"
          />
          {isSavingTitle && (
            <svg className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <h2
            className={`text-xl font-bold text-gray-900 ${!readonly ? 'cursor-pointer hover:text-blue-700 transition-colors' : ''}`}
            onClick={!readonly ? () => setEditingTitle(true) : undefined}
            title={!readonly ? 'Click to edit phase name' : undefined}
          >
            {phase.name}
          </h2>
          {showDeleteButton && (
            <button
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="cursor-pointer ml-auto text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed border border-red-200 rounded px-2 py-0.5 hover:bg-red-50 transition-colors"
              title="Delete last phase"
            >
              {isDeleting ? 'Deleting…' : 'Delete phase'}
            </button>
          )}
        </div>
      )}
      {titleError && <p className="text-red-500 text-xs mt-0.5">{titleError}</p>}

      {editingDesc && !readonly ? (
        <div className="flex flex-col gap-1 mt-1">
          <textarea
            ref={descTextareaRef}
            rows={2}
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelDesc();
            }}
            onBlur={() => void saveDesc()}
            disabled={isSavingDesc}
            className="text-gray-600 italic border border-blue-400 rounded px-2 py-1 outline-none bg-white text-sm text-[16px] resize-none"
            aria-label="Phase description"
          />
          {isSavingDesc && (
            <svg className="h-3 w-3 animate-spin text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
        </div>
      ) : (
        <p
          className={`text-gray-600 italic ${!readonly ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
          onClick={!readonly ? () => setEditingDesc(true) : undefined}
          title={!readonly ? 'Click to edit description' : undefined}
        >
          {phase.description || (!readonly ? <span className="text-gray-400 text-sm">Add description…</span> : null)}
        </p>
      )}
      {descError && <p className="text-red-500 text-xs mt-0.5">{descError}</p>}
    </div>
  );
}
