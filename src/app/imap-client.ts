import { Criteria, MessageSource } from './common/types/imap/imap-data';
import { AppMessage } from './common/types/imap/app-message';
import { ImapDataService } from './common/services/data/imap/imap.data.service';
import { URL } from 'url';

interface EmailData {
    user: string;
    password: string;
    host: string;
    mailBox: string;
    port: number;
    tls: boolean;
}

interface EmailConfig {
    url: string;
    mailBox?: string;
    onNewEmail?: (numberOfNewMessages: number) => void | Promise<void>;
}

export class ImapClient {
    private imapDataService: ImapDataService;
    private readonly emailData = {} as EmailData;

    constructor(config: EmailConfig) {
        const url = new URL(config.url);

        const tls = url.protocol === 'imaps:';
        this.emailData = {
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            host: url.hostname,
            port: url.port || tls ? 993 : 143,
            mailBox: config.mailBox || 'INBOX',
            tls
        };
        const emailConfig = {
            imap: {
                ...this.emailData,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 3000
            },
            onmail: config.onNewEmail || (() => {
            })
        };

        this.imapDataService = new ImapDataService({ options: emailConfig, mailBox: this.mailBox });
    }

    get user(): string {
        return this.emailData.user;
    }

    get password(): string {
        return this.emailData.password;
    }

    get host(): string {
        return this.emailData.host;
    }

    get mailBox(): string {
        return this.emailData.mailBox;
    }

    get port(): number {
        return this.emailData.port;
    }

    get tls(): boolean {
        return this.emailData.tls;
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
}
