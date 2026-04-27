import { AuthProvider, useAuth } from "./AuthContext";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthPage from './pages/AuthPage';
import GuestPassPage from './pages/GuestPassPage';
import JournalPage from './pages/JournalPage';
import MapPage from './pages/MapPage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage/>}/>
          <Route path="/share/:id" element={<GuestPassPage/>}/>
          <Route path="/" element={<ProtectedRoute><JournalPage /></ProtectedRoute>} />
          <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;