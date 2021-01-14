export interface Config {
    url: string;
    authTimeout: number;
    mailBox?: string;
    onNewEmail?: () => void | Promise<void>;
    reconnectInterval?: number;
    isDebugMode?: boolean;
}
