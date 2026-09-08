/* eslint-disable react-hooks/refs -- section refs support URL hash scrolling */
import { useEffect, useRef } from 'react';
import { Mail, MapPin, User, BarChart, CheckCircle, Database, Server, Edit3, Wifi, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

function PublicHeader() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm dark:shadow-none">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-8 h-8" />
          <span className="text-sm font-bold tracking-tight text-primary-dark">Gyanavriksha</span>
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
            privacy@gyanavriksha.edu
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

const policyNavLink =
  'px-4 py-2 text-on-surface-variant hover:text-primary border-l-2 border-transparent hover:border-secondary -ml-0.5 transition-all duration-200 font-medium rounded-r-lg hover:bg-surface-container-low';

function PolicyContent({ refsMap }) {
  return (
    <div className="space-y-12 max-w-3xl">
      <section ref={refsMap.introduction} id="introduction" className="scroll-mt-28">
        <div className="p-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
          <h2 className="text-2xl font-bold text-primary mb-6">1. Introduction</h2>
          <div className="space-y-4 text-on-surface-variant leading-relaxed text-base">
            <p>Welcome to Gyanavriksha, "The Knowledge Sanctuary." We are committed to protecting your personal information and your right to privacy. This policy explains how we treat user data in our ecosystem designed for secondary education in Nepal.</p>
            <p>When you use our services, you trust us with your information. We take this responsibility seriously and work hard to protect your data using industry-standard protocols and ethical data handling practices.</p>
          </div>
        </div>
      </section>

      <section ref={refsMap.dataCollect} id="data-collect" className="scroll-mt-28">
        <div className="p-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
          <h2 className="text-2xl font-bold text-primary mb-6">2. Data Collection</h2>
          <div className="bg-surface-container-high rounded-xl p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-bold text-primary-dark mb-2 flex items-center gap-2">
                  <User className="w-5 h-5 text-secondary" /> Personal Data
                </h4>
                <p className="text-on-surface-variant">Name, email address, school affiliation, and grade level required for account creation and personalized learning paths.</p>
              </div>
              <div>
                <h4 className="font-bold text-primary-dark mb-2 flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-secondary" /> Usage Data
                </h4>
                <p className="text-on-surface-variant">Lesson progress, quiz scores, time spent on modules, and interaction patterns with our AI-driven mentor system.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={refsMap.usage} id="usage" className="scroll-mt-28">
        <div className="p-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
          <h2 className="text-2xl font-bold text-primary mb-6">3. Data Usage</h2>
          <div className="space-y-4 text-on-surface-variant leading-relaxed">
            <p>We use the collected information for various purposes including:</p>
            <ul className="list-none space-y-3">
              <li className="flex gap-4">
                <CheckCircle className="w-5 h-5 text-secondary shrink-0 mt-1" />
                <span>To provide and maintain our Service, including to monitor the usage of our Service.</span>
              </li>
              <li className="flex gap-4">
                <CheckCircle className="w-5 h-5 text-secondary shrink-0 mt-1" />
                <span>To manage Your Account: to manage Your registration as a user of the Service.</span>
              </li>
              <li className="flex gap-4">
                <CheckCircle className="w-5 h-5 text-secondary shrink-0 mt-1" />
                <span>To contact You by email regarding updates or informative communications related to the functionalities.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section ref={refsMap.security} id="security" className="scroll-mt-28">
        <div className="p-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
          <h2 className="text-2xl font-bold text-primary mb-6">4. Data Security</h2>
          <p className="text-on-surface-variant mb-6 leading-relaxed">
            The security of Your Personal Data is important to Us. We employ advanced encryption for all data in transit and at rest. Access to personal data is strictly limited to authorized personnel only.
          </p>
          <div className="border-l-4 border-secondary pl-6 py-2 italic text-on-surface-variant bg-surface-container-low rounded-r-lg">
            “Our architecture follows the Principle of Least Privilege (PoLP), ensuring that every module only has access to the data necessary for its immediate function.”
          </div>
        </div>
      </section>

      <section ref={refsMap.database} id="database" className="scroll-mt-28">
        <div className="p-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
          <h2 className="text-2xl font-bold text-primary mb-6">5. Storage Systems</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-surface border border-outline-variant/40 rounded-xl p-6 flex items-start gap-6">
              <div className="bg-primary-light p-4 rounded-xl shrink-0">
                <Database className="w-7 h-7 text-primary-dark" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-primary-dark mb-1">PostgreSQL Infrastructure</h4>
                <p className="text-on-surface-variant">Structured student records, transaction history, and institutional data are stored in encrypted PostgreSQL relational databases with automated daily backups.</p>
              </div>
            </div>
            <div className="bg-surface border border-outline-variant/40 rounded-xl p-6 flex items-start gap-6">
              <div className="bg-primary-light p-4 rounded-xl shrink-0">
                <Server className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-primary-dark mb-1">ChromaDB Vector Storage</h4>
                <p className="text-on-surface-variant">To power our semantic search and AI tutor, we utilize ChromaDB for storing anonymized vector embeddings of learning content and interaction metadata.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={refsMap.handwriting} id="handwriting" className="scroll-mt-28">
        <div className="p-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
          <h2 className="text-2xl font-bold text-primary mb-6">6. Handwriting &amp; IoT Data</h2>
          <div className="space-y-6">
            <div className="flex gap-6 items-start">
              <Edit3 className="w-8 h-8 text-primary opacity-30 shrink-0 mt-1" />
              <div className="min-w-0">
                <h4 className="font-bold text-xl text-primary-dark mb-2">Handwriting Recognition</h4>
                <p className="text-on-surface-variant leading-relaxed">When using tablet interfaces for practice, Gyanavriksha processes stroke data to provide feedback on calligraphy and mathematical notations. This data is used solely for real-time pedagogical feedback.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start" id="iot">
              <Wifi className="w-8 h-8 text-primary opacity-30 shrink-0 mt-1" />
              <div className="min-w-0">
                <h4 className="font-bold text-xl text-primary-dark mb-2">IoT Integration</h4>
                <p className="text-on-surface-variant leading-relaxed">For students using our physical smart-learning hardware, we collect diagnostic data such as device temperature and battery health to ensure safe operation. Environment data (light levels) may be used to suggest healthy study breaks.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={refsMap.cookies} id="cookies" className="scroll-mt-28">
        <div className="p-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
          <h2 className="text-2xl font-bold text-primary mb-6">8. Cookies &amp; Tracking</h2>
          <div className="space-y-4 text-on-surface-variant leading-relaxed">
            <p>We use cookies and similar tracking technologies to enhance your experience, analyze usage patterns, and remember your preferences. These technologies help us improve platform performance and deliver a smoother learning experience.</p>
            <p>You may control cookie behavior through your browser settings. Disabling certain cookies may affect functionality within the platform.</p>
          </div>
        </div>
      </section>

      <section ref={refsMap.rights} id="rights" className="scroll-mt-28">
        <div className="p-8 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_4px_24px_rgba(25,28,30,0.04)]">
          <h2 className="text-2xl font-bold text-primary mb-6">9. User Rights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['Right to Access', 'Request a copy of the personal data we hold about you.'],
              ['Right to Deletion', 'Request that we delete your personal data from our systems.'],
              ['Right to Correction', 'Update any inaccurate or incomplete personal information.'],
              ['Right to Portability', 'Transfer your data to another service provider in a structured format.'],
            ].map(([title, body]) => (
              <div key={title} className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/30">
                <span className="font-bold text-primary-dark block mb-1">{title}</span>
                <span className="text-sm text-on-surface-variant">{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={refsMap.children} id="children" className="scroll-mt-28">
        <div className="bg-primary-dark text-white p-10 rounded-2xl relative overflow-hidden border border-primary/30">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-20 blur-[80px] -mr-32 -mt-32 pointer-events-none" aria-hidden />
          <h2 className="text-2xl md:text-3xl font-bold mb-6 relative z-10">10. Children&apos;s Privacy</h2>
          <p className="text-primary-light leading-relaxed text-base mb-6 relative z-10">
            Given that our platform caters to secondary students (Grades 9-12), we comply with international standards for minor protection. We do not collect behavioral advertising data for users identified as minors. Parental consent is managed through institutional portals.
          </p>
          <div className="flex items-center gap-3 relative z-10">
            <ShieldCheck className="w-5 h-5 text-white shrink-0" />
            <span className="font-semibold">COPPA &amp; GDPR-K Compliant Framework</span>
          </div>
        </div>
      </section>

      <section className="pb-8 scroll-mt-28" id="contact">
        <div className="p-10 bg-surface-container-high rounded-2xl border border-outline-variant/30 text-center md:text-left">
          <h2 className="text-2xl font-bold text-primary mb-4">11. Contact Support</h2>
          <p className="text-on-surface-variant mb-8 max-w-xl">
            If you have any questions about this Privacy Policy, you can contact us:
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <a
              className="bg-surface border border-outline-variant px-6 py-4 rounded-xl flex items-center gap-4 hover:bg-surface-container-low transition-colors text-left"
              href="mailto:privacy@gyanavriksha.edu"
            >
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <div>
                <span className="block font-bold text-primary-dark">Email Us</span>
                <span className="text-sm text-on-surface-variant">privacy@gyanavriksha.edu</span>
              </div>
            </a>
            <div className="bg-surface border border-outline-variant px-6 py-4 rounded-xl flex items-center gap-4 text-left">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              <div>
                <span className="block font-bold text-primary-dark">Headquarters</span>
                <span className="text-sm text-on-surface-variant">Lalitpur, Nepal</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PrivacyPolicy() {
  const { pathname, hash } = useLocation();
  const isAuthenticatedRoute = pathname.startsWith('/student') || pathname.startsWith('/instructor') || pathname.startsWith('/admin');
  const refsMap = {
    introduction: useRef(null),
    dataCollect: useRef(null),
    usage: useRef(null),
    security: useRef(null),
    database: useRef(null),
    handwriting: useRef(null),
    cookies: useRef(null),
    rights: useRef(null),
    children: useRef(null),
  };

  useEffect(() => {
    const anchorMap = {
      '#introduction': refsMap.introduction,
      '#data-collect': refsMap.dataCollect,
      '#usage': refsMap.usage,
      '#security': refsMap.security,
      '#database': refsMap.database,
      '#handwriting': refsMap.handwriting,
      '#cookies': refsMap.cookies,
      '#rights': refsMap.rights,
      '#children': refsMap.children,
      '#contact': { current: document.getElementById('contact') },
    };

    const targetRef = anchorMap[hash];
    if (targetRef?.current) {
      setTimeout(() => {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [hash]); // eslint-disable-line react-hooks/exhaustive-deps -- hash-only anchor scroll

  const content = (
    <div className="max-w-[1200px] mx-auto px-2 sm:px-6 py-8 md:py-12 min-h-screen text-on-surface">
      <header className="mb-12 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-primary mb-4">Privacy Policy</h1>
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <span className="bg-primary-light text-primary-dark px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border border-primary/15">
            Official Document
          </span>
          <p className="text-on-surface-variant font-medium">Last updated March 2025</p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-12 lg:gap-16">
        <aside className="md:w-72 shrink-0">
          <div className="sticky top-28 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-5 px-3">Navigation</h3>
            <nav className="flex flex-col gap-1 border-l-2 border-outline-variant md:max-h-[calc(100vh-8rem)] md:overflow-y-auto pr-1">
              <a className={policyNavLink} href="#introduction">
                1. Introduction
              </a>
              <a className={policyNavLink} href="#data-collect">
                2. Data Collection
              </a>
              <a className={policyNavLink} href="#usage">
                3. Data Usage
              </a>
              <a className={policyNavLink} href="#security">
                4. Data Security
              </a>
              <a className={policyNavLink} href="#database">
                5. Storage Systems
              </a>
              <a className={policyNavLink} href="#handwriting">
                6. Handwriting Data
              </a>
              <a className={policyNavLink} href="#iot">
                7. IoT Integration
              </a>
              <a className={policyNavLink} href="#cookies">
                8. Cookies &amp; Tracking
              </a>
              <a className={policyNavLink} href="#rights">
                9. User Rights
              </a>
              <a className={policyNavLink} href="#children">
                10. Children&apos;s Privacy
              </a>
              <a className={policyNavLink} href="#contact">
                11. Contact Support
              </a>
            </nav>
          </div>
        </aside>
        <article className="flex-1 min-w-0">
          <PolicyContent refsMap={refsMap} />
        </article>
      </div>
    </div>
  );

  if (isAuthenticatedRoute) {
    return content;
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <PublicHeader />
      <main className="pt-24 pb-20">{content}</main>
      <PublicFooter />
    </div>
  );
}
