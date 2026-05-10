import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, HelpCircle, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

import useAuth from '../hooks/useAuth';
import api from '../services/api';

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

  const isAuthenticatedRoute =
    pathname.startsWith('/student') ||
    pathname.startsWith('/instructor') ||
    pathname.startsWith('/admin');

  const [submitting, setSubmitting] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [formState, setFormState] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    role: 'Student',
    category: 'Technical Issue',
    priority: 'Medium',
    subject: '',
    description: '',
  });

  useEffect(() => {
    if (user?.full_name || user?.email) {
      setFormState((current) => ({
        ...current,
        fullName: user?.full_name || current.fullName,
        email: user?.email || current.email,
        role:
          user?.role === 'instructor'
            ? 'Teacher'
            : user?.role === 'admin'
              ? 'Administrator'
              : current.role,
      }));
    }
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!formState.subject.trim() || !formState.description.trim()) {
      toast.error('Please fill subject and description.');
      return;
    }
    if (attachment && attachment.size > 10 * 1024 * 1024) {
      toast.error('Attachment must be 10MB or less.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('full_name', formState.fullName);
      fd.append('email', formState.email);
      fd.append('role', formState.role);
      fd.append('category', formState.category);
      fd.append('priority', formState.priority);
      fd.append('subject', formState.subject);
      fd.append('description', formState.description);
      if (attachment) fd.append('attachment', attachment);

      const res = await api.post('/api/support/tickets', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Ticket submitted (#${String(res.data?.ticket_id || '').slice(0, 8)})`);
      setFormState((current) => ({
        ...current,
        subject: '',
        description: '',
      }));
      setAttachment(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <>
      <section className="max-w-[1200px] mx-auto px-6 mb-12">
        <div className="bg-primary rounded-xl p-10 md:p-16 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">Submit a Support Request</h1>
            <p className="text-white text-lg leading-relaxed opacity-90">Our dedicated team is ready to assist you. Tell us about your issue and we will resolve it with you.</p>
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-8 text-primary">Ticket Details</h2>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Full Name</label>
                  <input name="fullName" value={formState.fullName} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all" placeholder="John Doe" type="text" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Email Address</label>
                  <input name="email" value={formState.email} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all" placeholder="john@example.com" type="email" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Role</label>
                  <select name="role" value={formState.role} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none appearance-none">
                    <option>Student</option>
                    <option>Parent</option>
                    <option>Teacher</option>
                    <option>Administrator</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Category</label>
                  <select name="category" value={formState.category} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none">
                    <option>Technical Issue</option>
                    <option>Course Access</option>
                    <option>Billing &amp; Payments</option>
                    <option>Feature Request</option>
                    <option>Report Content</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Priority</label>
                  <select name="priority" value={formState.priority} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Subject</label>
                <input name="subject" value={formState.subject} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none" placeholder="Brief summary of the issue" type="text" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Description</label>
                <textarea name="description" value={formState.description} onChange={handleChange} className="w-full px-4 py-3 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none resize-none" placeholder="Please provide detailed information including steps to reproduce the issue..." rows="6" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface tracking-wide uppercase opacity-70">Attachment</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 text-slate-500 mb-2" />
                      <p className="text-sm text-slate-600"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG or PDF (Max. 10MB)</p>
                      {attachment ? (
                        <p className="text-xs text-primary mt-2 font-medium">{attachment.name}</p>
                      ) : null}
                    </div>
                    <input
                      className="hidden"
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf"
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button aria-label="Submit ticket" className="bg-primary text-white px-10 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-60" type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-100 rounded-xl p-8 border border-slate-200">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              Before you submit
            </h3>
            <ul className="space-y-4 text-sm text-slate-600 leading-relaxed">
              <li>Check your internet connection and reload once.</li>
              <li>Include screenshots for technical visual errors.</li>
              <li>Confirm your email is correct for updates.</li>
              <li>Mention exact page URL when reporting UI bugs.</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-primary mb-6">Estimated Response</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100">
                <span className="text-sm font-semibold px-2 py-1 rounded bg-slate-200 text-slate-700">LOW</span>
                <span className="text-slate-600 text-sm">24 - 48 Hours</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100">
                <span className="text-sm font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700">MEDIUM</span>
                <span className="text-slate-600 text-sm">12 - 24 Hours</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 border-l-4 border-secondary">
                <span className="text-sm font-semibold px-2 py-1 rounded bg-primary text-white">HIGH</span>
                <span className="text-slate-600 text-sm">4 - 8 Hours</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border-l-4 border-red-600">
                <span className="text-sm font-semibold px-2 py-1 rounded bg-red-600 text-white">CRITICAL</span>
                <span className="text-slate-700 text-sm font-bold">Within 2 Hours</span>
              </div>
            </div>
          </div>

          <div className="bg-primary text-white rounded-xl p-8 relative overflow-hidden">
            <h3 className="text-xl font-bold mb-6 relative z-10">Common Issues</h3>
            <div className="space-y-3 relative z-10 text-sm">
              <a className="flex items-center justify-between text-white/80 hover:text-white group transition-colors" href="#">
                <span>Cannot log in to dashboard</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="h-px bg-white/10" />
              <a className="flex items-center justify-between text-white/80 hover:text-white group transition-colors" href="#">
                <span>Resetting forgotten password</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <div className="h-px bg-white/10" />
              <a className="flex items-center justify-between text-white/80 hover:text-white group transition-colors" href="#">
                <span>Video content not loading</span>
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
