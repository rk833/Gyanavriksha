import { useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { GraduationCap, ShieldCheck, Brain, Accessibility } from 'lucide-react';

function TeamCard({ member }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="text-center group">
      <div className="relative mb-4 mx-auto w-28 h-28 md:w-32 md:h-32">
        <div className="absolute inset-0 bg-primary rounded-full opacity-0 group-hover:opacity-10 scale-110 transition-all duration-300 z-0" />
        {!imgFailed ? (
          <img
            src={member.photo}
            alt={member.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover rounded-full border-2 border-primary-light shadow-md ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full rounded-full border-2 border-primary-light shadow-sm bg-gradient-to-br from-primary-light/60 to-primary/20 flex items-center justify-center ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300">
            <span className="text-3xl font-bold text-primary select-none">{member.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <h5 className="text-sm font-bold text-primary-dark mb-1">{member.name}</h5>
      <p className="text-xs text-slate-600 font-medium">{member.role}</p>
    </div>
  );
}

export default function About() {
  const location = useLocation();
  const missionRef = useRef(null);
  const teamRef = useRef(null);

  useEffect(() => {
    // Handle hash navigation for smooth scrolling
    const hash = location.hash;
    if (hash === '#mission' && missionRef.current) {
      setTimeout(() => {
        missionRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else if (hash === '#team' && teamRef.current) {
      setTimeout(() => {
        teamRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location]);

  const teamMembers = [
    { name: 'Aarya', role: 'AI Lead', photo: '/images/team/aarya.jpg' },
    { name: 'Aayush', role: 'Backend Lead', photo: '/images/team/aayush.jpg' },
    { name: 'Barun', role: 'IoT Lead', photo: '/images/team/barun.jpg' },
    { name: 'Ridesha', role: 'Project Manager', photo: '/images/team/ridesha.jpg' },
    { name: 'Shritika', role: 'Frontend and Mobile App Lead', photo: '/images/team/shritika.jpg' },
  ];

  const values = [
    {
      icon: ShieldCheck,
      title: 'Academic Rigor',
      description: 'Upholding the highest standards of educational content and structural integrity in every lesson.',
    },
    {
      icon: Brain,
      title: 'Synergy',
      description: 'Harnessing the power of Artificial Intelligence to create personalized and connected learning paths.',
    },
    {
      icon: Accessibility,
      title: 'Accessibility',
      description: 'Designing inclusive digital environments that cater to diverse student needs across Kathmandu and beyond.',
    },
  ];

  return (
    <div className="bg-background">
        {/* Hero Section */}
        <section className="relative py-16 overflow-hidden bg-gradient-to-br from-primary to-primary-dark">
          <div className="max-w-[1200px] mx-auto px-6">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4 leading-tight">
              About Gyanavriksha
            </h1>
            <p className="text-sm text-white/80 max-w-2xl leading-relaxed">
              Cultivating wisdom through digital innovation. We are building the future of academic excellence in Nepal.
            </p>
          </div>
        </section>

        {/* Mission & Academic Context */}
        <section ref={missionRef} className="py-16 max-w-[1200px] mx-auto px-6 scroll-mt-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Mission Card */}
            <div className="md:col-span-7 bg-white p-8 rounded-lg shadow-sm relative overflow-hidden flex flex-col justify-center border border-primary-light">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-light/30 rounded-full -mr-12 -mt-12"></div>
              <span className="text-xs font-bold tracking-widest text-primary-dark uppercase mb-3 inline-block">
                Our Mission
              </span>
              <h2 className="text-2xl font-bold text-primary-dark mb-4 leading-snug">
                Empowering the Next Generation of Thinkers
              </h2>
              <p className="text-slate-600 leading-relaxed text-sm mb-6">
                Gyanavriksha is a collaborative initiative by students of{' '}
                <span className="text-primary font-semibold">The British College, Kathmandu</span>. Our goal is to bridge
                the gap between traditional learning and modern digital tools, providing a strong foundation for focused
                educational growth.
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary-light/50 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-slate-700 text-sm">Built by students, for students.</span>
              </div>
            </div>

            {/* Academic Context Card */}
            <div className="md:col-span-5 bg-primary-dark text-white p-8 rounded-lg flex flex-col justify-between relative overflow-hidden">
              <div>
                <span className="text-xs font-bold tracking-widest text-white/60 uppercase mb-3 inline-block">
                  Academic Context
                </span>
                <h3 className="text-xl font-bold mb-3">Course Framework</h3>
                <p className="text-white/80 leading-relaxed mb-4 text-sm">Developed as a flagship project within the rigorous curriculum of:</p>
              </div>
              <div className="bg-white/10 backdrop-blur p-4 rounded-lg border border-white/20">
                <div className="text-base font-bold mb-1">B.Sc. (Hons) Computer Science - A.I.</div>
                <div className="text-xs text-white/70 font-medium">Level 5 Project Cluster</div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16 bg-primary-light/20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-primary-dark tracking-tight mb-2">The Pillars of Our Platform</h2>
              <p className="text-slate-600 max-w-xl mx-auto text-sm">
                Foundational principles that guide every feature we build.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {values.map((value, idx) => (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-lg border border-primary-light/30 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-light/50 flex items-center justify-center mb-4">
                    <value.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="text-base font-bold text-primary-dark mb-2">{value.title}</h4>
                  <p className="text-slate-600 leading-relaxed text-xs">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section ref={teamRef} className="py-16 max-w-[1200px] mx-auto px-6 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div className="max-w-2xl">
              <span className="text-xs font-bold tracking-widest text-primary-dark uppercase mb-3 inline-block">
                The Architects
              </span>
              <h2 className="text-3xl font-bold text-primary-dark tracking-tight leading-tight">
                Meet the Minds Behind Gyanavriskha
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {teamMembers.map((member, idx) => (
              <TeamCard key={idx} member={member} />
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 max-w-[1200px] mx-auto px-6">
          <div className="bg-gradient-to-r from-primary to-primary-dark p-10 md:p-16 rounded-lg text-center relative overflow-hidden">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 relative z-10 tracking-tight leading-tight">
              Ready to step into the future of learning?
            </h2>
          </div>
        </section>
      
    </div>
  );
}
