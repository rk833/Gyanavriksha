import { useState } from 'react';
import { ChevronDown, ChevronUp, Mail, MessageSquare, Menu, Bell, Settings } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Footer from '../components/common/Footer';

const FAQ_ITEMS = [
	{ q: 'How do I access the digital library resources?', a: 'All enrolled students can access the digital library through the "Library" section in their dashboard. Credentials are automatically synced with your institutional ID.' },
	{ q: 'What IoT devices are compatible with the Gyanavriksha Lab?', a: 'We support ESP32, Arduino, and Raspberry Pi. The platform provides native drivers for seamless data visualization and integration.' },
	{ q: 'Can instructors track real-time progress of multiple students?', a: 'Yes, the Instructor Dashboard features real-time analytics and engagement metrics for every active learner in the session.' },
	{ q: 'Is my personal study data shared with third parties?', a: 'Gyanavriksha follows a strict data-sovereignty policy. Learning analytics are encrypted and only accessible by you and authorized administrators.' },
	{ q: 'How do I submit handwritten assignments?', a: 'Go to Assignments, choose the assignment, and upload clear images (JPG/PNG). The system uses OCR to process your submission.' },
	{ q: 'What should I do if I encounter technical issues?', a: 'Try clearing your browser cache or use a different browser. If the issue persists, contact support via the Help page or the support ticket form.' },
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
				{open ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
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
	const { pathname } = useLocation();
	const { user } = useAuth();
	const isAuthenticatedRoute = pathname.startsWith('/student') || pathname.startsWith('/instructor') || pathname.startsWith('/admin');

	const handleContactSupport = () => {
		const role = user?.role || 'student';
		const supportTicketPath = user ? `/${role}/support/ticket` : '/login';
		navigate(supportTicketPath);
	};

	if (isAuthenticatedRoute) {
		return (
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
				<div className="mb-12 md:mb-16">
					<h1 className="text-4xl md:text-5xl font-bold text-primary-dark mb-4">Frequently Asked Questions</h1>
					<p className="text-lg text-slate-600 leading-relaxed">Everything you need to know about the Gyanavriksha ecosystem. Find answers regarding academics, IoT integration, and administrative workflows.</p>
				</div>

				<div className="bg-white rounded-xl border border-primary-light mb-12">
					<div className="divide-y divide-primary-light">
						{FAQ_ITEMS.map((item, index) => (
							<FAQItem key={index} question={item.q} answer={item.a} />
						))}
					</div>
				</div>

				<div className="bg-gradient-to-r from-primary to-primary-dark rounded-xl p-8 md:p-12 text-white text-center">
					<h2 className="text-2xl md:text-3xl font-bold mb-4">Still have questions?</h2>
					<p className="text-primary-light mb-8 max-w-lg mx-auto">Our dedicated academic support team is ready to assist you. Whether it's technical trouble or curriculum queries, we're here to help.</p>

					<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
						<button onClick={handleContactSupport} className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary font-bold rounded-lg hover:bg-primary-50 transition-all shadow-lg">
							<Mail className="w-5 h-5" />
							Contact Support
						</button>

						<button disabled title="Coming soon" className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 text-white rounded-lg opacity-60 cursor-not-allowed">
							<MessageSquare className="w-5 h-5" />
							Live Chat (coming soon)
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background-DEFAULT flex flex-col">

			{user ? (
				<header className="bg-white border-b border-primary-light px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
					<button className="lg:hidden p-2 rounded-lg hover:bg-primary-light/50 text-slate-600">
						<Menu className="w-5 h-5" />
					</button>

					<div className="flex-1" />

					<div className="flex items-center gap-2">
						<button className="p-2 rounded-lg hover:bg-primary-light/50 text-slate-600">
							<Bell className="w-5 h-5" />
						</button>
						<button className="p-2 rounded-lg hover:bg-primary-light/50 text-slate-600">
							<Settings className="w-5 h-5" />
						</button>
						<div className="w-8 h-8 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
							{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
						</div>
					</div>
				</header>
			) : (
				<nav className="bg-white border-b border-primary-light px-6 py-3">
					<Link to="/" className="flex items-center gap-2">
						<img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-8 h-8" />
						<span className="font-bold text-sm text-primary-dark">Gyanavriksha</span>
					</Link>
				</nav>
			)}

			<main className="flex-1 py-12 md:py-16">
				<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mb-12 md:mb-16">
					<h1 className="text-4xl md:text-5xl font-bold text-primary-dark mb-4">Frequently Asked Questions</h1>
					<p className="text-lg text-slate-600 leading-relaxed">Everything you need to know about the Gyanavriksha ecosystem. Find answers regarding academics, IoT integration, and administrative workflows.</p>
				</div>

				<div className="bg-white rounded-xl border border-primary-light mb-12">
					<div className="divide-y divide-primary-light">
						{FAQ_ITEMS.map((item, index) => (
							<FAQItem key={index} question={item.q} answer={item.a} />
						))}
					</div>
				</div>

				<div className="bg-gradient-to-r from-primary to-primary-dark rounded-xl p-8 md:p-12 text-white text-center">
					<h2 className="text-2xl md:text-3xl font-bold mb-4">Still have questions?</h2>
					<p className="text-primary-light mb-8 max-w-lg mx-auto">Our dedicated academic support team is ready to assist you. Whether it's technical trouble or curriculum queries, we're here to help.</p>

					<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
						<button onClick={handleContactSupport} className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary font-bold rounded-lg hover:bg-primary-50 transition-all shadow-lg">
							<Mail className="w-5 h-5" />
							Contact Support
						</button>

						<button disabled title="Coming soon" className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 text-white rounded-lg opacity-60 cursor-not-allowed">
							<MessageSquare className="w-5 h-5" />
							Live Chat (coming soon)
						</button>
					</div>
				</div>
				</div>
			</main>

			{user ? (
				<Footer />
			) : (
				<footer className="bg-white border-t border-primary-light py-6">
					<div className="flex flex-col items-center gap-2 text-center">
						<div className="flex items-center gap-2">
							<img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-6 h-6" />
							<span className="text-xs font-medium text-slate-600">Gyanavriksha © 2026</span>
						</div>
						<p className="text-xs text-slate-500">AI-Powered Learning Ecosystem for Secondary Education</p>
					</div>
				</footer>
			)}
		</div>
	);
}

