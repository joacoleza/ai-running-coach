interface PlanActionsProps {
  hasActivePlan: boolean;
  onUpdate: () => void;
  onArchive: () => void;
}

export function PlanActions({ hasActivePlan, onUpdate, onArchive }: PlanActionsProps) {
  const handleArchive = () => {
    if (window.confirm('Archive this plan? You can view it later in the Archive section.')) {
      onArchive();
    }
  };

  if (!hasActivePlan) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={onUpdate}
        className="cursor-pointer px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
      >
        Update Plan
      </button>

      <button
        onClick={handleArchive}
        className="cursor-pointer px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
      >
        Close &amp; Archive
      </button>
    </div>
  );
}
