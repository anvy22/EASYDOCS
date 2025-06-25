import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { Key, BarChart3, Moon, Sun, Trash2, Save, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/clerk-react';
import DeleteConfirmationModal from '../components/UI/DeleteConfirmationModal'

export const SettingsPage: React.FC = () => {
  const { dailyTokensUsed, tokenLimit } = useApp();
  const { isDark, toggleTheme } = useTheme();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDelete ,setShowDelete] = useState<boolean>(false);
  const { getToken , signOut } = useAuth();

  const { apiKey, setApiKey } = useApp();
  const [localApiKey, setLocalApiKey] = useState('');

  // Function to get API key from server
  const fetchApiKey = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/get_apikey`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
         'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.api_key) {
        setApiKey(data.api_key);
        setLocalApiKey(data.api_key);
      } else {
        setApiKey('');
        setLocalApiKey('');
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
      toast.error('Failed to load API key');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to save API key to server
  const saveApiKeyToServer = async (keyToSave: string) => {
    try {
      setIsSaving(true);
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/save_apikey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          api_key: keyToSave
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error saving API key:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Load API key on component mount
  useEffect(() => {
    fetchApiKey();
  }, []);

  const handleSaveApiKey = async () => {
    if (!localApiKey.trim()) {
      toast.error('Please enter a valid API key');
      return;
    }

    try {
      await saveApiKeyToServer(localApiKey);
      setApiKey(localApiKey);
      toast.success('API key saved successfully!');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to save API key. Please try again.');
    }
  };

const handleDeleteAccount = async () => {
  try {
    const token = await getToken();
    const response = await fetch(`${import.meta.env.VITE_BASE_URL}/delete-account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete account. Status: ${response.status}`);
    }

    toast.success('Account deleted successfully!');
    setShowDelete(false);
    
    // Optional: Delay to let the toast show before redirect
    setTimeout(async() => {
      await signOut();
      window.location.href = '/';
    }, 1500);
  } catch (error) {
    console.error('Error deleting account:', error);
    toast.error('Failed to delete account. Please try again.');
  }
};


  const tokenUsagePercentOrg = (dailyTokensUsed / tokenLimit) * 100;
  const tokenUsagePercent = Math.min(tokenUsagePercentOrg, 100);

  const handleApiKeyChange = (value: string) => {
    setLocalApiKey(value);
  };

  const handleEditCancel = () => {
    setLocalApiKey(apiKey); // Reset to original value
    setIsEditing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences
        </p>
      </motion.div>

      <div className="grid gap-6">
        {/* API Key Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Key className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              API Key Management
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gemini API Key
              </label>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Loading API key...</span>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={isEditing ? localApiKey : apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:opacity-50 pr-12"
                      placeholder="Enter your Gemini API key"
                    />
                    
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {isEditing ? (
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSaveApiKey}
                        disabled={isSaving}
                        className="px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {isSaving ? 'Saving...' : 'Save'}
                      </motion.button>
                      <button
                        onClick={handleEditCancel}
                        disabled={isSaving}
                        className="px-4 py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setLocalApiKey(apiKey);
                        setIsEditing(true);
                      }}
                      className="px-4 py-3 bg-secondary-600 text-white rounded-xl hover:bg-secondary-700 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your API key is used to generate READMEs and is stored securely on our servers. 
              You can get your API key from the Gemini dashboard.
            </p>
          </div>
        </motion.div>
        <DeleteConfirmationModal
            isOpen={showDelete}
            onCancel={() => setShowDelete(false)}
            onConfirm={handleDeleteAccount}
            itemName="Delete Account" 
         />
        {/* Token Usage Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-accent-100 dark:bg-accent-900/30 rounded-lg">
              <BarChart3 className="w-5 h-5 text-accent-600 dark:text-accent-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Token Usage
            </h2>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Usage
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {dailyTokensUsed} / {tokenLimit} tokens
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${tokenUsagePercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-3 rounded-full ${
                    tokenUsagePercent > 80 
                      ? 'bg-red-500' 
                      : tokenUsagePercent > 60 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                  }`}
                />
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {tokenUsagePercent.toFixed(1)}% of daily limit used
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {dailyTokensUsed}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Used
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tokenLimit - dailyTokensUsed}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Remaining
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tokenLimit}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Limit
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Theme Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg">
              {isDark ? (
                <Moon className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
              ) : (
                <Sun className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Appearance
            </h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Dark Mode
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Toggle between light and dark themes
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isDark ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <motion.span
                animate={{ x: isDark ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg"
              />
            </motion.button>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-red-200 dark:border-red-800 p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-400">
              Danger Zone
            </h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Delete Account
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Permanently delete your account and all associated data
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={()=>{setShowDelete(true)}}
              className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
              Delete Account
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};