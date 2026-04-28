import { useState } from 'react';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const FAQ_ITEMS = [
  {
    q: 'How do I access the digital library resources?',
    a: 'All enrolled students can access the digital library through the "Library" section in their dashboard. Credentials are automatically synced with your institutional ID.',
  },
  {
    q: 'What IoT devices are compatible with the Gyanavriksha Lab?',
    a: 'We support a wide range of micro-controllers including ESP32, Arduino, and Raspberry Pi. The platform provides native drivers for seamless data visualization and integration.',
  },
  {
    q: 'Can instructors track real-time progress of multiple students?',
    a: 'Yes, the Instructor Dashboard features real-time analytics and engagement metrics for every active learner in the session, allowing you to monitor class progress and individual performance.',
  },
  {
    q: 'Is my personal study data shared with third parties?',
    a: 'Gyanavriksha follows a strict data-sovereignty policy. Your learning analytics are encrypted and only accessible by you and authorized institutional administrators for academic support purposes.',
  },
  {
    q: 'How do admins generate academic reports?',
    a: 'Navigate to the "Reports" section, select the report type from available templates, and the system will automatically aggregate grades, attendance, and activity data into a downloadable PDF format.',
  },
  {
    q: 'How do I submit assignments with handwritten work?',
    a: 'Go to Assignments, select the assignment, and upload clear photos or scans of your handwritten work in JPG or PNG format. The system uses OCR to process your submissions.',
  },
  {
    q: 'What should I do if I encounter technical issues?',
    a: 'Try clearing your browser cache and cookies, or use a different browser. If the issue persists, contact our support team through the Help section or reach out via the contact form.',
  },
  {
    q: 'Can I access Gyanavriksha on mobile devices?',
    a: 'Yes, Gyanavriksha is fully responsive and works on mobile devices. You can also use our dedicated mobile app for iOS and Android for a better experience.',
  },
];

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-primary-light last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 px-4 text-left hover:bg-primary-50/30 transition-colors rounded"
      >
        <span className="font-medium text-primary-dark pr-4 text-sm md:text-base">{question}</span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-primary flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="pb-4 px-4">
          <p className="text-sm text-slate-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleContactSupport = () => {
    const role = user?.role || 'student';
    navigate(`/${role}/contact`);
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT py-12 md:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-12 md:mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-primary-dark mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Everything you need to know about the Gyanavriksha ecosystem. Find answers regarding academics, IoT integration, and administrative workflows.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="bg-white rounded-xl border border-primary-light mb-12">
          <div className="divide-y divide-primary-light">
            {FAQ_ITEMS.map((item, index) => (
              <FAQItem key={index} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-xl p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Still have questions?</h2>
          <p className="text-primary-light mb-8 max-w-lg mx-auto">
            Our dedicated academic support team is ready to assist you. Whether it's technical trouble or curriculum queries, we're here to help.
          </p>
          <button
            onClick={handleContactSupport}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary font-bold rounded-lg hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl"
          >
            <Mail className="w-5 h-5" />
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
