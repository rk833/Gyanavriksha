import { Link } from 'react-router-dom';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3">
        <Link to="/login" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center text-white font-bold text-sm">
            G
          </div>
          <span className="font-semibold text-gray-900">Gyanavriksha</span>
        </Link>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-gray-500 space-x-4">
        <span>Privacy Policy</span>
        <span>Terms of Service</span>
      </footer>
    </div>
  );
}
