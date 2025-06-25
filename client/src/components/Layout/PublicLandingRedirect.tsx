import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { LandingPage } from "../../pages/LandingPage"

const PublicLandingRedirect = () => {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null; // Wait for auth to initialize

  return isSignedIn ? <Navigate to="/home" replace /> : <LandingPage />;
};

export default PublicLandingRedirect;
