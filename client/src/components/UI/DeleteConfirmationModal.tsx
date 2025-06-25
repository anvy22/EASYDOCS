import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  itemName: string; // e.g., the name of the item to confirm (PDF name, username, etc.)
  description?: string;
}

 const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  itemName,
  description = 'This action cannot be undone. Please type the name to confirm.',
}) => {
  const [inputValue, setInputValue] = useState('');

  const isMatch = inputValue.trim() === itemName;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg max-w-md w-full"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            <h2 className="text-xl font-bold text-red-600 mb-2">Confirm Deletion</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {description}
            </p>

            <p className="text-sm mb-2 dark:text-white">
              Please type <span className="font-semibold ">"{itemName}"</span> to confirm:
            </p>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              placeholder={`Type "${itemName}"`}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={!isMatch}
                className={`px-4 py-2 rounded-xl text-white ${
                  isMatch
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-red-400 cursor-not-allowed'
                }`}
              >
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteConfirmationModal;