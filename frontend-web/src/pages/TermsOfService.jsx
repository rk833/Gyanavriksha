import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  GraduationCap,
  ShieldCheck,
  KeyRound,
  QrCode,
  Gavel,
  Ban,
  Brain,
  XCircle,
  Mail,
  MapPin,
  Download,
} from 'lucide-react';
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
  return (
    <footer className="bg-white border-t border-primary-light py-6">
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-6 h-6" />
          <span className="text-xs font-medium text-slate-600">Gyanavriksha © 2026</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary-dark" />
            legal@gyanavriksha.com.np
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary-dark" />
            Lalitpur, Nepal
          </span>
        </div>
      </div>
    </footer>
  );
}

async function downloadTermsPdf() {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 44;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureSpace = (neededHeight) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addText = (text, size, color = [25, 28, 30], lineHeight = 18, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(text, maxWidth);
      ensureSpace(lines.length * lineHeight + 8);
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 8;
    };

    addText('Gyanavriksha', 20, [0, 18, 86], 24, true);
    addText('Terms and Conditions', 26, [0, 18, 86], 30, true);
    addText('Welcome to Gyanavriksha. Please read these terms carefully before accessing our academic sanctuary. Last updated: October 2024.', 12, [69, 70, 80], 18);
    y += 10;

    const sections = [
      {
        title: '1. Acceptance of Terms',
        body: [
          'By accessing or using the Gyanavriksha platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. This agreement constitutes a legally binding contract between you and Gyanavriksha regarding your use of the academic portal.',
          'If you do not agree to these terms, you must immediately cease all use of the platform and its associated services.',
        ],
      },
      {
        title: '2. Service Description (Academic Project)',
        body: [
          'Gyanavriksha is an educational ecosystem designed specifically for secondary education in Nepal. This platform provides digital learning modules, progress tracking, and interactive study materials intended for academic enrichment.',
          'As an academic-focused project, the primary objective is to bridge the gap between traditional curriculum and digital pedagogical tools, ensuring a centralized repository for verified knowledge.',
        ],
      },
      {
        title: '3. User Accounts and Security',
        body: [
          'To access full features, users must create an account. You are responsible for maintaining the confidentiality of your credentials.',
          'Two-Factor Authentication (2FA): We prioritize student data safety. All accounts are required to enable 2FA. Identity verification may be conducted via encrypted QR code scanning through the mobile companion app to ensure session integrity.',
        ],
      },
      {
        title: '4. Acceptable Use Policy',
        body: [
          'The Knowledge Sanctuary is a space for growth. Prohibited actions include:',
          'Circumventing platform security or attempting unauthorized access to teacher modules.',
          'Distributing copyright-protected study materials without explicit permission.',
          'Engaging in harassment or disruptive behavior within collaborative study groups.',
        ],
      },
      {
        title: '5. AI Disclaimer',
        body: [
          'Gyanavriksha utilizes advanced language models and artificial intelligence to assist in content summaries, quiz generation, and student queries.',
          'While we strive for 100% accuracy, AI-generated content should be treated as supplementary. Students are encouraged to verify critical facts against their primary textbooks and teacher guidance. Gyanavriksha is not liable for academic outcomes based solely on AI suggestions.',
        ],
      },
      {
        title: '6. Termination',
        body: [
          'Gyanavriksha reserves the right to suspend or terminate access to our services at any time, without prior notice, for conduct that we believe violates these Terms and Conditions or is harmful to other users of the platform, us, or third parties, or for any other reason.',
        ],
      },
    ];

    sections.forEach((section) => {
      addText(section.title, 16, [0, 18, 86], 22, true);
      section.body.forEach((paragraph, index) => {
        const prefix = section.title === '4. Acceptable Use Policy' && index > 0 ? '• ' : '';
        addText(`${prefix}${paragraph}`, 11, [69, 70, 80], 16);
      });
      y += 4;
    });

    doc.save('Gyanavriksha-Terms-of-Service.pdf');
  } catch (err) {
    // Dependency not installed or import failed
    // eslint-disable-next-line no-console
    console.error('Failed to load jspdf dynamically', err);
    // Minimal user feedback; avoid adding new toast dependency here
    // eslint-disable-next-line no-alert
    alert('Unable to generate PDF. Please run `npm install` in the frontend and reload the dev server.');
  }
}

function TermsContent({ refsMap }) {
  const [activeId, setActiveId] = useState('acceptance');

  useEffect(() => {
    const ids = ['acceptance', 'description', 'accounts', 'policy', 'ai-disclaimer', 'termination', 'contact'];
    const elements = ids
      .map((id) => ({ id, el: document.getElementById(id) }))
      .filter((x) => x.el);

    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        // choose the entry closest to top / most visible
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) {
          setActiveId(visible[0].target.id);
        } else {
          // fallback: pick the one whose top is nearest to viewport top
          const byTop = entries.sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
          if (byTop.length) setActiveId(byTop[0].target.id);
        }
      },
      { root: null, rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );

    elements.forEach((e) => observer.observe(e.el));

    return () => observer.disconnect();
  }, []);

  const tocItems = [
    { id: 'acceptance', label: 'Acceptance' },
    { id: 'description', label: 'Service Description' },
    { id: 'accounts', label: 'User Accounts' },
    { id: 'policy', label: 'Use Policy' },
    { id: 'ai-disclaimer', label: 'AI Disclaimer' },
    { id: 'termination', label: 'Termination' },
  ];

  return (
    <div className="space-y-16">
      <header className="mb-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary mb-4">Terms and Conditions</h1>
        <p className="text-xl text-on-surface-variant max-w-2xl leading-relaxed">
          Welcome to Gyanavriksha. Please read these terms carefully before accessing our academic sanctuary. Last updated: October 2024.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-12">
        <aside className="md:w-64 flex-shrink-0">
          <div className="sticky top-32 space-y-1">
            <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase mb-4 px-3">Table of Contents</p>
            {tocItems.map((item) => {
              const active = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={
                    (active
                      ? 'block py-2 px-3 text-primary font-bold border-l-2 border-secondary bg-surface-container-low rounded-r-lg transition-all'
                      : 'block py-2 px-3 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-r-lg border-l-2 border-transparent transition-all')
                  }
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </aside>
        <div className="flex-1 space-y-16">
          <section ref={refsMap.acceptance} className="scroll-mt-32" id="acceptance">
            <div className="p-8 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
              <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-secondary" />
                1. Acceptance of Terms
              </h2>
              <div className="space-y-4 text-on-surface-variant leading-relaxed">
                <p>By accessing or using the Gyanavriksha platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. This agreement constitutes a legally binding contract between you and Gyanavriksha regarding your use of the academic portal.</p>
                <p>If you do not agree to these terms, you must immediately cease all use of the platform and its associated services.</p>
              </div>
            </div>
          </section>

          <section ref={refsMap.description} className="scroll-mt-32" id="description">
            <div className="p-8 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
              <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
                <GraduationCap className="w-6 h-6 text-secondary" />
                2. Service Description (Academic Project)
              </h2>
              <div className="space-y-4 text-on-surface-variant leading-relaxed">
                <p>Gyanavriksha is an educational ecosystem designed specifically for secondary education in Nepal. This platform provides digital learning modules, progress tracking, and interactive study materials intended for academic enrichment.</p>
                <p>As an academic-focused project, the primary objective is to bridge the gap between traditional curriculum and digital pedagogical tools, ensuring a centralized repository for verified knowledge.</p>
              </div>
            </div>
          </section>

          <section ref={refsMap.accounts} className="scroll-mt-32" id="accounts">
            <div className="p-8 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
              <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
                <KeyRound className="w-6 h-6 text-secondary" />
                3. User Accounts and Security
              </h2>
              <div className="space-y-6 text-on-surface-variant leading-relaxed">
                <p>To access full features, users must create an account. You are responsible for maintaining the confidentiality of your credentials.</p>
                <div className="bg-surface-container-low p-6 rounded-lg border-l-4 border-secondary flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-shrink-0 bg-white p-4 rounded-xl shadow-sm">
                    <div className="w-24 h-24 bg-surface-container flex items-center justify-center rounded">
                      <QrCode className="w-10 h-10 text-outline" />
                    </div>
                    <p className="text-[10px] text-center mt-2 font-bold text-secondary uppercase tracking-widest">Secure QR</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary mb-2">Two-Factor Authentication (2FA)</h3>
                    <p className="text-sm">We prioritize student data safety. All accounts are required to enable 2FA. Identity verification may be conducted via encrypted QR code scanning through the mobile companion app to ensure session integrity.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section ref={refsMap.policy} className="scroll-mt-32" id="policy">
            <div className="p-8 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
              <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
                <Gavel className="w-6 h-6 text-secondary" />
                4. Acceptable Use Policy
              </h2>
              <div className="space-y-4 text-on-surface-variant leading-relaxed">
                <p>The Knowledge Sanctuary is a space for growth. Prohibited actions include:</p>
                <ul className="space-y-3 pl-4">
                  <li className="flex items-start gap-3">
                    <Ban className="w-5 h-5 text-error shrink-0 mt-1" />
                    <span>Circumventing platform security or attempting unauthorized access to teacher modules.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Ban className="w-5 h-5 text-error shrink-0 mt-1" />
                    <span>Distributing copyright-protected study materials without explicit permission.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Ban className="w-5 h-5 text-error shrink-0 mt-1" />
                    <span>Engaging in harassment or disruptive behavior within collaborative study groups.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section ref={refsMap.aiDisclaimer} className="scroll-mt-32" id="ai-disclaimer">
            <div className="p-8 bg-primary text-white rounded-xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-secondary opacity-20 blur-[80px] -mr-32 -mt-32"></div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 relative z-10">
                <Brain className="w-6 h-6 text-secondary-fixed" />
                5. AI Disclaimer
              </h2>
              <div className="space-y-4 text-primary-fixed relative z-10 leading-relaxed">
                <p>Gyanavriksha utilizes advanced language models and artificial intelligence to assist in content summaries, quiz generation, and student queries.</p>
                <p className="font-medium text-white">While we strive for 100% accuracy, AI-generated content should be treated as supplementary. Students are encouraged to verify critical facts against their primary textbooks and teacher guidance. Gyanavriksha is not liable for academic outcomes based solely on AI suggestions.</p>
              </div>
            </div>
          </section>

          <section ref={refsMap.termination} className="scroll-mt-32" id="termination">
            <div className="p-8 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
              <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
                <XCircle className="w-6 h-6 text-secondary" />
                6. Termination
              </h2>
              <p className="text-on-surface-variant leading-relaxed">
                Gyanavriksha reserves the right to suspend or terminate access to our services at any time, without prior notice, for conduct that we believe violates these Terms and Conditions or is harmful to other users of the platform, us, or third parties, or for any other reason.
              </p>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-20 p-10 bg-surface-container-high rounded-2xl text-center" id="contact">
        <h3 className="text-2xl font-bold text-primary mb-4">Have questions about our legal terms?</h3>
        <p className="text-on-surface-variant mb-8 max-w-xl mx-auto">Our legal and compliance team is here to help you understand your rights and responsibilities within the Knowledge Sanctuary.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="mailto:legal@gyanavriksha.com.np" className="px-8 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all">
            <Mail className="w-5 h-5" />
            Contact Legal Support
          </a>
          <button onClick={downloadTermsPdf} className="px-8 py-3 border border-outline-variant text-primary rounded-xl font-bold hover:bg-white transition-all inline-flex items-center gap-2">
            <Download className="w-5 h-5" />
            Download PDF Version
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TermsOfService() {
  const { pathname, hash } = useLocation();
  const { user } = useAuth();
  const isAuthenticatedRoute = pathname.startsWith('/student') || pathname.startsWith('/instructor') || pathname.startsWith('/admin');
  const refsMap = {
    acceptance: useRef(null),
    description: useRef(null),
    accounts: useRef(null),
    policy: useRef(null),
    aiDisclaimer: useRef(null),
    termination: useRef(null),
  };

  useEffect(() => {
    const anchorMap = {
      '#acceptance': refsMap.acceptance,
      '#description': refsMap.description,
      '#accounts': refsMap.accounts,
      '#policy': refsMap.policy,
      '#ai-disclaimer': refsMap.aiDisclaimer,
      '#termination': refsMap.termination,
      '#contact': { current: document.getElementById('contact') },
    };

    const targetRef = anchorMap[hash];
    if (targetRef?.current) {
      setTimeout(() => {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [hash]);

  const content = <TermsContent refsMap={refsMap} />;

  if (isAuthenticatedRoute) {
    return content;
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#191c1e]">
      <PublicHeader />
      <main className="pt-24 pb-20 max-w-[1200px] mx-auto px-6">{content}</main>
      <PublicFooter />
    </div>
  );
}
