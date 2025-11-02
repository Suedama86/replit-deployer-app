import React, { useState } from 'react';
import { ClipboardIcon, CheckCircleIcon } from './icons/Icons';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'bash' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 relative group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 bg-gray-700 rounded-md text-gray-300 hover:bg-gray-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Copy code"
      >
        {copied ? (
          <CheckCircleIcon className="w-5 h-5 text-green-400" />
        ) : (
          <ClipboardIcon className="w-5 h-5" />
        )}
      </button>
      <pre className="p-4 overflow-x-auto">
        <code className={`language-${language} text-sm`}>
          {code}
        </code>
      </pre>
    </div>
  );
};