import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import AuthPage from './components/auth/AuthPage'
import AppShell from './components/layout/AppShell'

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/*" element={
        <PrivateRoute>
          <AppShell />
        </PrivateRoute>
      } />
    </Routes>
  )
}
