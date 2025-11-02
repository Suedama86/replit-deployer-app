import React from 'react';
import { SuggestedFix } from '../types';
import { WrenchIcon } from './icons/Icons';
import { CodeBlock } from './CodeBlock';

interface SuggestedFixesSectionProps {
    fixes: SuggestedFix[];
    onDownloadFixedZip: () => void;
}

export const SuggestedFixesSection: React.FC<SuggestedFixesSectionProps> = ({ fixes, onDownloadFixedZip }) => {
    return (
        <div className="bg-gray-800/50 border border-yellow-600/50 rounded-lg p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <WrenchIcon className="w-8 h-8 text-yellow-400 flex-shrink-0" />
                    <div>
                        <h3 className="text-xl font-semibold text-white">Suggested Fixes for Deployment</h3>
                        <p className="text-yellow-200/80">These changes have been prepared for a successful deployment on Render.</p>
                    </div>
                </div>
                <button
                    onClick={onDownloadFixedZip}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    Download Fixed Project ZIP
                </button>
            </div>
            <div className="text-sm bg-gray-900/50 p-3 rounded-md border border-gray-700 text-gray-300">
                Clicking the button will download a <code className="bg-gray-700 text-cyan-400 px-1 rounded">.zip</code> file with all necessary code changes and a new <code className="bg-gray-700 text-cyan-400 px-1 rounded">render.yaml</code> file, ready for deployment.
            </div>

            <div className="space-y-4">
                {fixes.map((fix, index) => (
                    <div key={index} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <p className="font-semibold text-white mb-1">
                            File: <code className="bg-gray-700 text-yellow-400 px-2 py-1 rounded">{fix.fileName}</code>
                        </p>
                        <p className="text-gray-300 mb-3">{fix.description}</p>
                        <CodeBlock code={fix.suggestedCode} language="diff" />
                    </div>
                ))}
            </div>
        </div>
    );
};