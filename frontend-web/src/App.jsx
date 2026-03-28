import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import TwoFactorSetup from './pages/auth/TwoFactorSetup';
import QRLogin from './pages/auth/QRLogin';

// Student Pages
// import StudentDashboard from './pages/student/Dashboard';

// Instructor Pages
// import InstructorDashboard from './pages/instructor/Dashboard';

// Admin Pages
// import AdminDashboard from './pages/admin/Dashboard';

// Common
// import ProtectedRoute from './components/common/ProtectedRoute';

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
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/2fa-setup" element={<TwoFactorSetup />} />
          <Route path="/qr-login" element={<QRLogin />} />

          {/* Student Routes */}
          {/* <Route path="/student/dashboard" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          } /> */}

          {/* Instructor Routes */}
          {/* <Route path="/instructor/dashboard" element={
            <ProtectedRoute allowedRoles={['instructor']}>
              <InstructorDashboard />
            </ProtectedRoute>
          } /> */}

          {/* Admin Routes */}
          {/* <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } /> */}
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
