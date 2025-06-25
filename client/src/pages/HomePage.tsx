import React, { useState } from 'react';
import { DropZone } from '../components/Upload/DropZone';
import { LanguageSelector } from '../components/Upload/LanguageSelector';
import { CodeBlock } from '../components/UI/CodeBlock';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { useApp } from '../context/AppContext';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import AIModelDropdown from '../components/Layout/AIModelDropdown';
import {  useAuth } from '@clerk/clerk-react';

export const HomePage: React.FC = () => {
  const { currentReadme, setCurrentReadme,  apiKey } = useApp();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [model, setModel] = useState('gemini-1.5-pro');
  const [showCodeBlock,setShowCodeBlock] = useState(false);

  const { getToken } = useAuth();

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    toast.success(`Selected: ${file.name}`);
  };

  const generateReadme = async (
    selectedFile: File | null, 
    apiKey: string, 
    userPrompt: string, 
    model: string
  ) => {
    if (!selectedFile) {
      toast.error('Please select a project file first');
      return;
    }

    setIsGenerating(true);
    toast.loading('AI is analyzing your project...', { id: 'generating' });

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('api_key', apiKey);
      formData.append('prompt', userPrompt);
      formData.append('model', model || 'gemini-1.5-flash');

      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Something went wrong');
      }

      const blob = await res.blob();
      const text = await blob.text();
       

      setCurrentReadme(text);

    

      

      toast.success('README generated successfully!', { id: 'generating' });
    } catch (error: any) {
      toast.error(`Failed to generate README: ${error.message}`, { id: 'generating' });
    } finally {
      setShowCodeBlock(true);
      setIsGenerating(false);

    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      {  
       !showCodeBlock && 
      (<motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Upload Your Project
        </h1>
      </motion.div>)
        }
      <div >
        {/* Upload Section */}
        { !showCodeBlock ?
        (<motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className='flex justify-between'>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Project Details
              </h2>
              <AIModelDropdown 
                onModelChange={(model) => setModel(model.id)}
                defaultModel="gemini-1.5-pro"
              />
            </div>
            
            <div className="space-y-6">
              <DropZone 
                onFileSelect={handleFileSelect}
                disabled={isGenerating}
              />
              
              <LanguageSelector
                prompt={userPrompt}
                onPromptChange={(newPrompt) => setUserPrompt(newPrompt)}
                disabled={false}
              />
              
              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl"
                >
                  <p className="text-sm text-green-800 dark:text-green-300">
                    <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </motion.div>
              )}
              
              <motion.button
                whileHover={{ scale: selectedFile && !isGenerating ? 1.02 : 1 }}
                whileTap={{ scale: selectedFile && !isGenerating ? 0.98 : 1 }}
                onClick={() => generateReadme(selectedFile, apiKey, userPrompt, model)}
                disabled={!selectedFile || isGenerating}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isGenerating ? (
                  <LoadingSpinner size="sm" text="" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                {isGenerating ? 'Generating README...' : 'Generate README'}
              </motion.button>
            </div>
          </div>
        </motion.div>) :

        
       
        (<>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 ">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Generated README
            </h2>
            
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <LoadingSpinner size="lg" />
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    AI is analyzing your project...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    This may take a few moments
                  </p>
                </div>
              </div>
            ) : currentReadme ? (
              <CodeBlock content={currentReadme} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full">
                  <Sparkles className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    No README generated yet
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Upload a project file and click Generate README to get started
                  </p>
                </div>
              </div>
            )}
          </div>
          </>
        ) }
      </div>
    </div>
  );
};