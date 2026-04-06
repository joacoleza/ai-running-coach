interface PlanActionsProps {
  hasActivePlan: boolean;
  onArchive: () => void;
}

export function PlanActions({ hasActivePlan, onArchive }: PlanActionsProps) {
  const handleArchive = () => {
    if (window.confirm('Archive this plan? You can view it later in the Archive section.')) {
      onArchive();
    }
  };

  if (!hasActivePlan) return null;

  return (
    <button
      onClick={handleArchive}
      className="cursor-pointer px-2 py-1 rounded text-xs font-medium text-gray-500 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
    >
      Archive
    </button>
  );
}
