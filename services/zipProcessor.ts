// This script assumes JSZip is loaded globally via a script tag in index.html
declare const JSZip: any;

interface ProcessedZipResult {
    replitConfig: string;
    packageJson?: string;
    otherConfigs: { [key: string]: string };
    files: string[];
    allFileContents: { [key: string]: string };
}

/**
 * Finds a common root directory prefix in a list of file paths.
 * This handles cases where zips contain a single top-level folder.
 * @param filePaths - Array of file paths from the zip.
 * @returns The common root directory path (e.g., "my-project/") or an empty string.
 */
const findRootDir = (filePaths: string[]): string => {
    if (filePaths.length === 0) {
        return '';
    }

    // Find the first actual file to base the root on
    const firstFile = filePaths.find(path => !path.endsWith('/'));
    if (!firstFile) return '';
    
    const parts = firstFile.split('/');
    if (parts.length <= 1) {
        // File is in the root, so there's no common sub-directory
        return '';
    }

    const potentialRoot = parts[0] + '/';

    // Check if all other files also start with this potential root
    for (const path of filePaths) {
        if (!path.startsWith(potentialRoot)) {
            return ''; // Mismatch found, so no common root
        }
    }

    return potentialRoot;
};

export const processZipFile = async (file: File, onProgress: (message: string) => void): Promise<ProcessedZipResult> => {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is not loaded.');
    }
    onProgress('Unzipping project archive...');
    
    const zip = await JSZip.loadAsync(file);
    const allFilePaths = Object.keys(zip.files);
    
    const rootDir = findRootDir(allFilePaths);

    const allFileContents: { [key: string]: string } = {};
    for (const zipEntry of Object.values(zip.files) as any[]) {
        // Skip directories using the built-in flag
        if (zipEntry.dir) {
            continue;
        }

        const cleanPath = zipEntry.name.substring(rootDir.length);
        
        // Add stricter filtering to skip invalid or directory-like paths that aren't flagged.
        if (!cleanPath || cleanPath === '.' || cleanPath.endsWith('/')) {
            continue;
        }
        
        // Don't process files inside node_modules; it's not needed and can be huge.
        if (cleanPath.startsWith('node_modules/')) {
            continue;
        }

        try {
            const content = await zipEntry.async('string');
            allFileContents[cleanPath] = content;
        } catch (e) {
            // This is expected for binary files (images, etc.), so we just log it for debugging.
            console.warn(`Skipping non-text file or file with encoding issues: ${cleanPath}`);
        }
    }

    const replitConfig = allFileContents['.replit'];
    if (!replitConfig) {
        throw new Error("The `.replit` configuration file is missing. This file is essential for determining the project's run command and language environment. Please ensure you've uploaded a valid project zip from Replit.");
    }
    
    const packageJson = allFileContents['package.json'];

    const otherConfigs: { [key: string]: string } = {};
    const CONFIG_FILES = ['pyproject.toml', 'requirements.txt', 'go.mod']; // package.json handled separately
    for(const configFile of CONFIG_FILES) {
        if (allFileContents[configFile]) {
            otherConfigs[configFile] = allFileContents[configFile];
        }
    }

    // Provide Gemini with a list of all files that were successfully read as text.
    const files = Object.keys(allFileContents);

    onProgress(`Extracted and read ${files.length} text files.`);

    return { replitConfig, packageJson, otherConfigs, files, allFileContents };
};


export const createAndDownloadZip = async (files: { [key: string]: string }, originalZipName: string) => {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is not loaded.');
    }

    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) {
        zip.file(path, content);
    }
    
    const blob = await zip.generateAsync({ type: 'blob' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const baseName = originalZipName.endsWith('.zip') ? originalZipName.slice(0, -4) : originalZipName;
    link.download = `${baseName}-fixed.zip`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
};