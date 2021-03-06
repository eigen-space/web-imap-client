import { Criteria, MessageSource } from './common/types/imap-data';
import { AppMessage } from './common/types/app-message';
import {
    ErrorHandler,
    ImapDataService,
    NewEmailHandler,
    Unsubscriber
} from './common/services/data/imap/imap.data.service';
import { URL } from 'url';
import { SendMessageOptions } from './common/types/send-message-options';
import { Logger, LoggingLevelType } from '@eigenspace/utils';
import { Config } from './common/types/config';
import { ImapError } from './common/types/imap-error';

interface ConnectionConfig {
    user: string;
    password: string;
    host: string;
    mailBox: string;
    port: number;
    tls: boolean;
    authTimeout: number;
    onNewEmail?: (numberOfNewMessages: number) => void | Promise<void>;
    debug?: (info: string) => void;
}

export class ImapClient {
    private static DEFAULT_RECONNECT_INTERVAL = 1000 * 60 * 60;
    private imapDataService: ImapDataService;
    private readonly connectionConfig: ConnectionConfig;

    private logger = new Logger({ logLevel: LoggingLevelType.DEBUG, prefix: 'ImapClient' });

    constructor(config: Config) {
        const url = new URL(config.url);
        const tls = url.protocol === 'imaps:';
        const noop = (): void => {};

        this.connectionConfig = {
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            host: url.hostname,
            authTimeout: config.authTimeout,
            port: url.port || tls ? 993 : 143,
            mailBox: config.mailBox || 'INBOX',
            tls,
            onNewEmail: config.onNewEmail || noop,
            debug: config.isDebugMode ? info => this.logger.log(info) : undefined
        };

        this.imapDataService = this.createImapService();

        this.establishReconnect(config.reconnectInterval);
        this.handleSocketTimeoutError();
    }

    get user(): string {
        return this.connectionConfig.user;
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
        return this.imapDataService.reconnect(safely);
    }

    async onNewMailReceived(handler: NewEmailHandler): Promise<Unsubscriber> {
        return this.imapDataService.onNewMailReceived(handler);
    }

    async onError(handler: ErrorHandler): Promise<Unsubscriber> {
        return this.imapDataService.onError(handler);
    }

    private createImapService(): ImapDataService {
        const { onNewEmail, ...otherOptions } = this.connectionConfig;
        const options = {
            imap: {
                ...otherOptions,
                tlsOptions: { rejectUnauthorized: false }
            },
            onmail: onNewEmail
        };

        return new ImapDataService({ options, mailBox: this.connectionConfig.mailBox });
    }

    /**
     * Establish a connection in case it was closed by server
     */
    private establishReconnect(interval = ImapClient.DEFAULT_RECONNECT_INTERVAL): void {
        // For now we cannot surely determine the event when server closes connection
        // So we do reconnect every constant time
        setInterval(
            async () => {
                await this.reconnect();
                this.logger.log('reconnected after', interval);
            },
            interval
        );
    }

    /**
     * Reconnects after socket timeout error.
     * Actually the error is not reproducible. We leave it for safety if it suddenly happens.
     * Also there is an issue on GitHub with the error but there are no steps to reproduce and
     * no evidence it is actually happens because of IMAP.
     * (https://github.com/mscdex/node-imap/issues/366)
     */
    private handleSocketTimeoutError(): void {
        this.imapDataService.onError(async (error: ImapError) => {
            if (error.code !== 'ETIMEDOUT' || error.source !== 'socket') {
                return;
            }

            this.logger.error('got socket timeout error', error);
            await this.reconnect();
            this.logger.log('reconnected after socket timeout error', error);
        });
    }
}
