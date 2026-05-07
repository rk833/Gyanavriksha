import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Clock,
  HeartHandshake,
} from 'lucide-react';
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

const INFO_ITEMS = [
  {
    icon: Mail,
    label: 'Email Us',
    value: 'support@gyanavriksha.edu.np',
    href: 'mailto:support@gyanavriksha.edu.np',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Phone,
    label: 'Call Us',
    value: '+977-1-1234567',
    href: 'tel:+977-1-1234567',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: MapPin,
    label: 'Location',
    value: 'Kathmandu, Nepal',
    href: null,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Clock,
    label: 'Support Hours',
    value: 'Sun – Fri, 9 AM – 6 PM',
    href: null,
    color: 'bg-purple-50 text-purple-600',
  },
];

export default function Contact() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const isAuthenticatedRoute =
    pathname.startsWith('/student') ||
    pathname.startsWith('/instructor') ||
    pathname.startsWith('/admin');

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: user.full_name || f.name,
        email: user.email || f.email,
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/support/contact', {
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <>
      {/* Hero banner */}
      <section className="max-w-[1200px] mx-auto px-6 mb-12">
        <div className="bg-primary rounded-2xl p-10 md:p-16 relative overflow-hidden">
          <div
            className="absolute -right-20 -top-20 w-72 h-72 bg-white/5 rounded-full"
            aria-hidden="true"
          />
          <div
            className="absolute -right-6 bottom-0 w-40 h-40 bg-white/5 rounded-full"
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <HeartHandshake className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/70 text-sm font-medium tracking-wide uppercase">Get in Touch</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
              We're here to help
            </h1>
            <p className="text-white/80 text-lg leading-relaxed">
              Have a question, suggestion, or just want to say hello? Our team is always ready to connect and assist you.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
        {/* Contact form */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Message Sent!</h2>
                <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
                  Thank you for reaching out. We've sent a confirmation to <strong>{form.email}</strong> and will reply within 24–48 hours.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm((f) => ({ ...f, subject: '', message: '' })); }}
                  className="mt-4 text-sm text-primary font-semibold hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Send us a Message</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        placeholder="Your name"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      required
                      placeholder="Brief summary of your message"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      placeholder="Tell us what's on your mind…"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none"
                    />
                    <p className="text-right text-xs text-slate-400">{form.message.length} / 3000</p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 bg-primary text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-60 transition-all active:scale-95"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {submitting ? 'Sending…' : 'Send Message'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Info sidebar */}
        <div className="lg:col-span-5 space-y-6">
          {/* Contact info cards */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Contact Information</h3>
            {INFO_ITEMS.map(({ icon: Icon, label, value, href, color }) => (
              <div key={label} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  {href ? (
                    <a href={href} className="text-sm font-medium text-slate-800 hover:text-primary transition-colors">
                      {value}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-slate-800">{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick tip */}
          <div className="bg-primary rounded-2xl p-6 text-white">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Need faster help?
            </h3>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              For technical issues or account problems, a <strong>Support Ticket</strong> gets you a tracked response with priority routing.
            </p>
            <Link
              to={
                pathname.startsWith('/admin')
                  ? '/admin/support-ticket'
                  : pathname.startsWith('/instructor')
                    ? '/instructor/support-ticket'
                    : '/student/support-ticket'
              }
              className="inline-flex items-center gap-1.5 bg-white text-primary text-xs font-bold px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
            >
              Submit a Ticket →
            </Link>
          </div>

          {/* Response time */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Typical Response Times</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'General Enquiry', time: '24 – 48 hrs', color: 'bg-slate-200 text-slate-700' },
                { label: 'Technical Issue', time: '4 – 12 hrs', color: 'bg-blue-100 text-blue-700' },
                { label: 'Partnership / Media', time: '3 – 5 days', color: 'bg-purple-100 text-purple-700' },
              ].map(({ label, time, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-slate-600">{label}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{time}</span>
                </div>
              ))}
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
