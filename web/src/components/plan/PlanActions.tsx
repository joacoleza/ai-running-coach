interface PlanActionsProps {
  hasActivePlan: boolean;
  onCreateNew: () => void;
  onImport: () => void;
  onUpdate: () => void;
  onArchive: () => void;
}

export function PlanActions({ hasActivePlan, onCreateNew, onImport, onUpdate, onArchive }: PlanActionsProps) {
  const handleArchive = () => {
    if (window.confirm('Archive this plan? You can view it later in the Archive section.')) {
      onArchive();
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {!hasActivePlan && (
        <button
          onClick={onCreateNew}
          className="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          New Plan
        </button>
      )}

      <button
        onClick={onImport}
        className="px-4 py-2 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
      >
        Import from ChatGPT
      </button>

      {hasActivePlan && (
        <>
          <button
            onClick={onUpdate}
            className="px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Update Plan
          </button>

          <button
            onClick={handleArchive}
            className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Close &amp; Archive
          </button>
        </>
      )}
    </div>
  );
}
