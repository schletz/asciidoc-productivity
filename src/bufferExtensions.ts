export {};

declare global {
    interface Buffer {
        /**
         * Decodes the buffer as UTF-16 LE/BE if it starts with the matching BOM, otherwise as
         * UTF-8. Available once this module was imported for its side effect (extension.ts).
         * @returns The text without a leading BOM.
         */
        getStringWithEncodingDetection(): string;
    }
}

Buffer.prototype.getStringWithEncodingDetection = function (): string {
    const buffer = this;
    let fileContent = '';

    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        fileContent = buffer.toString('utf16le');
    }
    else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
        // swap16 converts BE to LE in place and throws on an odd length.
        if (buffer.length % 2 === 0) {
            fileContent = buffer.swap16().toString('utf16le');
        } else {
            fileContent = buffer.toString('utf8');
        }
    }
    else {
        fileContent = buffer.toString('utf8');
    }

    // The decoded BOM remains as U+FEFF at the start.
    return fileContent.replace(/^\uFEFF/, '');
};
