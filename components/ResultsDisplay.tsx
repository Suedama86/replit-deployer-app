import React from 'react';
import { DeploymentPlan } from '../types';
import { CodeBlock } from './CodeBlock';
import { InfoIcon, GithubIcon } from './icons/Icons';
import { DeploymentSection } from './GitHubPush';
import { SuggestedFixesSection } from './SuggestedFixesSection';

interface ResultsDisplayProps {
  plan: DeploymentPlan;
  onDownloadFixedZip: () => void;
  fixedProjectFiles: { [key: string]: string };
  onReset: () => void;
}

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-400 mb-1">{label}</p>
        <p className="text-base font-mono bg-gray-900 px-2 py-1 rounded text-cyan-300 break-words">{value}</p>
    </div>
);

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ plan, onDownloadFixedZip, fixedProjectFiles, onReset }) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
            <InfoIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">Deployment Analysis</h2>
        </div>
        <p className="text-gray-300 mb-4">{plan.explanation}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <InfoCard label="Detected Project Type" value={plan.projectType} />
           <InfoCard label="Build Command" value={plan.buildCommand || 'N/A'} />
           <InfoCard label="Start Command" value={plan.startCommand} />
        </div>
      </div>

      {plan.suggestedFixes && plan.suggestedFixes.length > 0 && (
        <SuggestedFixesSection 
            fixes={plan.suggestedFixes}
            onDownloadFixedZip={onDownloadFixedZip}
        />
      )}

      <div>
        <h3 className="text-xl font-semibold mb-3 text-white">Generated `render.yaml`</h3>
        <CodeBlock code={plan.renderYaml} language="yaml" />
      </div>

      <div>
         <div className="flex items-center gap-3 mb-3">
            <GithubIcon className="w-6 h-6 text-white" />
            <h3 className="text-xl font-semibold text-white">Deploy to the Cloud</h3>
        </div>
        <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
           <DeploymentSection renderYamlContent={plan.renderYaml} fixedProjectFiles={fixedProjectFiles} onReset={onReset} />
        </div>
      </div>
    </div>
  );
};