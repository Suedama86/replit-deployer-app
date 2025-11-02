import { GoogleGenAI, Type } from "@google/genai";
import { DeploymentPlan, SuggestedFix } from "../types";
import { sanitizePath } from './utils';

const DEPLOYMENT_ANALYSIS_MODEL = 'gemini-2.5-pro';
const ERROR_DIAGNOSIS_MODEL = 'gemini-flash-latest';

export interface ComprehensivePlanResult {
    plan: DeploymentPlan;
    finalFiles: { [key: string]: string };
}

export const generateDeploymentPlanAndFixes = async (
    initialProjectFiles: { [key: string]: string },
    onProgress: (message: string) => void
): Promise<ComprehensivePlanResult> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const MAX_ITERATIONS = 3;
    let currentFiles = { ...initialProjectFiles };
    let finalPlan: DeploymentPlan | null = null;

    onProgress('Preparing project files for Gemini analysis...');

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const MAX_PROMPT_CONTENT_SIZE = 200000;
        const filesForPrompt: { [key: string]: string } = {};
        let currentSize = 0;

        const priorityFiles = [
            '.replit', 'package.json', 'render.yaml', 'pyproject.toml',
            'requirements.txt', 'go.mod', 'next.config.js', 'vite.config.js',
            'svelte.config.js', 'package-lock.json', 'yarn.lock'
        ];

        for (const fileName of priorityFiles) {
            if (currentFiles[fileName]) {
                const content = currentFiles[fileName];
                if (currentSize + content.length <= MAX_PROMPT_CONTENT_SIZE) {
                    filesForPrompt[fileName] = content;
                    currentSize += content.length;
                }
            }
        }

        const sourceFileExtensions = /\.(js|ts|jsx|tsx|py|go|html|css|scss|sh|svelte|vue|rb|json)$/i;
        const excludedFilesOrDirs = /^(node_modules|dist|build|out|coverage)\/|\.(test|spec)\.|(LICENSE|README\.md)$/i;

        const otherFiles = Object.entries(currentFiles)
            .filter(([fileName]) => !filesForPrompt[fileName] && sourceFileExtensions.test(fileName) && !excludedFilesOrDirs.test(fileName))
            .sort(([a], [b]) => a.localeCompare(b));

        for (const [fileName, content] of otherFiles) {
            if (currentSize + content.length > MAX_PROMPT_CONTENT_SIZE) {
                break;
            }
            filesForPrompt[fileName] = content;
            currentSize += content.length;
        }

        const filesXml = Object.entries(filesForPrompt)
            .map(([fileName, content]) => `<file name="${fileName}">\n${content}\n</file>`)
            .join('\n');

        const prompt = `
You are an expert cloud deployment engineer. Your task is to analyze the provided Replit project files, iteratively fix any deployment issues, and generate a final, comprehensive deployment plan for Render.com.

Here is the current state of the project files (some files may be omitted for brevity):
${filesXml}

**Your multi-step task:**

1.  **Analyze and Fix:** Scrutinize all files for issues like hardcoded ports, incorrect build/start commands, environment-specific dependencies, etc. If you find issues, generate the complete, corrected content for each file that needs changing.
2.  **Generate Deployment Plan:** Based on the **corrected** state of the files, generate the complete deployment plan.
    - If it's a static site, the \`render.yaml\` MUST include the correct \`publishPath\`. For example: \`publishPath: ./dist\`.

Your output MUST be a single JSON object adhering to the schema below. If no files need fixing in this iteration, return an empty array for "fixedFiles". This signals the project is stable and your job is done for this iteration.
`;
        
        onProgress(`Sending analysis request to Gemini (Iteration ${i + 1})...`);

        const response = await ai.models.generateContent({
            model: DEPLOYMENT_ANALYSIS_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: {
                    thinkingBudget: 32768,
                },
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        projectType: { type: Type.STRING },
                        renderYaml: { type: Type.STRING },
                        buildCommand: { type: Type.STRING },
                        startCommand: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        fixedFiles: {
                            type: Type.ARRAY,
                            description: "An array of objects, each containing a fileName and its updated fileContent for files that were modified in THIS iteration.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    fileName: { type: Type.STRING },
                                    fileContent: { type: Type.STRING }
                                },
                                required: ["fileName", "fileContent"]
                            }
                        }
                    },
                    required: ["projectType", "renderYaml", "buildCommand", "startCommand", "explanation", "fixedFiles"]
                },
            },
        });
        
        onProgress('Received deployment plan and file corrections.');

        const jsonText = response.text.trim();
        try {
            const result: {
                projectType: string;
                renderYaml: string;
                buildCommand: string;
                startCommand: string;
                explanation: string;
                fixedFiles: { fileName: string; fileContent: string }[];
            } = JSON.parse(jsonText);
            
            // The plan for this iteration
            finalPlan = {
                projectType: result.projectType,
                renderYaml: result.renderYaml,
                buildCommand: result.buildCommand,
                startCommand: result.startCommand,
                explanation: result.explanation,
                suggestedFixes: [], // This will be populated after the loop
            };

            if (result.fixedFiles.length === 0) {
                onProgress('Project state is stable. Finalizing plan.');
                break; // Stable state reached
            }

            let filesWereUpdated = false;
            if (result.fixedFiles.length > 0) {
                onProgress(`Applying ${result.fixedFiles.length} file fix(es)...`);
            }

            // Sanitize filenames from Gemini before applying them
            const newUpdates: { [key: string]: string } = {};
            for (const fix of result.fixedFiles) {
                const cleanFileName = sanitizePath(fix.fileName);
                if (cleanFileName) {
                    newUpdates[cleanFileName] = fix.fileContent;
                } else {
                    console.warn(`Gemini returned an invalid file path: "${fix.fileName}". Skipping fix.`);
                }
            }

            // Apply the sanitized updates to the current file state
            for (const [fileName, content] of Object.entries(newUpdates)) {
                if (!currentFiles.hasOwnProperty(fileName) || currentFiles[fileName] !== content) {
                    currentFiles[fileName] = content;
                    filesWereUpdated = true;
                }
            }

            if (!filesWereUpdated) {
                onProgress('No new changes detected. Finalizing plan.');
                break; // AI returned non-changing fixes, break loop
            }
        } catch (e) {
            console.error(`Failed to parse Gemini JSON response on iteration ${i + 1}:`, jsonText);
            throw new Error(`Received an invalid response from the AI during the fixing process (iteration ${i + 1}).`);
        }
    }

    if (!finalPlan) {
        throw new Error("The AI failed to generate a deployment plan. Please check the project files and try again.");
    }
    
    // After the loop, generate the 'suggestedFixes' for the UI by comparing initial and final files.
    const suggestedFixes: SuggestedFix[] = [];
    for (const fileName in currentFiles) {
        // Check if the file existed initially and has changed.
        if (initialProjectFiles.hasOwnProperty(fileName) && initialProjectFiles[fileName] !== currentFiles[fileName]) {
            suggestedFixes.push({
                fileName,
                description: `This file was modified to ensure compatibility with the Render hosting environment.`,
                suggestedCode: currentFiles[fileName], // Displaying the full fixed code for clarity
            });
        }
    }
    // Also check for newly added files (like a Dockerfile, though render.yaml is handled separately)
    for (const fileName in currentFiles) {
         if (!initialProjectFiles.hasOwnProperty(fileName)) {
             suggestedFixes.push({
                fileName,
                description: `This file was added to configure the project for deployment on Render.`,
                suggestedCode: currentFiles[fileName],
            });
         }
    }


    finalPlan.suggestedFixes = suggestedFixes;
    onProgress('Analysis complete. Rendering results.');

    return { plan: finalPlan, finalFiles: currentFiles };
};

export const diagnoseGitHubError = async (
    errorMessage: string,
    repoName: string
): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
You are a helpful, expert software engineer assistant. A user encountered an error while trying to create a GitHub repository using an automated tool.

Here is the context:
- **Attempted Action:** Create a new GitHub repository.
- **Attempted Repository Name:** "${repoName}"
- **Raw GitHub API Error Message:** "${errorMessage}"

Based on this information, your task is to provide a clear, concise, and user-friendly diagnosis and solution. Your response should:
1.  Explain the likely problem in simple terms.
2.  Provide 1-2 concrete, actionable steps the user can take to resolve the issue.

**Example Scenarios:**
- If the error is about the name already existing, tell them the name is taken and suggest trying a different one.
- If the error is a 401 or 403, it's likely a token permission issue. Tell them to check if their GitHub Personal Access Token has the 'repo' scope.
- If the error is a 404, it might also be a token permission issue or a typo in the username (which is less likely here as it's fetched from the API). Advise checking token permissions.

Do not be overly technical. Focus on providing a helpful, actionable answer. Your entire response should be plain text.
`;

    try {
        const response = await ai.models.generateContent({
            model: ERROR_DIAGNOSIS_MODEL,
            contents: prompt,
        });
        return response.text.trim();
    } catch (e) {
        // If Gemini fails, fall back to the original error message
        console.error("Gemini error diagnosis failed:", e);
        return `An error occurred while creating the repository: ${errorMessage}. Please check the repository name and your GitHub token permissions.`;
    }
};