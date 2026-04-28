import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="py-4 text-center text-sm text-slate-500 space-x-4 flex justify-center flex-wrap gap-3">
      <Link to="/faq" className="hover:text-primary-dark transition">FAQ</Link>
      <span className="text-slate-300">•</span>
      <span>Privacy Policy</span>
      <span className="text-slate-300">•</span>
      <span>Terms of Service</span>
    </footer>
  );
}
