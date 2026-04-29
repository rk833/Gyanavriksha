import { Link, useLocation } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { pathname } = useLocation();
  const roleBasePath = pathname.startsWith('/admin')
    ? '/admin'
    : pathname.startsWith('/instructor')
      ? '/instructor'
      : '/student';
  const aboutPath = `${roleBasePath}/about`;
  const privacyPolicyPath = `${roleBasePath}/privacy-policy`;
  const termsPath = `${roleBasePath}/terms-of-service`;
  const cookiePolicyPath = `${roleBasePath}/cookie-policy`;

  return (
    <footer className="bg-white border-t border-primary-light mt-auto">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="font-semibold text-xs text-primary-dark mb-4">About</h3>
            <ul className="space-y-2">
              <li>
                <Link to={aboutPath} className="text-xs text-slate-600 hover:text-primary transition-colors">
                  About Gyanavriksha
                </Link>
              </li>
              <li>
                <Link to={`${aboutPath}#mission`} className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Our Mission
                </Link>
              </li>
              <li>
                <Link to={`${aboutPath}#team`} className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Team
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-xs text-primary-dark mb-4">Contact</h3>
            <ul className="space-y-2">
              <li>
                <a href="mailto:support@gyanavriksha.edu.np" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Email Support
                </a>
              </li>
              <li>
                <a href="tel:+977-1-1234567" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Phone
                </a>
              </li>
              <li>
                <a href="#contact-form" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h3 className="font-semibold text-xs text-primary-dark mb-4">Features</h3>
            <ul className="space-y-2">
              <li>
                <a href="#ai-grading" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Advanced OCR Intelligence
                </a>
              </li>
              <li>
                <a href="#knowledge-gaps" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  RAG AI Tutor
                </a>
              </li>
              <li>
                <a href="#analytics" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Intelligent Concept Heatmap
                </a>
              </li>
              <li>
                <a href="#micro-quizzes" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Retention Micro-Quizzes
                </a>
              </li>
              <li>
                <a href="#iot-smart-desk" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  The IoT Smart Desk
                </a>
              </li>
            </ul>
          </div>

          {/* Help Centre */}
          <div>
            <h3 className="font-semibold text-xs text-primary-dark mb-4">Help Centre</h3>
            <ul className="space-y-2">
              <li>
                <a href="#faq" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#documentation" className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Support Ticket
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-xs text-primary-dark mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                  <Link to={privacyPolicyPath} className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Privacy Policy
                  </Link>
              </li>
              <li>
                <Link to={termsPath} className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to={cookiePolicyPath} className="text-xs text-slate-600 hover:text-primary transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-primary-light pt-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-6 h-6" />
            <span className="text-xs font-medium text-slate-600">
              Gyanavriksha © {currentYear}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            AI-Powered Learning Ecosystem for Secondary Education
          </p>
        </div>
      </div>
    </footer>
  );
}
