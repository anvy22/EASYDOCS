import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

interface AppContextType {
 
  currentReadme: string | null;
  setCurrentReadme: (readme: string | null) => void;
  dailyTokensUsed: number; // Renamed for clarity
  tokenLimit: number;
  apiKey: string;
  setApiKey: (key: string) => void;
  refreshUsage: () => Promise<void>; // Added refresh function
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// ... (dummySessions remains the same) ...

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  
  const [currentReadme, setCurrentReadme] = useState<string | null>(null);
  const [dailyTokensUsed, setDailyTokensUsed] = useState<number>(0);
  const [tokenLimit] = useState(import.meta.env.VITE_GEMINI_TOKEN_LIMIT_DAY);
  const [apiKey, setApiKeyState] = useState<string>(() => {
    return localStorage.getItem('apiKey') || '';
  });

  const { getToken } = useAuth();

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem('apiKey', key);
  };



  const refreshUsage = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/usage`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Please log in');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDailyTokensUsed(data.daily_tokens_used);

    } catch (error) {
      console.error('Error refreshing token usage:', error);
    }
  }, [getToken]);

  useEffect(() => {
    const fetchInitialUsage = async () => {
      try {
        await refreshUsage();
      } catch (error) {
        console.error('Error fetching initial usage:', error);
      }
    };

    fetchInitialUsage();
  }, [refreshUsage]);

  return (
    <AppContext.Provider value={{
      currentReadme,
      setCurrentReadme,
      dailyTokensUsed, // Renamed for clarity
      tokenLimit,
      apiKey,
      setApiKey,
      refreshUsage, // Expose refresh function
    }}>
      {children}
    </AppContext.Provider>
  );
};