import { RenderOwner, RenderBlueprint } from '../types';

// IMPORTANT: This application uses a public CORS proxy (`corsproxy.io`) to communicate
// with the Render API directly from the browser. This is a common workaround for
// client-side applications to bypass browser security restrictions (CORS policy).
//
// For a true production-grade application, this approach has drawbacks:
// 1. Dependency on a third-party service which could be unreliable or discontinued.
// 2. Potential security risks as API keys and data pass through the proxy.
//
// The recommended production architecture is to have a secure backend (e.g., a serverless function)
// that receives requests from this frontend, and then securely calls the Render API from the server side.
// This proxy is used here due to the constraint of building a frontend-only application.
const RENDER_API_BASE = 'https://corsproxy.io/?https://api.render.com/v1';

const makeRequest = async <T>(token: string, endpoint: string, options: RequestInit = {}): Promise<T> => {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await fetch(`${RENDER_API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Render API error: ${response.status}`);
    }

    return response.json();
};

export const getOwners = (token: string): Promise<{cursor: string; owner: RenderOwner}[]> => {
    return makeRequest(token, '/owners?limit=20');
};

export const createBlueprint = (
    token: string,
    ownerId: string,
    repoUrl: string,
    repoName: string
): Promise<RenderBlueprint> => {
    return makeRequest(token, `/owners/${ownerId}/services`, {
        method: 'POST',
        body: JSON.stringify({
            type: 'blueprint',
            name: repoName,
            repo: repoUrl,
            autoDeploy: 'yes',
            // The service is created from the render.yaml in the repo
            // so we don't need to specify branch, build command, etc. here.
        }),
    });
};