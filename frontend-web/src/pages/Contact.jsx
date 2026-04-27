import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Mail, Users, MapPin, ArrowRight } from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    inquiryType: 'General Inquiry',
    message: '',
  });

  const { pathname } = useLocation();
  const roleBasePath = pathname.startsWith('/admin')
    ? '/admin'
    : pathname.startsWith('/instructor')
      ? '/instructor'
      : '/student';
  const helpPath = `${roleBasePath}/help`;

  const infoCards = [
    {
      icon: Building2,
      title: 'Institution',
      line1: 'TBC Kathmandu',
      line2: 'The British College, Kathmandu, Nepal',
    },
    {
      icon: Mail,
      title: 'Email Support',
      line1: 'gyanavriksha@tbc.edu.np',
      line2: 'Response within 24 academic hours.',
    },
    {
      icon: Users,
      title: 'Project Identity',
      line1: 'Group 4',
      line2: 'Secondary Education Digital Ecosystem Initiative',
    },
  ];

  const faq = [
    {
      question: 'How do I reset my password?',
      answer:
        'Navigate to the login portal and select "Forgot Password". A reset link will be sent to your registered email.',
    },
    {
      question: 'Is content aligned with NEB?',
      answer:
        'Yes, all materials are curated to match the latest Nepal Education Board secondary curriculum standards.',
    },
    {
      question: 'Can I access offline?',
      answer:
        'Key lesson modules can be downloaded for offline viewing through the mobile app.',
    },
    {
      question: 'Who can join Gyanavriksha?',
      answer:
        "Currently partnered with specific institutions. Students can register through their school's portal.",
    },
  ];

  const mapsLink =
    'https://www.google.com/maps/place/The+British+College,+Kathmandu/@27.6933152,85.3163296,706m/data=!3m2!1e3!4b1!4m6!3m5!1s0x39eb19b19295555f:0xabfe5f4b310f97de!8m2!3d27.6933152!4d85.3189045!16s%2Fg%2F11bw8f8gc4!5m1!1e1?entry=ttu&g_ep=EgoyMDI2MDQyMi4wIKXMDSoASAFQAw%3D%3D';

  const isFormValid = useMemo(() => {
    return (
      formData.fullName.trim().length > 0
      && formData.email.trim().length > 0
      && formData.message.trim().length > 0
    );
  }, [formData]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    // No backend contact/inquiry endpoint exists in current API, so fallback to email draft.
    const subject = encodeURIComponent(`Contact Inquiry: ${formData.inquiryType}`);
    const body = encodeURIComponent(
      `Name: ${formData.fullName}\nEmail: ${formData.email}\nType: ${formData.inquiryType}\n\nMessage:\n${formData.message}`
    );
    window.location.href = `mailto:gyanavriksha@tbc.edu.np?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-background" id="contact-top">
      <main className="pb-16">
        <section className="max-w-[1200px] mx-auto px-6 mb-16 pt-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-primary-dark p-12 md:p-20 text-white shadow-2xl">
            <div className="relative z-10 max-w-2xl">
              <span className="text-sm font-bold tracking-widest uppercase mb-4 block opacity-80">Connect with Gyanavriksha</span>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none mb-6">Get in Touch.</h1>
              <p className="text-lg md:text-xl text-blue-100/90 leading-relaxed">
                Have questions about the Gyanavriksha curriculum or need technical support? We are here to guide your journey.
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 bg-white p-8 md:p-12 rounded-[2rem] shadow-sm">
            <h2 className="text-3xl font-bold text-primary mb-8 tracking-tight">Send a Message</h2>
            <form id="contact-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 px-1">Full Name</label>
                  <input
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full bg-background border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Enter your name"
                    type="text"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 px-1">Email Address</label>
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-background border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="email@example.com"
                    type="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 px-1">Subject</label>
                <select
                  name="inquiryType"
                  value={formData.inquiryType}
                  onChange={handleInputChange}
                  className="w-full bg-background border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option>General Inquiry</option>
                  <option>Admission Support</option>
                  <option>Technical Issue</option>
                  <option>Collaborations</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 px-1">Your Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  className="w-full bg-background border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                  placeholder="How can we help you today?"
                  rows="5"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!isFormValid}
                className="w-full md:w-auto px-10 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Submit Inquiry
              </button>
              <p className="text-xs text-slate-500">
                This currently opens your email client because a backend inquiry endpoint is not available yet.
              </p>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-6">
            {infoCards.map(({ icon: Icon, title, line1, line2 }) => (
              <div key={title} className="bg-[#e6e8eb] p-8 rounded-3xl transition-all hover:bg-white hover:shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary">{title}</h3>
                    <p className="text-slate-700 leading-relaxed mt-1 font-medium">{line1}</p>
                    <p className="text-sm text-slate-500 mt-2">{line2}</p>
                  </div>
                </div>
              </div>
            ))}

            <a
              href={mapsLink}
              target="_blank"
              rel="noreferrer"
              className="block rounded-3xl overflow-hidden h-48 bg-slate-200 relative grayscale hover:grayscale-0 transition-all cursor-pointer"
            >
              <img
                className="w-full h-full object-cover opacity-80"
                alt="Simplified map showing Kathmandu city center"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAx-zXliDJpg4N5iZk4SPSkRuMpEzBV86Cr0b7Le7VrAeizuTYdpsCHv876DA238du_6Hd_GSxAU1htutKfx3aUvbh6qf1mh3P4rlZr2j9waDgXPzMUIUZbh-wqyelffOVtgTZdTXEo-lvkk_w768ncuvmzCBZp3SWQpUJUe_jQh9p5o9OwWXmlRUqOpjbAD4clA8vorvL1Jgf0yM26_RBejmqpR1lgZ4n1gQ_AGZeSrqk4NAIXmeTaHW4by9Bfn1qMgd0E1yNJleY"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-primary tracking-tight">Visit Us in Kathmandu</span>
                </div>
              </div>
            </a>
          </div>
        </section>

        <section id="faq" className="max-w-[1200px] mx-auto px-6 mt-24">
          <div className="bg-white rounded-[2.5rem] p-12 shadow-sm border border-slate-100">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-extrabold text-primary tracking-tight">Common Questions</h2>
              <p className="text-slate-600 mt-4 max-w-xl mx-auto">Quick answers to our most frequent student and educator queries.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {faq.map(({ question, answer }) => (
                <div key={question} className="space-y-3">
                  <h4 className="font-bold text-primary text-lg">{question}</h4>
                  <p className="text-slate-600 leading-relaxed">{answer}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center pt-8 border-t border-slate-100">
              <p className="text-slate-600 inline-block align-middle mr-4">Don&apos;t see your question?</p>
              <Link to={helpPath} className="text-primary font-bold hover:underline underline-offset-4 inline-flex items-center">
                Browse Full Knowledge Base
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
