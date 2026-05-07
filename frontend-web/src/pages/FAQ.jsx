import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  HelpCircle,
  BookOpen,
  ShieldCheck,
  Cpu,
  Brain,
  UserCog,
  TicketCheck,
} from 'lucide-react';

// ── FAQ Data ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'account',
    icon: UserCog,
    color: 'bg-blue-50 text-blue-600',
    title: 'Account & Access',
    items: [
      {
        q: 'How do I log in for the first time?',
        a: 'Your administrator will send you a welcome email containing your login email and a temporary password. Use those credentials on the login page. You will be asked to set a new password immediately after your first sign-in.',
      },
      {
        q: 'I forgot my password. How do I reset it?',
        a: 'On the login page, click "Forgot password?" and enter your registered email address. You will receive a password reset link valid for 1 hour. Follow the link to create a new password.',
      },
      {
        q: 'Can I change my email address?',
        a: 'Email addresses are managed by your institution administrator. If you need to update your email, please raise a Support Ticket and your admin will assist.',
      },
      {
        q: 'How do I update my profile picture?',
        a: 'Navigate to Profile from the sidebar or top-right menu, then click your avatar/initials area to upload a new photo. Supported formats are JPG, PNG, and WebP (max 5 MB).',
      },
      {
        q: 'Why is my account showing as inactive?',
        a: 'Accounts can be deactivated by administrators. Please contact your institution admin or submit a Support Ticket for reinstatement.',
      },
    ],
  },
  {
    id: '2fa',
    icon: ShieldCheck,
    color: 'bg-green-50 text-green-600',
    title: 'Two-Factor Authentication (2FA)',
    items: [
      {
        q: 'What two-factor authentication methods does Gyanavriksha support?',
        a: 'Gyanavriksha supports two methods: Authenticator App (TOTP — compatible with Google Authenticator, Authy, etc.) and Email OTP (a one-time code sent to your registered email). You can enable either or both from your Settings page.',
      },
      {
        q: 'How do I set up 2FA?',
        a: 'Go to Settings → Security → Two-Factor Authentication. Choose your preferred method, follow the setup steps, and confirm with a test code. It is strongly recommended to enable at least one method for account security.',
      },
      {
        q: 'What is the "Don\'t ask again for 30 days" option?',
        a: 'After a successful 2FA verification you can mark your device as trusted for 30 days. Gyanavriksha will not ask for a 2FA code on that device until the trust period expires.',
      },
      {
        q: 'I lost access to my authenticator app. What should I do?',
        a: 'Contact your institution administrator. They can reset your 2FA settings so you can reconfigure with a new device. Always keep a backup of your TOTP QR code or recovery codes.',
      },
    ],
  },
  {
    id: 'ai',
    icon: Brain,
    color: 'bg-purple-50 text-purple-600',
    title: 'AI Study Tutor & RAG',
    items: [
      {
        q: 'What is the Gyanavriksha AI Study Tutor?',
        a: 'The AI Study Tutor (powered by a Retrieval-Augmented Generation pipeline) lets you ask natural-language questions about your curriculum. It retrieves context from your course materials and answers with cited, relevant information — like having a knowledgeable tutor available 24/7.',
      },
      {
        q: 'What file types can I upload as personal notes?',
        a: 'You can upload PDF documents, JPG, JPEG, PNG, and WebP images. The system uses OCR technology (including Google Cloud Vision) to extract text from scanned or handwritten notes and indexes them for your tutor.',
      },
      {
        q: 'Why did the AI say it could not find information about my topic?',
        a: 'The AI only answers from ingested materials. If your topic has not been covered in uploaded documents, it will indicate there is no relevant context. Ask your instructor to upload the relevant curriculum content.',
      },
      {
        q: 'Are my personal notes visible to instructors or admins?',
        a: 'Personal notes you upload are stored in your private knowledge partition and are not accessible to instructors or administrators.',
      },
      {
        q: 'My scanned PDF was rejected or returned no results. Why?',
        a: 'The system requires readable text or clear scanned images. Very low-resolution scans, heavily rotated pages, or partially covered watermarks may reduce accuracy. Try scanning at 300 DPI or higher with good lighting for best results.',
      },
    ],
  },
  {
    id: 'assignments',
    icon: BookOpen,
    color: 'bg-amber-50 text-amber-600',
    title: 'Assignments & Grading',
    items: [
      {
        q: 'How do I submit an assignment?',
        a: 'Go to Assignments from the sidebar, select the assignment, then click Submit. You can upload multiple images (for handwritten work) or PDF documents. All uploads are OCR-processed and sent to the AI grading engine.',
      },
      {
        q: 'How long does AI grading take?',
        a: 'Most submissions are graded within 30–120 seconds depending on document size and server load. You will receive an in-app notification and email when grading is complete.',
      },
      {
        q: 'Can I resubmit an assignment?',
        a: 'Whether resubmission is allowed depends on your instructor\'s assignment settings. Check the assignment details for a resubmission deadline or contact your instructor.',
      },
      {
        q: 'What does "No readable text extracted" mean?',
        a: 'This means the OCR system could not extract sufficient text from your submission. Ensure your images are well-lit, in focus, and at a reasonable resolution (at least 300 DPI for scanned documents).',
      },
      {
        q: 'How are assignments graded?',
        a: 'The AI grading engine evaluates your submission against the assignment rubric and generates detailed feedback, marks per criterion, and an overall score. Instructors can review and override AI scores if needed.',
      },
    ],
  },
  {
    id: 'iot',
    icon: Cpu,
    color: 'bg-teal-50 text-teal-600',
    title: 'IoT Smart Desk',
    items: [
      {
        q: 'What is the IoT Smart Desk?',
        a: 'The Gyanavriksha IoT Smart Desk is a hardware-software integration that monitors study posture and desk presence using sensors (ultrasonic, flex, and vibration). It sends real-time posture alerts if you slouch or leave your desk for extended periods.',
      },
      {
        q: 'How do I connect my IoT device?',
        a: 'Administrators register IoT devices and assign them to students from the Admin → IoT Management page. Once assigned, your device will sync automatically to your dashboard.',
      },
      {
        q: 'I am getting frequent posture alerts. How do I adjust sensitivity?',
        a: 'Posture alert sensitivity is configured by your administrator. Please contact your admin or submit a Support Ticket requesting an adjustment for your device.',
      },
      {
        q: 'My IoT device shows as offline. What should I do?',
        a: 'Ensure the device is powered on and connected to the same network as your system. If the issue persists, check with your admin or submit a Support Ticket with the Device ID from your dashboard.',
      },
    ],
  },
  {
    id: 'support',
    icon: TicketCheck,
    color: 'bg-rose-50 text-rose-600',
    title: 'Support & Help',
    items: [
      {
        q: 'How do I submit a support ticket?',
        a: 'Click "Support Ticket" in the footer or Help Centre, fill out the form with your issue details (subject, description, priority), and attach any relevant screenshots. You will receive a confirmation email with your ticket reference.',
      },
      {
        q: 'What are the support response time expectations?',
        a: 'Low priority: 24–48 hours. Medium priority: 12–24 hours. High priority: 4–8 hours. Critical priority: within 2 hours. These are estimates during business hours (Sun–Fri, 9 AM – 6 PM NPT).',
      },
      {
        q: 'Can I track the status of my support ticket?',
        a: 'Currently, ticket status updates are communicated via email. Admin replies are sent directly to the email address you provided when submitting the ticket.',
      },
      {
        q: 'Who can I contact directly?',
        a: 'You can email us at support@gyanavriksha.edu.np or use the Contact Us form from the footer. For urgent matters, use the Support Ticket system with Critical priority.',
      },
    ],
  },
];

// ── Accordion Item ────────────────────────────────────────────────────────────

function AccordionItem({ q, a, isOpen, onToggle }) {
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${isOpen ? 'border-primary/30 bg-primary/[0.02]' : 'border-slate-100 bg-white'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
      >
        <span className={`text-sm font-semibold leading-snug ${isOpen ? 'text-primary' : 'text-slate-800'}`}>
          {q}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'text-slate-400'}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5">
          <div className="h-px bg-slate-100 mb-4" />
          <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FAQ() {
  const { pathname } = useLocation();
  const [openItem, setOpenItem] = useState(null); // "sectionId-index"
  const [activeSection, setActiveSection] = useState('account');

  const isAuthenticatedRoute =
    pathname.startsWith('/student') ||
    pathname.startsWith('/instructor') ||
    pathname.startsWith('/admin');

  const roleBasePath = pathname.startsWith('/admin')
    ? '/admin'
    : pathname.startsWith('/instructor')
      ? '/instructor'
      : '/student';

  const toggle = (key) => setOpenItem((prev) => (prev === key ? null : key));

  const currentSection = SECTIONS.find((s) => s.id === activeSection) || SECTIONS[0];

  const content = (
    <>
      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-6 mb-12">
        <div className="bg-primary rounded-2xl p-10 md:p-16 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" aria-hidden="true" />
          <div className="absolute right-10 bottom-0 w-36 h-36 bg-white/5 rounded-full" aria-hidden="true" />
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/70 text-sm font-medium tracking-wide uppercase">Help Centre</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-white/80 text-lg leading-relaxed">
              Quick answers to common questions about Gyanavriksha — accounts, AI tutoring, assignments, IoT, and more.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
        {/* Sidebar nav */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sticky top-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">Categories</p>
            <nav className="space-y-1">
              {SECTIONS.map(({ id, icon: Icon, title, color }) => (
                <button
                  key={id}
                  onClick={() => { setActiveSection(id); setOpenItem(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeSection === id
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    activeSection === id ? 'bg-white/20' : color
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-left leading-snug">{title}</span>
                </button>
              ))}
            </nav>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-xs text-slate-500 px-2 mb-3">Still need help?</p>
              <Link
                to={`${roleBasePath}/support-ticket`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
              >
                <TicketCheck className="w-4 h-4" />
                Submit a Ticket
              </Link>
              <Link
                to={`${roleBasePath}/contact`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                Contact Us
              </Link>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="lg:col-span-9">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentSection.color}`}>
              <currentSection.icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{currentSection.title}</h2>
              <p className="text-xs text-slate-400">{currentSection.items.length} questions</p>
            </div>
          </div>

          <div className="space-y-3">
            {currentSection.items.map((item, idx) => {
              const key = `${currentSection.id}-${idx}`;
              return (
                <AccordionItem
                  key={key}
                  q={item.q}
                  a={item.a}
                  isOpen={openItem === key}
                  onToggle={() => toggle(key)}
                />
              );
            })}
          </div>

          {/* All sections quick nav at bottom */}
          <div className="mt-10 pt-8 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Other Topics</p>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.filter((s) => s.id !== activeSection).map(({ id, icon: Icon, title }) => (
                <button
                  key={id}
                  onClick={() => { setActiveSection(id); setOpenItem(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-all"
                >
                  <Icon className="w-3 h-3" />
                  {title}
                </button>
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
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-primary-light">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-8 h-8" />
            <span className="text-2xl font-bold tracking-tighter text-[#001256]">Gyanavriksha</span>
          </Link>
        </div>
      </nav>
      <main className="pt-24 pb-20">{content}</main>
      <footer className="bg-[#001256] w-full pt-16 pb-8 border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="font-['Inter'] text-slate-300 text-sm opacity-80">© 2026 Gyanavriksha. The Knowledge Sanctuary.</p>
        </div>
      </footer>
    </div>
  );
}
