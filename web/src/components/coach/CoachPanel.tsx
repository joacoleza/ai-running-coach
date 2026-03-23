export function CoachPanel() {
  return (
    <aside className="flex flex-col w-80 lg:w-96 border-l border-gray-200 bg-white min-h-screen">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">AI Coach</h2>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 text-gray-400">
        <p>Coach chat loading...</p>
      </div>
    </aside>
  )
}
