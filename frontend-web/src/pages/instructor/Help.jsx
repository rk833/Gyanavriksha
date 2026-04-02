import { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  ClipboardList,
  Users,
  TrendingUp,
  Upload,
  Grid3X3,
  Shield,
  Monitor,
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    category: 'Dashboard & Analytics',
    icon: TrendingUp,
    questions: [
      {
        q: 'What does the Intelligence Dashboard show?',
        a: 'The dashboard provides a class-wide overview including participation rate, average score, total assignments, total submissions, a concept heatmap preview, recent submissions, and a performance velocity table.',
      },
      {
        q: 'How is the Velocity Score calculated?',
        a: 'Velocity is a 0-10 composite score based on three weighted factors: submission count (40%), average score (40%), and assignment completion rate (20%). Higher scores indicate more active and higher-performing students.',
      },
      {
        q: 'How are At-Risk students identified?',
        a: 'Students are flagged when their risk score exceeds 30%. The score is calculated from: low average scores (<50% = high risk), missed assignments relative to published count, and inactivity (>14 days since last submission).',
      },
    ],
  },
  {
    category: 'Assignments',
    icon: ClipboardList,
    questions: [
      {
        q: 'How do I create an assignment?',
        a: 'Go to Assignments and click "New Assignment". Fill in the title, select a subject, add optional description, due date, max score, and topic tags. Assignments are created as drafts — you must publish them to make them visible to students.',
      },
      {
        q: 'Can I edit a published assignment?',
        a: 'Yes, you can edit the title, description, due date, max score, and topic tags of published assignments. However, you cannot change the subject or delete a published assignment.',
      },
      {
        q: 'What is Exam Mode?',
        a: 'Exam Mode assignments are flagged for proctored submission. When IoT monitoring is available (Sprint 7), exam mode will integrate with device-based proctoring for supervised test-taking.',
      },
    ],
  },
  {
    category: 'Submissions & Grading',
    icon: Users,
    questions: [
      {
        q: 'How does AI grading work?',
        a: 'When students submit handwritten work, it goes through OCR (text extraction) and then AI-powered grading. The AI provides an overall score, step-by-step corrections, strengths, and improvement areas.',
      },
      {
        q: 'Can I override AI grades?',
        a: 'Yes. Open any submission from the Submissions page, and use the Instructor Override form to set your own score, feedback, strengths, improvements, and private comments. Your override replaces the AI score.',
      },
      {
        q: 'What do submission statuses mean?',
        a: 'Queued = waiting to be processed. OCR = text extraction in progress. Grading = AI is evaluating the work. Done = grading complete. Rejected = submission could not be processed (e.g., unreadable images).',
      },
    ],
  },
  {
    category: 'Concept Heatmap',
    icon: Grid3X3,
    questions: [
      {
        q: 'What is the Concept Heatmap?',
        a: 'The heatmap visualizes which topics and concepts students struggle with most. It aggregates data from knowledge gaps detected during AI grading and shows struggle percentages, affected student counts, and average scores per concept.',
      },
      {
        q: 'How is struggle percentage calculated?',
        a: 'Struggle percentage = (number of students with knowledge gaps in a topic / total enrolled students) x 100. Higher percentages indicate more widespread difficulty.',
      },
    ],
  },
  {
    category: 'Knowledge Base',
    icon: Upload,
    questions: [
      {
        q: 'What file types can I upload?',
        a: 'Currently only PDF files are accepted, with a maximum size of 50MB per file. Documents are categorized as either Curriculum PDFs or Instructor Notes.',
      },
      {
        q: 'What happens after I upload a document?',
        a: 'Uploaded documents are stored in the knowledge base and queued for embedding. Once embedded, the AI tutor can reference your materials when helping students, providing curriculum-aligned assistance.',
      },
    ],
  },
  {
    category: 'Security & Account',
    icon: Shield,
    questions: [
      {
        q: 'How do I update my profile?',
        a: 'Go to Settings (gear icon in the top bar) to update your display name and profile image. Your email and role are managed by the administrator.',
      },
      {
        q: 'How do I enable two-factor authentication?',
        a: 'Two-factor authentication is configured through the login settings. Contact your administrator if you need to enable or reset 2FA on your account.',
      },
    ],
  },
  {
    category: 'Exam Monitoring',
    icon: Monitor,
    questions: [
      {
        q: 'When will exam monitoring be available?',
        a: 'Real-time exam monitoring with IoT device integration is planned for Sprint 7. This will include live proctoring, suspicious activity detection, and device status monitoring during exam sessions.',
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

export default function InstructorHelp() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Help Center</h1>
          <p className="text-sm text-slate-500">Find answers to common questions about the instructor dashboard.</p>
        </div>
      </div>

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
            className="inline-flex items-center gap-2 bg-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20"
          >
            <MessageSquare className="w-4 h-4" />
            Contact Admin
          </button>
        </div>
      </div>
    </div>
  );
}
