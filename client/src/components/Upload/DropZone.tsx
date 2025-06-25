import React, { useCallback, useState } from 'react';
import { Upload, FileCode, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ 
  onFileSelect, 
  accept = '.zip',
  disabled = false 
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect, disabled]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  return (
    <motion.div
      whileHover={disabled ? {} : { scale: 1.02 }}
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
        isDragOver && !disabled
          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
          : disabled
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
          : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      
      <div className="space-y-4">
        <div className={`inline-flex p-4 rounded-full ${
          disabled 
            ? 'bg-gray-200 dark:bg-gray-700' 
            : 'bg-primary-100 dark:bg-primary-900/30'
        }`}>
          {disabled ? (
            <AlertCircle className="w-8 h-8 text-gray-400" />
          ) : (
            <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          )}
        </div>
        
        <div>
          <h3 className={`text-lg font-semibold mb-2 ${
            disabled 
              ? 'text-gray-400 dark:text-gray-500' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {disabled ? 'Upload Disabled' : 'Drop your project folder here'}
          </h3>
          <p className={`text-sm ${
            disabled 
              ? 'text-gray-400' 
              : 'text-gray-600 dark:text-gray-400'
          }`}>
            {disabled 
              ? 'Please wait for current upload to complete'
              : 'Or click to browse and select a .zip file'
            }
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <FileCode className="w-4 h-4" />
          <span>Supports Python and JavaScript projects</span>
        </div>
      </div>
    </motion.div>
  );
};