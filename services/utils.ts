/**
 * Encodes a UTF-16 string to a Base64 string.
 * This is a robust way to handle all Unicode characters, which the standard
 * `btoa` function cannot do on its own.
 * @param str The string to encode.
 * @returns The Base64 encoded string.
 */
export const strToBase64 = (str: string): string => {
    // 1. Convert the string to a UTF-8 byte array.
    // We can't just use a simple charCodeAt loop because that works on UTF-16 code units,
    // not Unicode code points. TextEncoder correctly handles multi-byte characters.
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(str);

    // 2. Convert the byte array to a binary string.
    let binaryString = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
        binaryString += String.fromCharCode(utf8Bytes[i]);
    }
    
    // 3. Use btoa to Base64-encode the binary string.
    return btoa(binaryString);
};

/**
 * Sanitizes a file path to be compliant with APIs like GitHub's.
 * - Converts backslashes to forward slashes.
 * - Removes leading/trailing whitespace.
 * - Splits the path into components and removes invalid ones like '.', '..', or empty strings.
 * @param path The file path to sanitize.
 * @returns A clean, relative file path or an empty string if the path is invalid.
 */
export const sanitizePath = (path: string): string => {
    if (!path) return '';
    
    return path
        .trim()
        .replace(/\\/g, '/') // Convert backslashes to forward slashes
        .split('/')
        .filter(component => component && component !== '.' && component !== '..') // Remove invalid components
        .join('/');
};