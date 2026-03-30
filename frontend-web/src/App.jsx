import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

// Auth Pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import TwoFactorSetup from './pages/auth/TwoFactorSetup';
import QRLogin from './pages/auth/QRLogin';

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
          </Route>

          {/* Instructor Routes — coming in Sprint 4 */}
          {/* <Route path="/instructor" element={...}> */}

          {/* Admin Routes — coming in Sprint 5 */}
          {/* <Route path="/admin" element={...}> */}
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
