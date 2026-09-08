import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function Features() {
  const location = useLocation();
  const ocrRef = useRef(null);
  const ragRef = useRef(null);
  const heatmapRef = useRef(null);
  const quizzesRef = useRef(null);
  const iotRef = useRef(null);

  useEffect(() => {
    const anchorMap = {
      '#ocr': ocrRef,
      '#rag': ragRef,
      '#heatmap': heatmapRef,
      '#quizzes': quizzesRef,
      '#iot': iotRef,
    };

    const targetRef = anchorMap[location.hash];
    if (targetRef?.current) {
      setTimeout(() => {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [location]);

  return (
    <div className="bg-background text-slate-800 -mx-4 -mt-4 lg:-mx-6 lg:-mt-6 px-4 lg:px-6 py-6 min-h-[calc(100vh-12rem)]">
      <main>
        <section className="max-w-[1200px] mx-auto px-2 sm:px-4 mb-20 md:mb-24 text-center">
          <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-primary-light text-primary-dark border border-primary/15 text-xs font-bold tracking-widest uppercase">
            The Academic Atelier
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-primary-dark mb-6 tracking-tight">
            Architecting Your <span className="text-primary">Learning Journey</span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-600 body-md leading-relaxed text-lg">
            Discover a suite of tools designed to transform the educational landscape of Nepal through intentional technology and scholarly precision.
          </p>
        </section>

        <section ref={ocrRef} id="ocr" className="py-14 md:py-24 overflow-hidden scroll-mt-24">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-primary-dark/5 rounded-[2rem] -rotate-2 group-hover:rotate-0 transition-transform duration-500" />
              <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-slate-200 border border-primary-light/50">
                <img className="w-full h-full object-cover" data-alt="Digital scan of a handwritten textbook page with highlights" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKNBW88Wz-uYTzAzLbu5Ys0PcEJWSswEuvhPL1FxcI3Zw27vgA2vAqh0TgjiY1Bw4G_u4NwO8g7L3Ur6eY-zTV1Nnl1gBIxBrsrvOUhkeuZmCS6V0ps3-FwGuMun_Kx4Ygn9HaYDm7S7yIddvqFQ1kzH_kxqw-CRAdlQl_SFTGEVHJVzHNqUW794uZECluU6Gq2BaDb6h-vA5m6PZ7sxq8sv3hEIOntE2SKmUYndnPe2QM81P_EtI-lLNxULcRKw4rWJistbJMvsQ" alt="Digital scan of a handwritten textbook page with highlights" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="material-symbols-outlined text-4xl text-primary mb-4">document_scanner</span>
              <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-6">Advanced OCR Intelligence</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Bridge the gap between physical notes and digital mastery. Our optical character recognition is optimized for complex scientific notations and varied handwriting styles.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Seamlessly digitize handwritten classroom notes into searchable text.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Extract complex mathematical formulas and chemical equations instantly.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Automatic multi-language support tailored for the Nepalese curriculum.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section ref={ragRef} id="rag" className="py-14 md:py-24 bg-slate-50 border-y border-primary-light/60 scroll-mt-24">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="order-2 md:order-1 min-w-0">
              <span className="material-symbols-outlined text-4xl text-primary mb-4">psychology</span>
              <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-6">RAG AI Tutor</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Beyond generic chat. Our Retrieval-Augmented Generation (RAG) system anchors AI responses directly to approved textbook content and verified lecture materials.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Hallucination-free tutoring grounded in official syllabus sources.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">24/7 personalized explanations tailored to your specific learning pace.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Instant reference links back to the exact page of the textbook used.</span>
                </li>
              </ul>
            </div>
            <div className="relative group order-1 md:order-2">
              <div className="absolute -inset-4 bg-primary/10 rounded-[2rem] rotate-2 group-hover:rotate-0 transition-transform duration-500" />
              <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-slate-200 border border-primary-light/50">
                <img className="w-full h-full object-cover" data-alt="Abstract neural network visualization representing AI intelligence" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBnaoyVubOiStzGT5107z245XSGHDd0B7WmqRe8GHM5W83cNBbsDNbrvB7fR9MCci6CpnnD67--LQOYMo2vaMSSvT48xxHtQMX4NH4GRADNVRVawrubP3cB8R0zBkYFJ2Qj-pBn82to4WlOBegTb_SyN1TQOsoGXf1ci0TYxVq4Luxv_pASE4EdIPspqepzIelNUkdktUybvRlTLtWP3BArUgPqohtXg2BzeMt_zPllT4neO0KMeewBBvAj3Wkosof9eemGDOw9Lmk" alt="Abstract neural network visualization representing AI intelligence" />
              </div>
            </div>
          </div>
        </section>

        <section ref={heatmapRef} id="heatmap" className="py-14 md:py-24 scroll-mt-24">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-accent-light/50 rounded-[2rem] -rotate-2 group-hover:rotate-0 transition-transform duration-500" />
              <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-slate-200 border border-primary-light/50">
                <img className="w-full h-full object-cover" data-alt="Data visualization heatmap showing student progress gradients" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsSjCkxj3ZMfH6BMA6qsebXKyV-SN-jIuzVUus5KKtPfG4TXyzi0C8_EI9xWZZl8J1_-aPeEw_HaPdVdKwwE5JJFwDEYblprrNi3FSRZlJRHc153SOs0wplfUdmHz7Lfe4g9v0x8fFa6nqBks2HXaqvoNloLWQhwfU9pJh5YYSYXLPJP8RUAfyNsEXMgzLqYT_SMnyhENF-D_DtDvJi6QBL3B-b5kIuuXhrrJ61_qmwt-CphLOOuera1ghjGLt7wnNC8QwLE2rgfU" alt="Data visualization heatmap showing student progress gradients" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="material-symbols-outlined text-4xl text-primary mb-4">grid_view</span>
              <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-6">Intelligent Concept Heatmap</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Visualize your knowledge gaps. Our heatmap tracks your interaction with every sub-topic, identifying areas of mastery and subjects needing urgent attention.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Dynamic color-coded grid representing the entire secondary syllabus.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Predictive analytics highlighting potential failure points before exams.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Focus recommendations based on weighted syllabus importance.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section ref={quizzesRef} id="quizzes" className="py-14 md:py-24 bg-slate-50 border-y border-primary-light/60 scroll-mt-24">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="order-2 md:order-1 min-w-0">
              <span className="material-symbols-outlined text-4xl text-primary mb-4">timer</span>
              <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-6">Retention Micro-Quizzes</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Fight the forgetting curve with high-frequency, low-stakes testing. Short bursts of questioning ensure long-term retention without student burnout.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">5-minute active recall sessions triggered after every major concept.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Spaced repetition algorithms that resurface difficult topics.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Gamified streaks and achievement badges for daily consistency.</span>
                </li>
              </ul>
            </div>
            <div className="relative group order-1 md:order-2">
              <div className="absolute -inset-4 bg-primary-dark/5 rounded-[2rem] rotate-2 group-hover:rotate-0 transition-transform duration-500" />
              <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-slate-200 border border-primary-light/50">
                <img className="w-full h-full object-cover" data-alt="Clean UI showing a multiple choice quiz interface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuASDum_tV0r_gkW48LSUv_2P_Jqh1qGqJMNFuxWDUdgNSlWyPdvXiW36Efc40NuN7mAjl8ZyFxOdQ36n1eopBEqAz2Rwl-n75GGi8K5ra5Cd69XRsJYOALcTT7sNBMaD-y6kQKV99_jYR77YKPY3eUejxNHY9x-BX78T2X7Dm4PoaqPuotshbMLqyaRKtIULpDYgYoldTbv6DePcpwNp2TemEAZUdOkBQIWqQNcttsBaSl4BcflLGeEawcWrkO-Vk0fwSDJCLjc7qA" alt="Clean UI showing a multiple choice quiz interface" />
              </div>
            </div>
          </div>
        </section>

        <section ref={iotRef} id="iot" className="py-14 md:py-24 scroll-mt-24 pb-24">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-primary/5 rounded-[2rem] -rotate-2 group-hover:rotate-0 transition-transform duration-500" />
              <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-slate-200 border border-primary-light/50">
                <img className="w-full h-full object-cover" data-alt="Modern wooden desk with minimalist hardware sensors" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZGuSgPYvY5T1uEcfAoZwEK7PI3KqG12XRc1fDxeXnGla0ccFli42sce0NpJB0ErjEO_oVFtkHsXI2yV1AMxdRzMVOfH40DnmnIT9F8iEHiE-pegZGbcARa9VjDKvuLdGiswv-msf8a0o4KeQcsrL5n1m6d6k0eZumbxCbU_-BiEdi9mR5P3Nua912thZ9i7XaZmMbCY31xeOAOwABnYwZV7TyEfZdg1kYnZXJeg6DKjaLpgiBNCoTF2ctMHYh0CpCx1ceDIXLhjk" alt="Modern wooden desk with minimalist hardware sensors" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="material-symbols-outlined text-4xl text-primary mb-4">devices_other</span>
              <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-6">The IoT Smart Desk</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Physical meeting digital. Our proprietary hardware kit integrates with your study space to monitor environmental factors and focus levels.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Smart ambient lighting that adjusts based on time-of-day and focus.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Physical &apos;Focus Mode&apos; button that silences digital distractions.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-slate-800">Posture and ergonomics monitoring via non-intrusive desk sensors.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
