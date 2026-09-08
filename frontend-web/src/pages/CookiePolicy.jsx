import { Link, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

function PublicHeader() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm dark:shadow-none">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-8 h-8" />
          <span className="text-sm font-bold tracking-tight text-[#001256]">Gyanavriksha</span>
        </Link>
      </div>
    </nav>
  );
}

function PublicFooter() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-primary-light py-6">
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-6 h-6" />
          <span className="text-xs font-medium text-slate-600">Gyanavriksha © {currentYear}</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <a href="mailto:privacy@gyanavriksha.com.np" className="hover:underline">privacy@gyanavriksha.com.np</a>
          </span>
          <span className="inline-flex items-center gap-2">Lalitpur, Nepal</span>
        </div>
      </div>
    </footer>
  );
}

export default function CookiePolicy() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAuthenticatedRoute = pathname.startsWith('/student') || pathname.startsWith('/instructor') || pathname.startsWith('/admin');

  const content = (
    <main className="pt-24 pb-20 max-w-[920px] mx-auto px-6">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-primary mb-2">Cookie Policy</h1>
        <p className="text-on-surface-variant">This Cookie Policy explains how Gyanavriksha uses cookies and similar technologies.</p>
      </header>

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-primary mb-2">What are cookies?</h2>
          <p className="text-on-surface-variant">Cookies are small text files stored on your device when you visit websites. They help the site remember preferences and improve your experience.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary mb-2">How we use cookies</h2>
          <ul className="list-disc pl-6 text-on-surface-variant space-y-2">
            <li>Essential cookies: required for site security and authentication.</li>
            <li>Performance cookies: to measure usage and improve features.</li>
            <li>Functional cookies: to remember user preferences (language, theme).</li>
            <li>Third-party cookies: used by analytics and embedded services.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary mb-2">Your choices</h2>
          <p className="text-on-surface-variant">You can control cookies via your browser settings and opt-out of analytics cookies. Blocking some cookies may affect site functionality.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary mb-2">Third-party cookies</h2>
          <p className="text-on-surface-variant">We use third-party services (e.g., analytics). These providers operate under their own privacy policies; we recommend reviewing them directly.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary mb-2">Changes to this policy</h2>
          <p className="text-on-surface-variant">We may update this policy from time to time. The “Last updated” date at the top will indicate changes.</p>
        </div>

        <div id="contact" className="mt-8">
          <h3 className="text-base font-semibold">Contact</h3>
          <p className="text-on-surface-variant">For questions about cookies, email us at <a href="mailto:privacy@gyanavriksha.com.np" className="text-primary hover:underline">privacy@gyanavriksha.com.np</a>.</p>
        </div>
      </section>
    </main>
  );

  if (isAuthenticatedRoute) return content;

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#191c1e]">
      <PublicHeader />
      {content}
      <PublicFooter />
    </div>
  );
}
