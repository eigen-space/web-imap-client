export interface Config {
    url: string;
    authTimeout: number;
    mailBox?: string;
    onNewEmail?: (numberOfNewMessages: number) => void | Promise<void>;
    reconnectTimeout?: number;
    isDebugMode?: boolean;
}
