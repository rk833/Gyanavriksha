import { useEffect, useRef } from 'react';
import { Mail, MapPin, User, BarChart, CheckCircle, Database, Server, Edit3, Wifi, ShieldCheck } from 'lucide-react';
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

function PolicyContent({ refsMap }) {
  return (
    <div className="space-y-20 max-w-3xl">
      <section ref={refsMap.introduction} id="introduction">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">1. Introduction</h2>
        <div className="space-y-4 text-[#454650] leading-relaxed text-lg">
          <p>Welcome to Gyanavriksha, "The Knowledge Sanctuary." We are committed to protecting your personal information and your right to privacy. This policy explains how we treat user data in our ecosystem designed for secondary education in Nepal.</p>
          <p>When you use our services, you trust us with your information. We take this responsibility seriously and work hard to protect your data using industry-standard protocols and ethical data handling practices.</p>
        </div>
      </section>

      <section ref={refsMap.dataCollect} id="data-collect">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">2. Data Collection</h2>
        <div className="bg-[#f2f4f7] rounded-xl p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-[#001256] mb-2 flex items-center gap-2">
                <User className="w-5 h-5 text-[#3359b8]" /> Personal Data
              </h4>
              <p className="text-[#454650]">Name, email address, school affiliation, and grade level required for account creation and personalized learning paths.</p>
            </div>
            <div>
              <h4 className="font-bold text-[#001256] mb-2 flex items-center gap-2">
                <BarChart className="w-5 h-5 text-[#3359b8]" /> Usage Data
              </h4>
              <p className="text-[#454650]">Lesson progress, quiz scores, time spent on modules, and interaction patterns with our AI-driven mentor system.</p>
            </div>
          </div>
        </div>
      </section>

      <section ref={refsMap.usage} id="usage">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">3. Data Usage</h2>
        <div className="space-y-4 text-[#454650] leading-relaxed">
          <p>We use the collected information for various purposes including:</p>
          <ul className="list-none space-y-3">
            <li className="flex gap-4">
              <CheckCircle className="w-5 h-5 text-[#3359b8] shrink-0 mt-1" />
              <span>To provide and maintain our Service, including to monitor the usage of our Service.</span>
            </li>
            <li className="flex gap-4">
              <CheckCircle className="w-5 h-5 text-[#3359b8] shrink-0 mt-1" />
              <span>To manage Your Account: to manage Your registration as a user of the Service.</span>
            </li>
            <li className="flex gap-4">
              <CheckCircle className="w-5 h-5 text-[#3359b8] shrink-0 mt-1" />
              <span>To contact You by email regarding updates or informative communications related to the functionalities.</span>
            </li>
          </ul>
        </div>
      </section>

      <section ref={refsMap.security} id="security">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">4. Data Security</h2>
        <p className="text-[#454650] mb-6 text-lg leading-relaxed">The security of Your Personal Data is important to Us. We employ advanced encryption for all data in transit and at rest. Access to personal data is strictly limited to authorized personnel only.</p>
        <div className="border-l-4 border-[#3359b8] pl-6 py-2 italic text-[#454650]">
          "Our architecture follows the Principle of Least Privilege (PoLP), ensuring that every module only has access to the data necessary for its immediate function."
        </div>
      </section>

      <section ref={refsMap.database} id="database">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">5. Storage Systems</h2>
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white border-2 border-[#c6c5d2]/10 rounded-xl p-6 flex items-start gap-6">
            <div className="bg-[#dde1ff] p-4 rounded-xl">
              <Database className="w-7 h-7 text-[#001256]" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-[#001256] mb-1">PostgreSQL Infrastructure</h4>
              <p className="text-[#454650]">Structured student records, transaction history, and institutional data are stored in encrypted PostgreSQL relational databases with automated daily backups.</p>
            </div>
          </div>
          <div className="bg-white border-2 border-[#c6c5d2]/10 rounded-xl p-6 flex items-start gap-6">
            <div className="bg-[#dbe1ff] p-4 rounded-xl">
              <Server className="w-7 h-7 text-[#3359b8]" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-[#001256] mb-1">ChromaDB Vector Storage</h4>
              <p className="text-[#454650]">To power our semantic search and AI tutor, we utilize ChromaDB for storing anonymized vector embeddings of learning content and interaction metadata.</p>
            </div>
          </div>
        </div>
      </section>

      <section ref={refsMap.handwriting} id="handwriting">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">6. Handwriting &amp; IoT Data</h2>
        <div className="space-y-6">
          <div className="flex gap-6 items-start">
            <Edit3 className="w-8 h-8 text-[#001256] opacity-20" />
            <div>
              <h4 className="font-bold text-xl mb-2">Handwriting Recognition</h4>
              <p className="text-[#454650] leading-relaxed">When using tablet interfaces for practice, Gyanavriksha processes stroke data to provide feedback on calligraphy and mathematical notations. This data is used solely for real-time pedagogical feedback.</p>
            </div>
          </div>
          <div className="flex gap-6 items-start" id="iot">
            <Wifi className="w-8 h-8 text-[#001256] opacity-20" />
            <div>
              <h4 className="font-bold text-xl mb-2">IoT Integration</h4>
              <p className="text-[#454650] leading-relaxed">For students using our physical smart-learning hardware, we collect diagnostic data such as device temperature and battery health to ensure safe operation. Environment data (light levels) may be used to suggest healthy study breaks.</p>
            </div>
          </div>
        </div>
      </section>

      <section ref={refsMap.cookies} id="cookies">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">8. Cookies &amp; Tracking</h2>
        <div className="space-y-4 text-[#454650] leading-relaxed text-lg">
          <p>We use cookies and similar tracking technologies to enhance your experience, analyze usage patterns, and remember your preferences. These technologies help us improve platform performance and deliver a smoother learning experience.</p>
          <p>You may control cookie behavior through your browser settings. Disabling certain cookies may affect functionality within the platform.</p>
        </div>
      </section>

      <section ref={refsMap.rights} id="rights">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">9. User Rights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-[#e6e8eb]/50 border border-[#c6c5d2]/10">
            <span className="font-bold block mb-1">Right to Access</span>
            <span className="text-sm text-[#454650]">Request a copy of the personal data we hold about you.</span>
          </div>
          <div className="p-4 rounded-lg bg-[#e6e8eb]/50 border border-[#c6c5d2]/10">
            <span className="font-bold block mb-1">Right to Deletion</span>
            <span className="text-sm text-[#454650]">Request that we delete your personal data from our systems.</span>
          </div>
          <div className="p-4 rounded-lg bg-[#e6e8eb]/50 border border-[#c6c5d2]/10">
            <span className="font-bold block mb-1">Right to Correction</span>
            <span className="text-sm text-[#454650]">Update any inaccurate or incomplete personal information.</span>
          </div>
          <div className="p-4 rounded-lg bg-[#e6e8eb]/50 border border-[#c6c5d2]/10">
            <span className="font-bold block mb-1">Right to Portability</span>
            <span className="text-sm text-[#454650]">Transfer your data to another service provider in a structured format.</span>
          </div>
        </div>
      </section>

      <section ref={refsMap.children} id="children">
        <div className="bg-[#001256] p-10 rounded-2xl text-[#ffffff]">
          <h2 className="text-3xl font-bold mb-6">10. Children's Privacy</h2>
          <p className="text-[#8694db] leading-relaxed text-lg mb-6">Given that our platform caters to secondary students (Grades 9-12), we comply with international standards for minor protection. We do not collect behavioral advertising data for users identified as minors. Parental consent is managed through institutional portals.</p>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-white" />
            <span className="font-semibold">COPPA &amp; GDPR-K Compliant Framework</span>
          </div>
        </div>
      </section>

      <section className="pb-20" id="contact">
        <h2 className="text-3xl font-bold text-[#001256] mb-6">11. Contact Support</h2>
        <p className="text-[#454650] mb-8">If you have any questions about this Privacy Policy, You can contact us:</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a className="bg-white border border-[#c6c5d2]/30 px-6 py-4 rounded-xl flex items-center gap-4 hover:bg-[#e6e8eb] transition-colors" href="mailto:privacy@gyanavriksha.edu">
            <Mail className="w-5 h-5 text-primary-dark shrink-0" />
            <div>
              <span className="block font-bold">Email Us</span>
              <span className="text-sm text-[#454650]">privacy@gyanavriksha.edu</span>
            </div>
          </a>
          <div className="bg-white border border-[#c6c5d2]/30 px-6 py-4 rounded-xl flex items-center gap-4">
            <MapPin className="w-5 h-5 text-primary-dark shrink-0" />
            <div>
              <span className="block font-bold">Headquarters</span>
              <span className="text-sm text-[#454650]">Lalitpur, Nepal</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PrivacyPolicy() {
  const { pathname, hash } = useLocation();
  const { user } = useAuth();
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
  }, [hash]);

  const content = (
    <div className="max-w-[1200px] mx-auto px-6 py-12 md:py-16 min-h-screen">
      <header className="mb-16 max-w-3xl">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#001256] mb-4">Privacy Policy</h1>
        <div className="flex items-center gap-4">
          <span className="bg-[#779afe] text-[#002e81] px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">Official Document</span>
          <p className="text-[#454650] font-medium">Last updated March 2025</p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-16">
        <aside className="md:w-72 shrink-0">
          <div className="sticky top-28 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#454650] mb-6 px-4">Navigation</h3>
            <nav className="flex flex-col gap-1 border-l-2 border-[#e6e8eb]">
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#introduction">1. Introduction</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#data-collect">2. Data Collection</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#usage">3. Data Usage</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#security">4. Data Security</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#database">5. Storage Systems</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#handwriting">6. Handwriting Data</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#iot">7. IoT Integration</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#cookies">8. Cookies &amp; Tracking</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#rights">9. User Rights</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#children">10. Children's Privacy</a>
              <a className="px-4 py-2 text-[#454650] hover:text-[#001256] hover:border-l-2 hover:border-[#001256] -ml-[2px] transition-all duration-200 font-medium" href="#contact">11. Contact Support</a>
            </nav>
          </div>
        </aside>
        <article className="flex-1">
          <PolicyContent refsMap={refsMap} />
        </article>
      </div>
    </div>
  );

  if (isAuthenticatedRoute) {
    return content;
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#191c1e]">
      <PublicHeader />
      <main className="pt-24 pb-20">{content}</main>
      <PublicFooter />
    </div>
  );
}
