import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CodeBlock } from '../components/UI/CodeBlock';
import { Search, Calendar, Code, FileText, Eye, ArrowLeft, Loader2, Trash, AlertTriangle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';

// Define the interface for README data from API
interface ReadmeData {
  id: string;
  filename: string;
  created_at: string;
  prompt: string;
  model: string;
  total_tokens: number;
  content?: string; // Will be loaded separately
}

export const SessionsPage: React.FC = () => {
  const { setCurrentReadme } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isPreviousSelected, setPreviousSelected] = useState(false);
  const [readmeData, setReadmeData] = useState<ReadmeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Delete-related state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const { getToken } = useAuth();

  // Fetch README list from Python API
  const fetchReadmeData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      
      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/readmes`, {
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
      setReadmeData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch README data');
      console.error('Error fetching README data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Improved delete function with better error handling and UX
  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      setDeleteError(null);
      
      const token = await getToken();
      
      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Please log in again');
        }
        if (response.status === 404) {
          throw new Error('Session not found - it may have already been deleted');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this session');
        }
        throw new Error(`Failed to delete session (${response.status})`);
      }

      // Remove the deleted item from local state
      setReadmeData(prev => prev.filter(item => item.id !== id));
      
      // If the deleted session was currently selected, clear selection
      if (selectedSession === id) {
        setSelectedSession(null);
        setPreviousSelected(false);
        setCurrentReadme('');
      }
      
      // Show success message
      const deletedSession = readmeData.find(item => item.id === id);
      setDeleteSuccess(`"${deletedSession?.filename || 'Session'}" deleted successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setDeleteSuccess(null), 3000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      setDeleteError(errorMessage);
      console.error('Error deleting session:', err);
      
      // Clear error message after 5 seconds
      setTimeout(() => setDeleteError(null), 5000);
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the session view
    setDeleteConfirmId(id);
  };

  // Cancel delete confirmation
  const handleCancelDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteConfirmId(null);
  };

  // Confirm delete
  const handleConfirmDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    handleDelete(id);
  };

  // Fetch README content by ID
  const fetchReadmeContent = async (readmeId: string): Promise<string> => {
    try {
      const token = await getToken();

      const response = await fetch(`${import.meta.env.VITE_BASE_URL}/readme/${readmeId}`, {
        method: 'GET',
        headers: {
        'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Please log in');
        }
        if (response.status === 404) {
          throw new Error('README not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();
      return content;
    } catch (err) {
      console.error('Error fetching README content:', err);
      throw err;
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchReadmeData();
  }, []);

  const filteredSessions = readmeData.filter(session =>
    session.filename.toLowerCase().includes(searchTerm.toLowerCase()) 
  );

  const handleViewSession = async (session: ReadmeData) => {
    try {
      setPreviousSelected(true);
      setSelectedSession(session.id);
      
      const content = await fetchReadmeContent(session.id);
      setCurrentReadme(content);
      
      setReadmeData(prev => prev.map(s => 
        s.id === session.id ? { ...s, content } : s
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load README content');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectedSessionData = readmeData.find(s => s.id === selectedSession);

  const handleRetry = () => {
    fetchReadmeData();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Previous Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage your previously generated READMEs
          </p>
        </div>
        {!isPreviousSelected ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              disabled={loading}
            />
          </div>
        ) : (
          <div className="relative">
            <ArrowLeft 
              className="h-9 w-16 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:scale-110 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 cursor-pointer p-2"
              onClick={() => setPreviousSelected(false)}
            />
          </div>
        )}
      </motion.div>

      {/* Success Message */}
      <AnimatePresence>
        {deleteSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4"
          >
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
              <p className="text-green-800 dark:text-green-200 font-medium">
                {deleteSuccess}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Error Message */}
      <AnimatePresence>
        {deleteError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
          >
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-red-800 dark:text-red-200 font-medium">
                {deleteError}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-800 dark:text-red-200 font-medium">
                  Failed to load README data
                </p>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {error}
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading README data...</span>
          </motion.div>
        )}

        {/* Sessions List or Preview */}
        {!loading && !error && (
          <>
            {!isPreviousSelected ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Sessions ({filteredSessions.length})
                  </h2>
                </div>
                
                <div className="overflow-y-auto">
                  {filteredSessions.length === 0 ? (
                    <div className="p-6 text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">
                        {searchTerm ? 'No sessions match your search' : 'No sessions found'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredSessions.map((session, index) => (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                            selectedSession === session.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          }`}
                          onClick={() => handleViewSession(session)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {session.filename}
                              </h3>
                              
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1">
                                  <Code className="w-3 h-3" />
                                  <span>{session.model}</span>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(session.created_at)}</span>
                                </div>
                              </div>
                              
                              <div className="mt-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary-100 dark:bg-secondary-900/30 text-secondary-800 dark:text-secondary-300">
                                  {session.total_tokens} tokens used
                                </span>
                              </div>
                              
                              {session.prompt && (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {session.prompt}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              <Eye className="w-4 h-4 text-gray-400" />
                              
                              {/* Delete button with confirmation */}
                              {deleteConfirmId === session.id ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => handleConfirmDelete(session.id, e)}
                                    disabled={deletingId === session.id}
                                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                    title="Confirm delete"
                                  >
                                    {deletingId === session.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={handleCancelDelete}
                                    disabled={deletingId === session.id}
                                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                                    title="Cancel delete"
                                  >
                                    <span className="text-xs">✕</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => handleDeleteClick(session.id, e)}
                                  disabled={deletingId === session.id}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                  title="Delete session"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  README Preview
                </h2>
              
                {selectedSessionData ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {selectedSessionData.filename}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(selectedSessionData.created_at)}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>Model: {selectedSessionData.model}</span>
                          <span>Tokens: {selectedSessionData.total_tokens}</span>
                        </div>
                      </div>
                      <div>
                        {deleteConfirmId === selectedSessionData.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleConfirmDelete(selectedSessionData.id, e)}
                              disabled={deletingId === selectedSessionData.id}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                              title="Confirm delete"
                            >
                              {deletingId === selectedSessionData.id ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Check className="w-5 h-5" />
                              )}
                            </button>
                            <button
                              onClick={handleCancelDelete}
                              disabled={deletingId === selectedSessionData.id}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                              title="Cancel delete"
                            >
                              <span>✕</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleDeleteClick(selectedSessionData.id, e)}
                            disabled={deletingId === selectedSessionData.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                            title="Delete session"
                          >
                            <Trash className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {selectedSessionData.content ? (
                      <CodeBlock content={selectedSessionData.content} />
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading README content...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full">
                      <Eye className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        No session selected
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        Click on a session from the list to view its README
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
};