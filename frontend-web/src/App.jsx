import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

// Auth Pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import TwoFactorSetup from './pages/auth/TwoFactorSetup';
import QRLogin from './pages/auth/QRLogin';

// Public Pages
import About from './pages/About';
import Features from './pages/Features';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import CookiePolicy from './pages/CookiePolicy';

// Student Pages
import StudentLayout from './layouts/StudentLayout';
import StudentDashboard from './pages/student/Dashboard';
import StudentProfile from './pages/student/Profile';
import StudentSettings from './pages/student/Settings';
import StudentAssignments from './pages/student/Assignments';
import StudentSubmissions from './pages/student/Submissions';
import StudentKnowledgeGaps from './pages/student/KnowledgeGaps';
import StudentPerformance from './pages/student/Performance';
import StudentNotifications from './pages/student/Notifications';
import StudentLibrary from './pages/student/Library';
import StudentHelp from './pages/student/Help';

// Instructor Pages
import InstructorLayout from './layouts/InstructorLayout';
import InstructorDashboard from './pages/instructor/Dashboard';
import InstructorAssignments from './pages/instructor/Assignments';
import InstructorSubjects from './pages/instructor/Subjects';
import InstructorSubmissions from './pages/instructor/Submissions';
import InstructorVelocity from './pages/instructor/VelocityAnalytics';
import InstructorAtRisk from './pages/instructor/AtRiskStudents';
import InstructorHeatmap from './pages/instructor/ConceptHeatmap';
import InstructorKnowledgeBase from './pages/instructor/KnowledgeBase';
import InstructorExamMonitor from './pages/instructor/ExamMonitor';
import InstructorSettings from './pages/instructor/Settings';
import InstructorHelp from './pages/instructor/Help';
import InstructorNotifications from './pages/instructor/Notifications';
import InstructorProfile from './pages/instructor/Profile';
import InstructorStudentReview from './pages/instructor/StudentReview';

// Admin Pages
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUserManagement from './pages/admin/UserManagement';
import AdminAuditLogs from './pages/admin/AuditLogs';
import AdminVectorStore from './pages/admin/VectorStore';
import AdminDeviceManagement from './pages/admin/DeviceManagement';
import AdminSecurityIntegrity from './pages/admin/SecurityIntegrity';
import AdminCurriculumUpload from './pages/admin/CurriculumUpload';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAcademicManagement from './pages/admin/AcademicManagement';
import AdminNotifications from './pages/admin/Notifications';
import AdminProfile from './pages/admin/Profile';

// Common
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />

          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/2fa-setup" element={<TwoFactorSetup />} />
          <Route path="/qr-login" element={<QRLogin />} />

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="settings" element={<StudentSettings />} />
            <Route path="assignments" element={<StudentAssignments />} />
            <Route path="submissions" element={<StudentSubmissions />} />
            <Route path="knowledge-gaps" element={<StudentKnowledgeGaps />} />
            <Route path="performance" element={<StudentPerformance />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="library" element={<StudentLibrary />} />
            <Route path="help" element={<StudentHelp />} />
            <Route path="features" element={<Features />} />
            <Route path="privacy-policy" element={<PrivacyPolicy />} />
            <Route path="terms-of-service" element={<TermsOfService />} />
            <Route path="cookie-policy" element={<CookiePolicy />} />
            <Route path="about" element={<About />} />
          </Route>

          {/* Instructor Routes */}
          <Route
            path="/instructor"
            element={
              <ProtectedRoute allowedRoles={['instructor']}>
                <InstructorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<InstructorDashboard />} />
            <Route path="assignments" element={<InstructorAssignments />} />
            <Route path="subjects" element={<InstructorSubjects />} />
            <Route path="subjects/:subjectId" element={<InstructorSubjects />} />
            <Route path="submissions" element={<InstructorSubmissions />} />
            <Route path="velocity-analytics" element={<InstructorVelocity />} />
            <Route path="at-risk-students" element={<InstructorAtRisk />} />
            <Route path="concept-heatmap" element={<InstructorHeatmap />} />
            <Route path="knowledge-base" element={<InstructorKnowledgeBase />} />
            <Route path="exam-monitor" element={<InstructorExamMonitor />} />
            <Route path="settings" element={<InstructorSettings />} />
            <Route path="help" element={<InstructorHelp />} />
            <Route path="notifications" element={<InstructorNotifications />} />
            <Route path="profile" element={<InstructorProfile />} />
            <Route path="features" element={<Features />} />
            <Route path="privacy-policy" element={<PrivacyPolicy />} />
            <Route path="terms-of-service" element={<TermsOfService />} />
            <Route path="cookie-policy" element={<CookiePolicy />} />
            <Route path="about" element={<About />} />
            <Route path="student-review/:studentId" element={<InstructorStudentReview />} />
          </Route>

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUserManagement />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="academic" element={<AdminAcademicManagement />} />
            <Route path="vector-store" element={<AdminVectorStore />} />
            <Route path="iot" element={<AdminDeviceManagement />} />
            <Route path="security" element={<AdminSecurityIntegrity />} />
            <Route path="curriculum-ingestion" element={<AdminCurriculumUpload />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="features" element={<Features />} />
            <Route path="privacy-policy" element={<PrivacyPolicy />} />
            <Route path="terms-of-service" element={<TermsOfService />} />
            <Route path="cookie-policy" element={<CookiePolicy />} />
            <Route path="about" element={<About />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
