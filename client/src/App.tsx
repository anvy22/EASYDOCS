import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn } from '@clerk/clerk-react';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { HomePage } from './pages/HomePage';
import { SessionsPage } from './pages/SessionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppLayout } from './components/Layout/AppLayout';
import PublicLandingRedirect from './components/Layout/PublicLandingRedirect'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Missing Clerk Publishable Key. Please check your configuration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ThemeProvider>
        <AppProvider>
          <Router>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
              <Routes>
                <Route path="/" element={<PublicLandingRedirect />} />

                <Route path="/home" element={<SignedIn><AppLayout /></SignedIn>}>
                  <Route index element={<HomePage />} />
                  <Route path="sessions" element={<Navigate to="/sessions" replace />} />
                  <Route path="settings" element={<Navigate to="/settings" replace />} />
                </Route>

                <Route path="/sessions" element={<SignedIn><AppLayout /></SignedIn>}>
                  <Route index element={<SessionsPage />} />
                </Route>

                <Route path="/settings" element={<SignedIn><AppLayout /></SignedIn>}>
                  <Route index element={<SettingsPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </Router>
        </AppProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;
