export interface Config {
    url: string;
    mailBox?: string;
    onNewEmail?: (numberOfNewMessages: number) => void | Promise<void>;
    reconnectTimeout?: number;
    isDebugMode?: boolean;
}
