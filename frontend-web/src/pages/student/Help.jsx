import { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  BookOpen,
  Shield,
  Upload,
  Bell,
  Monitor,
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    icon: BookOpen,
    questions: [
      {
        q: 'How do I navigate the student dashboard?',
        a: 'Your dashboard shows your current focus subject, enrolled subjects, and an AI tutor preview. Use the sidebar menu on the left to access Assignments, Submissions, Performance, Library, and more.',
      },
      {
        q: 'How are my subjects assigned?',
        a: 'Subjects are assigned by your school administrator based on your grade and curriculum. You can view all enrolled subjects on the Dashboard or in Settings.',
      },
    ],
  },
  {
    category: 'Assignments & Submissions',
    icon: Upload,
    questions: [
      {
        q: 'How do I submit an assignment?',
        a: 'Go to Assignments, find the assignment you want to submit, click "Submit", then drag and drop your handwritten images (JPG/PNG, max 5 files, 10MB each). Click "Submit Assignment" to upload.',
      },
      {
        q: 'What file formats are accepted?',
        a: 'Only JPG, JPEG, and PNG image files are accepted. These should be clear photos or scans of your handwritten work.',
      },
      {
        q: 'How long does grading take?',
        a: 'After submission, your work goes through OCR processing and AI grading. This typically takes a few minutes. You\'ll receive a notification when results are ready.',
      },
    ],
  },
  {
    category: 'Security & Account',
    icon: Shield,
    questions: [
      {
        q: 'How do I enable two-factor authentication?',
        a: 'Go to Settings > Security and toggle on Two-Factor Authentication. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.) and verify with a 6-digit code.',
      },
      {
        q: 'How do I change my password?',
        a: 'Go to Settings > Security and click "Update Password". Enter your current password and your new password to change it.',
      },
      {
        q: 'I forgot my password. What do I do?',
        a: 'On the login page, click "Forgot password?" and enter your email. A reset link will be sent to your registered email address.',
      },
    ],
  },
  {
    category: 'Notifications',
    icon: Bell,
    questions: [
      {
        q: 'What types of notifications will I receive?',
        a: 'You\'ll receive notifications for: grading results, quiz reminders, IoT posture alerts, and system announcements. You can customize which alerts you receive in Settings.',
      },
      {
        q: 'How do I manage notification preferences?',
        a: 'Go to Settings > Learning Alerts to toggle grading updates, quiz reminders, and posture connection alerts on or off.',
      },
    ],
  },
  {
    category: 'IoT & Posture',
    icon: Monitor,
    questions: [
      {
        q: 'What is the IoT posture monitoring feature?',
        a: 'Gyanavriksha integrates with IoT devices to monitor your sitting posture during study sessions. This feature helps maintain healthy study habits. It will be available in a future update.',
      },
    ],
  },
];

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-primary-light last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-primary-50/30 transition-colors rounded"
      >
        <span className="text-sm font-medium text-primary-dark pr-4">{question}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="pb-3 px-1">
          <p className="text-sm text-slate-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function StudentHelp() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Help Center</h1>
          <p className="text-sm text-slate-500">Find answers to common questions about Gyanavriksha.</p>
        </div>
      </div>

      {/* FAQ sections */}
      <div className="space-y-4 mb-8">
        {FAQ_ITEMS.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.category}
              className="bg-white rounded-xl border border-primary-light p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-primary-dark">{section.category}</h2>
              </div>
              <div>
                {section.questions.map((item, i) => (
                  <FAQItem key={i} question={item.q} answer={item.a} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Contact support */}
      <div className="bg-primary-dark rounded-xl p-6 text-white">
        <h3 className="font-bold text-lg mb-2">Still need help?</h3>
        <p className="text-sm text-white/70 mb-4">
          Can't find what you're looking for? Reach out to our support team.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:support@gyanavriksha.edu.np"
            className="inline-flex items-center gap-2 bg-white text-primary-dark text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Email Support
          </a>
          <button
            onClick={() => {}}
            className="inline-flex items-center gap-2 bg-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20"
          >
            <MessageSquare className="w-4 h-4" />
            AI Tutor Chat
          </button>
        </div>
      </div>
    </div>
  );
}
