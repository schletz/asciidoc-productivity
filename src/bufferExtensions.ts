export {};

declare global {
    interface Buffer {
        /**
         * Converts the buffer to a string, automatically detecting UTF-8 or UTF-16 encoding via BOM.
         * @returns The decoded string with any leading BOM removed.
         */
        getStringWithEncodingDetection(): string;
    }
}

Buffer.prototype.getStringWithEncodingDetection = function (): string {
    const buffer = this;
    let fileContent = '';

    // Detect UTF-16 LE (BOM: FF FE)
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        fileContent = buffer.toString('utf16le');
    } 
    // Detect UTF-16 BE (BOM: FE FF)
    else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
        if (buffer.length % 2 === 0) {
            fileContent = buffer.swap16().toString('utf16le');
        } else {
            // Fallback to UTF-8 for odd-length buffers with BE BOM
            fileContent = buffer.toString('utf8');
        }
    } 
    // Default fallback: UTF-8 (with or without BOM)
    else {
        fileContent = buffer.toString('utf8');
    }

    // Strip any remaining leading BOM character from the decoded string
    return fileContent.replace(/^\uFEFF/, '');
};