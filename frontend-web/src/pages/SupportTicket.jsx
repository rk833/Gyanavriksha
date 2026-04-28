import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, HelpCircle, Mail, Upload } from 'lucide-react';
import useAuth from '../hooks/useAuth';

function PublicHeader() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-primary-light">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-8 h-8" />
          <span className="text-2xl font-bold tracking-tighter text-[#001256]">Gyanavriksha</span>
        </Link>
      </div>
    </nav>
  );
}

function PublicFooter() {
  return (
    <footer className="bg-[#001256] w-full pt-16 pb-8 border-t border-white/10">
      <div className="max-w-[1200px] mx-auto px-6">
        <p className="font-['Inter'] text-slate-300 text-sm opacity-80">© 2026 Gyanavriksha. The Knowledge Sanctuary.</p>
      </div>
    </footer>
  );
}

export default function SupportTicket() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAuthenticatedRoute = pathname.startsWith('/student') || pathname.startsWith('/instructor') || pathname.startsWith('/admin');
  const [formState, setFormState] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    role: 'Student',
    category: 'Technical Issue',
    priority: 'Medium',
    subject: '',
    description: '',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const content = (
    <>
      <section className="max-w-[1200px] mx-auto px-6 mb-12">
        <div className="bg-primary rounded-xl p-10 md:p-16 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">Submit a Support Request</h1>
            <p className="text-white text-lg leading-relaxed opacity-90">Our dedicated team of academic experts and technical support are ready to assist you. Tell us about the issue you're facing and we'll resolve it together.</p>
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-8 text-primary">Ticket Details</h2>
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Full Name</label>
                  <input name="fullName" value={formState.fullName} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all" placeholder="John Doe" type="text" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Email Address</label>
                  <input name="email" value={formState.email} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all" placeholder="john@example.com" type="email" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Role</label>
                  <select name="role" value={formState.role} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none appearance-none">
                    <option>Student</option>
                    <option>Parent</option>
                    <option>Teacher</option>
                    <option>Administrator</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Category</label>
                  <select name="category" value={formState.category} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none">
                    <option>Technical Issue</option>
                    <option>Course Access</option>
                    <option>Billing &amp; Payments</option>
                    <option>Feature Request</option>
                    <option>Report Content</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Priority</label>
                  <select name="priority" value={formState.priority} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Subject</label>
                <input name="subject" value={formState.subject} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none" placeholder="Brief summary of the issue" type="text" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Description</label>
                <textarea name="description" value={formState.description} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none resize-none" placeholder="Please provide detailed information including steps to reproduce the issue..." rows="6" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Attachment</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-outline-variant rounded-xl cursor-pointer bg-surface-container-low hover:bg-surface-container transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 text-on-surface-variant mb-2" />
                      <p className="text-sm text-on-surface-variant"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-on-surface-variant/60 mt-1">PNG, JPG or PDF (Max. 10MB)</p>
                    </div>
                    <input className="hidden" type="file" />
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button aria-label="Submit ticket" className="bg-primary text-white px-10 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95" type="submit">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/10">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              Before you submit
            </h3>
            <ul className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
              <li>Check the <a className="text-secondary font-medium hover:underline" href="#">Knowledge Base</a> for instant solutions.</li>
              <li>Ensure you have your student/enrollment ID ready.</li>
              <li>Include screenshots for technical visual errors.</li>
              <li>Confirm your email address is correct for notifications.</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-primary mb-6">Estimated Response</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
                <span className="text-sm font-semibold px-2 py-1 rounded bg-slate-200 text-slate-700">LOW</span>
                <span className="text-on-surface-variant text-sm">24 - 48 Hours</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
                <span className="text-sm font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700">MEDIUM</span>
                <span className="text-on-surface-variant text-sm">12 - 24 Hours</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border-l-4 border-secondary">
                <span className="text-sm font-semibold px-2 py-1 rounded bg-primary text-white">HIGH</span>
                <span className="text-on-surface-variant text-sm">4 - 8 Hours</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border-l-4 border-red-600">
                <span className="text-sm font-semibold px-2 py-1 rounded bg-red-600 text-white">CRITICAL</span>
                <span className="text-on-surface-variant text-sm font-bold">Within 2 Hours</span>
              </div>
            </div>
          </div>

          <div className="bg-primary text-white rounded-xl p-8 relative overflow-hidden">
            <h3 className="text-xl font-bold mb-6 relative z-10">Common Issues</h3>
            <div className="space-y-3 relative z-10 text-sm">
              <a className="flex items-center justify-between text-on-primary/80 hover:text-white group transition-colors" href="#">
                <span>Cannot log in to dashboard</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="h-px bg-white/10" />
              <a className="flex items-center justify-between text-on-primary/80 hover:text-white group transition-colors" href="#">
                <span>Resetting forgotten password</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="h-px bg-white/10" />
              <a className="flex items-center justify-between text-on-primary/80 hover:text-white group transition-colors" href="#">
                <span>Video content not loading</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="h-px bg-white/10" />
              <a className="flex items-center justify-between text-on-primary/80 hover:text-white group transition-colors" href="#">
                <span>Course certificate generation</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (isAuthenticatedRoute) {
    return <div className="bg-background min-h-screen py-8">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <PublicHeader />
      <main className="pt-24 pb-20">{content}</main>
      <PublicFooter />
    </div>
  );
}
