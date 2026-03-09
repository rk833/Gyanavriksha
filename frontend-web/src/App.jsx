import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Auth Pages
import Login from './pages/auth/Login';
// import Register from './pages/auth/Register';

// Student Pages
// import StudentDashboard from './pages/student/Dashboard';

// Instructor Pages
// import InstructorDashboard from './pages/instructor/Dashboard';

// Admin Pages
// import AdminDashboard from './pages/admin/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />    // Redirect to login page by default - remove or mpdify when home page is implemented

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        {/* <Route path="/register" element={<Register />} /> */}

        {/* Student Routes */}
        {/* <Route path="/student/dashboard" element={<StudentDashboard />} /> */}

        {/* Instructor Routes */}
        {/* <Route path="/instructor/dashboard" element={<InstructorDashboard />} /> */}

        {/* Admin Routes */}
        {/* <Route path="/admin/dashboard" element={<AdminDashboard />} /> */}

        {/* Default redirect */}
        {/* <Route path="/" element={<Navigate to="/login" replace />} /> */}
      </Routes>
    </Router>
  );
}

export default App;