import React, { useReducer, useCallback, useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { processZipFile, createAndDownloadZip } from './services/zipProcessor';
import { generateDeploymentPlanAndFixes } from './services/geminiService';
import { DeploymentPlan } from './types';
import { GithubIcon, RocketIcon, ExternalLinkIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, CodeBracketIcon } from './components/icons/Icons';
import { PushSourceCode } from './components/PushSourceCode';

type ProgressLog = {
  id: number;
  message: string;
  status: 'pending' | 'complete' | 'error';
};

type AppState = {
  status: 'idle' | 'processing' | 'success' | 'error';
  zipFile: File | null;
  error: string | null;
  deploymentPlan: DeploymentPlan | null;
  fixedProjectFiles: { [key: string]: string } | null;
  progressLogs: ProgressLog[];
};

type AppAction =
  | { type: 'START_PROCESSING'; payload: File }
  | { type: 'ADD_PROGRESS'; payload: string }
  | { type: 'PROCESSING_SUCCESS'; payload: { plan: DeploymentPlan; finalFiles: { [key:string]: string } } }
  | { type: 'PROCESSING_ERROR'; payload: string }
  | { type: 'RESET' };

const initialState: AppState = {
  status: 'idle',
  zipFile: null,
  error: null,
  deploymentPlan: null,
  fixedProjectFiles: null,
  progressLogs: [],
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'START_PROCESSING':
      return {
        ...initialState,
        status: 'processing',
        zipFile: action.payload,
      };
    case 'ADD_PROGRESS': {
      // FIX: Explicitly type `newLogs` as `ProgressLog[]` to guide TypeScript's type inference.
      const newLogs: ProgressLog[] = state.progressLogs.map((log, index) => 
        index === state.progressLogs.length - 1 ? { ...log, status: 'complete' } : log
      );
      return {
        ...state,
        progressLogs: [
            ...newLogs, 
            { id: Date.now(), message: action.payload, status: 'pending' }
        ],
      };
    }
    case 'PROCESSING_SUCCESS': {
      // FIX: Explicitly type `finalLogs` and add block scope to the case.
      const finalLogs: ProgressLog[] = state.progressLogs.map(log => ({ ...log, status: 'complete' }));
      return {
        ...state,
        status: 'success',
        deploymentPlan: action.payload.plan,
        fixedProjectFiles: action.payload.finalFiles,
        progressLogs: finalLogs
      };
    }
    case 'PROCESSING_ERROR': {
      // FIX: Explicitly type `errorLogs` and add block scope to the case.
      const errorLogs: ProgressLog[] = state.progressLogs.map((log, index) => 
            index === state.progressLogs.length - 1 ? { ...log, status: 'error' } : log
        );
      return {
        ...state,
        status: 'error',
        error: action.payload,
        progressLogs: errorLogs,
      };
    }
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { status, zipFile, deploymentPlan, fixedProjectFiles, progressLogs, error } = state;
  const [isPushSourceModalOpen, setIsPushSourceModalOpen] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    dispatch({ type: 'START_PROCESSING', payload: file });

    const progressCallback = (message: string) => {
        dispatch({ type: 'ADD_PROGRESS', payload: message });
    };

    try {
      const { allFileContents } = await processZipFile(file, progressCallback);
      const { plan, finalFiles } = await generateDeploymentPlanAndFixes(allFileContents, progressCallback);
      
      dispatch({ type: 'PROCESSING_SUCCESS', payload: { plan, finalFiles } });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
      dispatch({ type: 'PROCESSING_ERROR', payload: errorMessage });
    }
  }, []);

  const handleDownloadFixedZip = async () => {
    if (!fixedProjectFiles || !deploymentPlan || !zipFile) {
        dispatch({ type: 'PROCESSING_ERROR', payload: "Cannot download zip: project data is missing." });
        return;
    }
    
    const filesToZip = { ...fixedProjectFiles };
    filesToZip['render.yaml'] = deploymentPlan.renderYaml;

    await createAndDownloadZip(filesToZip, zipFile.name);
  };

  const resetState = () => {
    dispatch({ type: 'RESET' });
  };

  const isProcessing = status === 'processing';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
            <div className="flex justify-center items-center gap-4 mb-2">
                <RocketIcon className="w-10 h-10 text-cyan-400" />
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                    Replit Project Deployer
                </h1>
            </div>
          <p className="text-lg text-gray-400">
            Analyze your Replit project and generate deployment configurations for the cloud.
          </p>
        </header>

        <main>
          {status === 'idle' ? (
            <FileUpload onFileSelect={handleFileSelect} />
          ) : (
            <div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <p className="font-semibold text-white">File Selected:</p>
                  <p className="text-cyan-400 truncate">{zipFile?.name}</p>
                </div>
                <div className="flex items-center gap-4">
                    <a
                        href="https://render.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        Visit Render.com
                        <ExternalLinkIcon className="w-5 h-5" />
                    </a>
                    <button
                        onClick={resetState}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        Start Over
                    </button>
                </div>
              </div>

              {(isProcessing || (status === 'error' && progressLogs.length > 0)) && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 sm:p-8">
                    <h2 className="text-xl font-semibold text-white text-center mb-6">Analyzing & Fixing Project...</h2>
                    <ul className="space-y-3 w-full max-w-md mx-auto">
                        {progressLogs.map((log) => (
                            <li key={log.id} className="flex items-start gap-3 text-gray-300 animate-fade-in">
                                {log.status === 'pending' && <SpinnerIcon className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0 mt-1" />}
                                {log.status === 'complete' && <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />}
                                {log.status === 'error' && <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />}
                                <span className={`flex-1 ${log.status === 'error' ? 'text-red-300' : ''}`}>{log.message}</span>
                            </li>
                        ))}
                    </ul>
                    {isProcessing && <p className="text-gray-400 mt-6 text-center text-sm">This process may take a moment, especially for large projects.</p>}
                </div>
              )}
              
              {status === 'error' && (
                <div className="mt-6 bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
                  <strong className="font-bold">Oh no! An error occurred. </strong>
                  <span className="block sm:inline">{error}</span>
                </div>
              )}

              {status === 'success' && deploymentPlan && fixedProjectFiles && (
                <ResultsDisplay
                    plan={deploymentPlan}
                    onDownloadFixedZip={handleDownloadFixedZip}
                    fixedProjectFiles={fixedProjectFiles}
                    onReset={resetState}
                />
              )}
            </div>
          )}
        </main>
        
        <footer className="text-center mt-12 text-gray-500">
            <p>Powered by Gemini. Built for modern developers.</p>
            <div className="flex justify-center items-center gap-4 mt-2">
                <button 
                    onClick={() => setIsPushSourceModalOpen(true)}
                    className="inline-flex items-center gap-2 hover:text-cyan-400 transition-colors"
                >
                    <CodeBracketIcon className="w-5 h-5" />
                    <span>Push This App's Source to GitHub</span>
                </button>
                 <span className="text-gray-600">|</span>
                <a href="https://github.com/google-gemini" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-cyan-400 transition-colors">
                    <GithubIcon className="w-5 h-5" />
                    <span>View on GitHub</span>
                </a>
            </div>
        </footer>
      </div>
      {isPushSourceModalOpen && <PushSourceCode onClose={() => setIsPushSourceModalOpen(false)} />}
    </div>
  );
};

export default App;