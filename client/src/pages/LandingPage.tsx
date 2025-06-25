import React from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { FileText, Zap, Code, CheckCircle, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '../components/UI/ThemeToggle';
import { motion } from 'framer-motion';

const features = [
  {
    icon: Zap,
    title: 'AI-Powered Generation',
    description: 'Generate professional READMEs in seconds using advanced AI technology.',
  },
  {
    icon: Code,
    title: 'Language Aware Parsing',
    description: 'Most Suitable for Python and JavaScript, but can be used for other languages as well.',
  },
  {
    icon: CheckCircle,
    title: 'Token Tracking',
    description: 'Monitor your API usage with built-in token tracking and management.',
  },
];

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <ThemeToggle />
      
      <div className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="flex justify-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="p-4 bg-primary-100 dark:bg-primary-900/30 rounded-2xl"
            >
              <FileText className="w-12 h-12 text-primary-600 dark:text-primary-400" />
            </motion.div>
          </div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6"
          >
            <span className="bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
              EASYDOCS
            </span>
            <br />
            <span className="text-3xl md:text-4xl text-gray-700 dark:text-gray-300">
              AI README Generator
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed"
          >
            Generate professional README files for your projects in seconds. 
            Upload your code, let AI analyze it, and get a beautifully formatted README.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mb-12"
          >
            <SignInButton mode="modal">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)' }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </SignInButton>
          </motion.div>
        </motion.div>

        {/* Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="max-w-6xl mx-auto"
        >
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Why Choose EASYDOCS?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1, duration: 0.6 }}
                whileHover={{ y: -5 }}
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl mb-6">
                  <feature.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Demo Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="max-w-4xl mx-auto mt-20 text-center"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Ready to Transform Your Documentation?
            </h3>
            
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Join thousands of developers who have already improved their project documentation with EASYDOCS.
            </p>
            
            <SignInButton mode="modal">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
              >
                Start Generating READMEs
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </SignInButton>
          </div>
        </motion.div>
      </div>
    </div>
  );
};