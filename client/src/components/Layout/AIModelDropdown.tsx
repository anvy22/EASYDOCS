import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap,  Sparkles } from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  icon: React.ReactNode;
  description: string;
}

interface AIModelDropdownProps {
  models?: AIModel[];
  defaultModel?: string;
  onModelChange?: (model: AIModel) => void;
  className?: string;
}

const defaultModels: AIModel[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'v1.5 — Prior top-tier model with large context and strong multimodal abilities'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'v1.5 — Prior top-tier model with large context and strong multimodal abilities'
  },
  {
    id: 'gemini-1.5-flash', 
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'v2.5 — Most advanced Gemini model with superior reasoning and 1M token context'
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    icon: <Zap className="w-4 h-4" />,
    description: 'v2.0 — Lightweight, fast generation, good for real-time tasks'
  },
];


const AIModelDropdown: React.FC<AIModelDropdownProps> = ({
  models = defaultModels,
  defaultModel,
  onModelChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>(
    models.find(m => m.id === defaultModel) || models[0]
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModelSelect = (model: AIModel) => {
    setSelectedModel(model);
    setIsOpen(false);
    onModelChange?.(model);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-50 dark:bg-slate-800 hover:gray-300 border border-slate-600 rounded-md px-2 py-1.5 text-left transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-blue-400">
              {React.cloneElement(selectedModel.icon as React.ReactElement, { className: 'w-3 h-3' })}
            </div>
            <div className="text-gray-600 dark:text-white text-xs font-medium">
              {selectedModel.name}
            </div>
          </div>
          <ChevronDown 
            className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-50 dark:bg-slate-800 border border-slate-600 rounded-md shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => handleModelSelect(model)}
                className={`w-full px-2 py-1.5 text-left hover:bg-gray-300 transition-colors duration-150 ${
                  selectedModel.id === model.id ? 'bg-gray-300 dark:bg-slate-700' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="text-blue-400">
                    {React.cloneElement(model.icon as React.ReactElement, { className: 'w-3 h-3' })}
                  </div>
                  <div className="text-black dark:text-white text-xs font-medium">
                    {model.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIModelDropdown;