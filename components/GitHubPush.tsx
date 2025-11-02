import React, { useState, useEffect } from 'react';
import { GitHubUser, RenderOwner } from '../types';
import * as githubService from '../services/githubService';
import * as renderService from '../services/renderService';
import { diagnoseGitHubError } from '../services/geminiService';
import { GithubIcon, KeyIcon, ExternalLinkIcon, XIcon, SpinnerIcon, CheckCircleIcon, CloudUploadIcon } from './icons/Icons';

const GITHUB_TOKEN_KEY = 'github_pat';
const RENDER_TOKEN_KEY = 'render_pat';

interface DeploymentSectionProps {
    renderYamlContent: string;
    fixedProjectFiles: { [key: string]: string };
    onReset: () => void;
}

type GitHubStatus = 'idle' | 'loading' | 'success' | 'error';
type RenderStatus = 'idle' | 'loading' | 'success' | 'error';

export const DeploymentSection: React.FC<DeploymentSectionProps> = ({ renderYamlContent, fixedProjectFiles, onReset }) => {
    // GitHub State
    const [githubToken, setGithubToken] = useState<string | null>(null);
    const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
    const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);
    const [repoName, setRepoName] = useState('');
    const [githubStatus, setGithubStatus] = useState<GitHubStatus>('idle');
    const [githubError, setGithubError] = useState<string | null>(null);
    const [repoSuccessData, setRepoSuccessData] = useState<{ url: string; repoFullName: string } | null>(null);
    const [isDiagnosingError, setIsDiagnosingError] = useState(false);

    // Render State
    const [renderToken, setRenderToken] = useState<string | null>(null);
    const [renderOwners, setRenderOwners] = useState<RenderOwner[]>([]);
    const [selectedRenderOwnerId, setSelectedRenderOwnerId] = useState<string | null>(null);
    const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
    const [renderStatus, setRenderStatus] = useState<RenderStatus>('idle');
    const [renderError, setRenderError] = useState<string | null>(null);
    const [renderSuccessData, setRenderSuccessData] = useState<{ url: string } | null>(null);
    
    useEffect(() => {
        const storedGithubToken = sessionStorage.getItem(GITHUB_TOKEN_KEY);
        if (storedGithubToken) {
            handleGithubTokenVerification(storedGithubToken);
        }
        const storedRenderToken = sessionStorage.getItem(RENDER_TOKEN_KEY);
        if (storedRenderToken) {
            handleRenderTokenVerification(storedRenderToken);
        }
    }, []);
    
    // GitHub Handlers
    const handleGithubTokenVerification = async (tokenToVerify: string) => {
        setGithubStatus('loading');
        setGithubError(null);
        try {
            const userData = await githubService.getUser(tokenToVerify);
            setGithubUser(userData);
            setGithubToken(tokenToVerify);
            sessionStorage.setItem(GITHUB_TOKEN_KEY, tokenToVerify);
            setIsGithubModalOpen(false);
        } catch (err) {
            setGithubError('Invalid token or insufficient permissions. Please check your token.');
            sessionStorage.removeItem(GITHUB_TOKEN_KEY);
        } finally {
            setGithubStatus('idle');
        }
    };
    
    const handleGithubDisconnect = () => {
        setGithubToken(null);
        setGithubUser(null);
        setRepoName('');
        setGithubStatus('idle');
        setGithubError(null);
        setRepoSuccessData(null);
        sessionStorage.removeItem(GITHUB_TOKEN_KEY);
        handleRenderDisconnect(); // Also disconnect render if github is disconnected
    };

    const handleRepoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!githubToken || !githubUser || !repoName || !fixedProjectFiles) return;

        setGithubStatus('loading');
        setGithubError(null);
        setRepoSuccessData(null);
        setIsDiagnosingError(false);

        try {
            const newRepo = await githubService.createRepo(githubToken, repoName);
            const filesToPush = { ...fixedProjectFiles, 'render.yaml': renderYamlContent };
            
            await githubService.commitMultipleFiles(
                githubToken,
                githubUser.login,
                repoName,
                filesToPush,
                'feat: Initial project commit from Deployer'
            );
            
            setRepoSuccessData({ url: newRepo.html_url, repoFullName: newRepo.full_name });
            setGithubStatus('success');
        } catch (err) {
            const rawErrorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setGithubStatus('error');
            setIsDiagnosingError(true);
            
            try {
                const diagnosedError = await diagnoseGitHubError(rawErrorMessage, repoName);
                setGithubError(diagnosedError);
            } catch (diagErr) {
                setGithubError(`Failed to create repository: ${rawErrorMessage}. Please check your repository name and that your GitHub token has 'repo' permissions.`);
            } finally {
                setIsDiagnosingError(false);
            }
        }
    };
    
    // Render Handlers
    const handleRenderTokenVerification = async (tokenToVerify: string) => {
        setRenderStatus('loading');
        setRenderError(null);
        try {
            const ownersData = await renderService.getOwners(tokenToVerify);
            const owners = ownersData.map(o => o.owner);

            if (owners.length === 0) {
                throw new Error("No owner found for this Render API key.");
            }
            setRenderOwners(owners);
            setSelectedRenderOwnerId(owners[0].id); // Default to the first owner
            setRenderToken(tokenToVerify);
            sessionStorage.setItem(RENDER_TOKEN_KEY, tokenToVerify);
            setIsRenderModalOpen(false);
        } catch (err) {
            if(err instanceof Error) {
                setRenderError(`Invalid token or API error: ${err.message}`);
            } else {
                setRenderError('An unknown error occurred.');
            }
            sessionStorage.removeItem(RENDER_TOKEN_KEY);
        } finally {
            setRenderStatus('idle');
        }
    }

    const handleRenderDisconnect = () => {
        setRenderToken(null);
        setRenderOwners([]);
        setSelectedRenderOwnerId(null);
        setRenderStatus('idle');
        setRenderError(null);
        setRenderSuccessData(null);
        sessionStorage.removeItem(RENDER_TOKEN_KEY);
    };

    const handleDeployToRender = async () => {
        if (!renderToken || !selectedRenderOwnerId || !repoSuccessData) return;

        setRenderStatus('loading');
        setRenderError(null);
        try {
            const result = await renderService.createBlueprint(renderToken, selectedRenderOwnerId, repoSuccessData.url, repoName);
            const serviceDashboardUrl = `https://dashboard.render.com/web/${result.services[0].id}`;
            setRenderSuccessData({ url: serviceDashboardUrl });
            setRenderStatus('success');
        } catch (err) {
             if (err instanceof Error) {
                setRenderError(`Failed to deploy to Render: ${err.message}`);
            } else {
                setRenderError('An unknown error occurred.');
            }
            setRenderStatus('error');
        }
    }
    
    if (renderSuccessData) {
        return (
            <div className="space-y-6 text-center">
                <CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto" />
                <h4 className="text-xl font-bold text-white">Deployment Started on Render!</h4>
                <p className="text-gray-300">
                    Your project is being deployed. You can monitor the progress on your Render dashboard.
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
                    <a href={renderSuccessData.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors w-full sm:w-auto">
                        View Deployment
                        <ExternalLinkIcon className="w-5 h-5" />
                    </a>
                    <button onClick={onReset} className="inline-flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors w-full sm:w-auto">
                        Deploy Another Project
                    </button>
                </div>
            </div>
        )
    }
    
    const selectedOwner = renderOwners.find(o => o.id === selectedRenderOwnerId);

    return (
        <div className="space-y-6">
            {/* GitHub Section */}
            <div>
                {!githubUser ? (
                    <>
                        <p className="mb-4 text-gray-300">
                            <strong>Step 1:</strong> Connect GitHub to create a new repository for your project.
                        </p>
                        <button onClick={() => setIsGithubModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            <GithubIcon className="w-5 h-5" />
                            Connect GitHub Account
                        </button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                            <div className="flex items-center gap-3">
                                <img src={githubUser.avatar_url} alt="GitHub avatar" className="w-10 h-10 rounded-full" />
                                <div>
                                    <p className="text-gray-400 text-sm">Connected as:</p>
                                    <a href={githubUser.html_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:text-cyan-400">{githubUser.login}</a>
                                </div>
                            </div>
                            <button onClick={handleGithubDisconnect} className="text-sm text-gray-400 hover:text-red-500">Disconnect</button>
                        </div>

                        {!repoSuccessData && (
                            <form onSubmit={handleRepoSubmit} className="space-y-2">
                                <label htmlFor="repo-name" className="block text-sm font-medium text-gray-300">Repository Name:</label>
                                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                    <div className="relative flex-grow">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">{githubUser.login} /</span>
                                        <input
                                            type="text"
                                            id="repo-name"
                                            value={repoName}
                                            onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9-._]/g, '-'))}
                                            placeholder="new-repository-name"
                                            required
                                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pr-3 pl-20 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                                        />
                                    </div>
                                    <button type="submit" disabled={githubStatus === 'loading' || !repoName} className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                                        {githubStatus === 'loading' ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : 'Create & Push Project'}
                                    </button>
                                </div>
                             </form>
                        )}
                        {githubStatus === 'error' && (
                            <div className="text-red-300 mt-2 bg-red-900/50 border border-red-700 p-3 rounded-lg">
                                {isDiagnosingError ? (
                                    <div className="flex items-center gap-2">
                                        <SpinnerIcon className="w-4 h-4 animate-spin" />
                                        <span>An error occurred. Analyzing with AI...</span>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-bold mb-1">GitHub Error Diagnosis:</p>
                                        <p className="whitespace-pre-wrap">{githubError}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Divider and Next Steps */}
            {repoSuccessData && (
                <div className="space-y-6">
                    <div className="text-center p-4 bg-green-900/50 border border-green-700 rounded-lg">
                        <h4 className="font-bold text-green-300">Project Pushed to GitHub Successfully!</h4>
                        <a href={repoSuccessData.url} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-400 hover:underline">
                            View Repository <ExternalLinkIcon className="inline w-4 h-4" />
                        </a>
                    </div>
                    
                    <div className="border-t border-gray-700 my-2"></div>

                    {/* Render Section */}
                    <div>
                        <p className="mb-4 text-gray-300">
                           <strong>Step 2:</strong> Connect Render to deploy your new repository.
                        </p>
                        {!selectedOwner ? (
                            <button onClick={() => setIsRenderModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                <KeyIcon className="w-5 h-5" />
                                Connect Render Account
                            </button>
                        ) : (
                             <div className="space-y-4">
                                <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full bg-cyan-800 flex items-center justify-center font-bold text-white ${selectedOwner.type === 'team' ? 'bg-purple-800' : 'bg-cyan-800'}`}>
                                            {selectedOwner.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-sm">Connected as:</p>
                                            <p className="font-semibold text-white">{selectedOwner.name}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleRenderDisconnect} className="text-sm text-gray-400 hover:text-red-500">Disconnect</button>
                                </div>
                                {renderOwners.length > 1 && (
                                     <div className="space-y-2">
                                         <label htmlFor="render-owner" className="block text-sm font-medium text-gray-300">Deploy to:</label>
                                         <select 
                                            id="render-owner"
                                            value={selectedRenderOwnerId ?? ''} 
                                            onChange={e => setSelectedRenderOwnerId(e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500"
                                        >
                                            {renderOwners.map(owner => (
                                                <option key={owner.id} value={owner.id}>{owner.name} ({owner.type})</option>
                                            ))}
                                         </select>
                                     </div>
                                )}
                                <button onClick={handleDeployToRender} disabled={renderStatus === 'loading'} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                                    {renderStatus === 'loading' ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <CloudUploadIcon className="w-5 h-5" />}
                                    {renderStatus === 'loading' ? 'Deploying...' : `Deploy '${repoName}' to Render`}
                                </button>
                             </div>
                        )}
                         {renderStatus === 'error' && <p className="text-red-400 mt-2">{renderError}</p>}
                    </div>
                </div>
            )}

            {isGithubModalOpen && <TokenModal title="GitHub Personal Access Token" storageKey={GITHUB_TOKEN_KEY} helpLink="https://github.com/settings/tokens/new?scopes=repo&description=ReplitToRenderDeployer" onClose={() => setIsGithubModalOpen(false)} onTokenSubmit={handleGithubTokenVerification} isLoading={githubStatus === 'loading'} error={githubError} warning="Ensure your token has the 'repo' scope to create repositories and commit files." />}
            {isRenderModalOpen && <TokenModal title="Render API Key" storageKey={RENDER_TOKEN_KEY} helpLink="https://dashboard.render.com/account/api-keys" onClose={() => setIsRenderModalOpen(false)} onTokenSubmit={handleRenderTokenVerification} isLoading={renderStatus === 'loading'} error={renderError} warning="This key will be used to create and deploy new services on your behalf."/>}
        </div>
    );
};

const TokenModal: React.FC<{
    title: string;
    storageKey: string;
    helpLink: string;
    onClose: () => void; 
    onTokenSubmit: (token: string) => void;
    isLoading: boolean;
    error: string | null;
    warning?: string;
}> = ({title, helpLink, onClose, onTokenSubmit, isLoading, error, warning}) => {
    const [inputValue, setInputValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onTokenSubmit(inputValue);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl w-full max-w-lg relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close modal">
                    <XIcon className="w-6 h-6" />
                </button>
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-4">
                        <KeyIcon className="w-6 h-6 text-cyan-400"/>
                        <h3 className="text-2xl font-bold text-white">Provide a {title}</h3>
                    </div>
                    <p className="text-gray-400 mb-2">
                        To continue, this app needs a {title}. Your key is stored in your browser's session storage and is only used for API calls during this session.
                    </p>
                    {warning && <p className="text-sm text-yellow-400/80 mb-4">{warning}</p>}
                    <a href={helpLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-6">
                        How to create a new key <ExternalLinkIcon className="w-4 h-4" />
                    </a>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="token-input" className="sr-only">{title}</label>
                            <input
                                id="token-input"
                                type="password"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Paste your key here"
                                required
                                className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        <button type="submit" disabled={isLoading || !inputValue} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                             {isLoading ? <><SpinnerIcon className="w-5 h-5 animate-spin" /> Verifying...</> : 'Save and Connect'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};