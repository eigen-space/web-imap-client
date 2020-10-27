export interface ImapError extends Error {
    // For example, it may be 'ECONNRESET'
    code?: string;
    source?: string;
}
