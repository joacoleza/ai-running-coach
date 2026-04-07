import { NavLink } from "react-router-dom";

const navItems = [
  { path: "/plan", label: "Training Plan", icon: "📅" },
  { path: "/runs", label: "Runs", icon: "🏃" },
  { path: "/archive", label: "Archive", icon: "🗄️" },
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
];

export function Sidebar() {
  return (
    <aside
      className="flex flex-col bg-gray-900 text-white w-16 md:w-56 h-full sticky top-0 overflow-y-auto transition-all duration-200"
      data-testid="sidebar"
    >
      <div className="flex justify-center items-center py-3 md:hidden">
        <div className="bg-white rounded-full p-1.5 flex items-center justify-center">
          <img src="/favicon.png" alt="AI Running Coach" className="w-7 h-7" />
        </div>
      </div>
      <div className="flex justify-center p-4 hidden md:flex">
        <div className="bg-white rounded-full p-3 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="AI Running Coach"
            className="w-20 h-20 object-contain"
          />
        </div>
      </div>
      <nav
        className="flex-1 mt-4"
        role="navigation"
        aria-label="Main navigation"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={true}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-gray-800 text-white border-l-4 border-blue-500"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white border-l-4 border-transparent"
              }`
            }
          >
            <span className="text-lg" role="img" aria-label={item.label}>
              {item.icon}
            </span>
            <span className="ml-3 hidden md:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("app_password");
            window.location.href = "/";
          }}
          className="flex items-center w-full text-left px-4 py-3 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span className="ml-3 hidden md:inline">Logout</span>
        </button>
      </div>
    </aside>
  );
}
