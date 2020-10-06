import { Criteria, MessageSource } from './common/types/imap-data';
import { AppMessage } from './common/types/app-message';
import { ImapDataService } from './common/services/data/imap/imap.data.service';
import { URL } from 'url';
import { SendMessageOptions } from './common/types/send-message-options';

interface ConnectionConfig {
    user: string;
    password: string;
    host: string;
    mailBox: string;
    port: number;
    tls: boolean;
    onNewEmail?: (numberOfNewMessages: number) => void | Promise<void>;
}

interface EmailConfig {
    url: string;
    mailBox?: string;
    onNewEmail?: (numberOfNewMessages: number) => void | Promise<void>;
}

export class ImapClient {
    private imapDataService: ImapDataService;
    private readonly connectionConfig: ConnectionConfig;

    constructor(config: EmailConfig) {
        const url = new URL(config.url);
        const tls = url.protocol === 'imaps:';
        const noop = (): void => {};

        this.connectionConfig = {
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            host: url.hostname,
            port: url.port || tls ? 993 : 143,
            mailBox: config.mailBox || 'INBOX',
            tls,
            onNewEmail: config.onNewEmail || noop
        };

        this.imapDataService = this.createImapService();
    }

    async sendMail(options: SendMessageOptions): Promise<void> {
        return this.imapDataService.sendMail(options);
    }

    async search(criteria: Criteria): Promise<AppMessage[]> {
        return this.imapDataService.search(criteria);
    }

    async addLabels(source: MessageSource, labels: string | string[]): Promise<void> {
        return this.imapDataService.addMessageLabels(source, labels);
    }

    async deleteLabels(source: MessageSource, labels: string | string[]): Promise<void> {
        return this.imapDataService.deleteMessageLabels(source, labels);
    }

    async setLabels(source: MessageSource, labels: string | string[]): Promise<void> {
        return this.imapDataService.setMessageLabels(source, labels);
    }

    async disconnect(safely = true): Promise<void> {
        return this.imapDataService.disconnect(safely);
    }

    async reconnect(safely = true): Promise<void> {
        await this.disconnect(safely);
        this.imapDataService = this.createImapService();
    }

    private createImapService(): ImapDataService {
        const { onNewEmail, ...otherOptions } = this.connectionConfig;
        const options = {
            imap: {
                ...otherOptions,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 3000
            },
            onmail: onNewEmail
        };

        return new ImapDataService({ options, mailBox: this.connectionConfig.mailBox });
    }
}
