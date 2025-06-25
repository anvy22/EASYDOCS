import React from 'react';

interface PromptInputProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<PromptInputProps> = ({
  prompt,
  onPromptChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-900 dark:text-white">
        Enter your project prompt
      </label>

      <input
        type="text" 
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={disabled}
        placeholder="Eg: Generate a professional README for a my project WEB SCRAPPER"
        className={`w-full px-4 py-2 text-sm rounded-lg border transition duration-200 focus:outline-none
          ${
            disabled
              ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 text-gray-400 cursor-not-allowed'
              : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500'
          }`}
      />
    </div>
  );
};
