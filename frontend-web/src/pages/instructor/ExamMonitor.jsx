import { Monitor, Lock } from 'lucide-react';

export default function ExamMonitorPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <Monitor className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Exam Monitor</h1>
          <p className="text-sm text-slate-500">Real-time exam session monitoring and proctoring.</p>
        </div>
      </div>

      <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
        <Lock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-primary-dark mb-2">Coming Soon</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Exam monitoring with IoT device integration will be available in Sprint 7.
          This will include live proctoring, suspicious activity detection, and real-time device status.
        </p>
      </div>
    </div>
  );
}
