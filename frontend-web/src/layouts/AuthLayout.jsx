import { Link } from 'react-router-dom';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-background flex flex-col font-display">
      <nav className="bg-white border-b border-primary-light px-6 py-3">
        <Link to="/login" className="flex items-center gap-2">
          <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-8 h-8" />
          <span className="font-bold text-primary-dark">Gyanavriksha</span>
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>

      <footer className="py-4 text-center text-sm text-slate-500 space-x-4">
        <span>Privacy Policy</span>
        <span>Terms of Service</span>
      </footer>
    </div>
  );
}
