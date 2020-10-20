import * as imap from 'imap-simple';
import { ImapSimpleOptions, Message } from 'imap-simple';
import * as nodemailer from 'nodemailer';
import * as OriginImap from 'imap';
import { AttachmentStream, HeaderValue, MailParser, MessageText } from 'mailparser';
import { Criteria, MessageSource } from '../../../types/imap-data';
import * as Mail from 'nodemailer/lib/mailer';
import { Logger, LoggingLevelType } from '@eigenspace/utils';
import { ExtendedImapClient } from '../../../types/extended-imap-client';
import { GmailOriginImapClient } from '../../../types/gmail-origin-imap-client';
import { AppMessage, ImapError, MessageAttachment, SendMessageOptions } from '../../../../..';

interface ImapDataServiceConfig {
    options: ImapSimpleOptions;
    mailBox: string;
}

export type NewEmailHandler = (numberOfNewMessages: number) => void | Promise<void>;
export type ErrorHandler = (error: ImapError) => void | Promise<void>;
export type Unsubscriber = () => {};

export class ImapDataService {
    private imapClientPromise: Promise<ExtendedImapClient>;
    private readonly emailConfig: ImapSimpleOptions;
    private readonly mailBox: string;
    private readonly transporter: Mail;

    // To have possibility reconnecting without any problem with subscribers.
    // We could get them from imap listeners but it contains not only our subscribers.
    private mailHandlers: NewEmailHandler[] = [];
    private errorHandlers: ErrorHandler[] = [];

    private logger = new Logger({ logLevel: LoggingLevelType.DEBUG, prefix: 'ImapDataService' });

    constructor(config: ImapDataServiceConfig) {
        this.emailConfig = config.options;
        this.mailBox = config.mailBox;

        this.transporter = nodemailer.createTransport({
            host: this.emailConfig.imap.host!.replace('imap', 'smtp'),
            port: this.emailConfig.imap.tls ? 465 : 587,
            auth: {
                user: this.emailConfig.imap.user,
                pass: this.emailConfig.imap.password
            }
        });
        this.imapClientPromise = this.getImapClient();
    }

    async sendMail(options: SendMessageOptions): Promise<void> {
        return this.transporter.sendMail(options);
    }

    async search(criteria: Criteria): Promise<AppMessage[]> {
        const imapSimple = await this.getImapClient();

        const defaultFetchOptions = { bodies: '', struct: true };
        const imapMessages = await imapSimple.search(criteria, defaultFetchOptions);

        const messages = await Promise.all(imapMessages.map(message => this.parseMessage(message)));
        return messages.sort((a, b) => Number(a.headers.date) - Number(b.headers.date));
    }

    async addMessageLabels(source: MessageSource, labels: string | string[]): Promise<void> {
        const imapSimple = await this.getImapClient();
        await imapSimple.addMessageLabel(source, labels);
    }

    async deleteMessageLabels(source: MessageSource, labels: string | string[]): Promise<void> {
        const unwrappedImap = await this.getUnwrappedImap();

        if (typeof (unwrappedImap as GmailOriginImapClient).delLabels !== 'function') {
            throw new Error('Removing labels is unsupported');
        }

        return new Promise(function (resolve, reject) {
            (unwrappedImap as GmailOriginImapClient).delLabels(source, labels, function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    async setMessageLabels(source: MessageSource, labels: string | string[]): Promise<void> {
        const unwrappedImap = await this.getUnwrappedImap();

        if (typeof (unwrappedImap as GmailOriginImapClient).delLabels !== 'function') {
            throw new Error('Setting labels is unsupported');
        }

        return new Promise(function (resolve, reject) {
            (unwrappedImap as GmailOriginImapClient).setLabels(source, labels, function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    /**
     * Closes the imap connection and unsubscribe all listeners.
     *
     * @param safely Flag `safely` determines behaviour which immediately
     *      closes connections and interrupts sending request in the queue.
     */
    async disconnect(safely = true): Promise<void> {
        const unwrappedImap = await this.getUnwrappedImap();

        unwrappedImap.removeAllListeners();
        this.mailHandlers = [];
        this.errorHandlers = [];

        unwrappedImap.closeBox(err => {
            if (err) {
                this.logger.log(err);
                return;
            }
        });

        if (safely) {
            const client = await this.getImapClient();
            client.end();
            return;
        }

        unwrappedImap.destroy();
    }

    async reconnect(safely = true): Promise<void> {
        const mailListeners = [...this.mailHandlers];
        const errorListeners = [...this.errorHandlers];

        await this.disconnect(safely);

        this.imapClientPromise = this.getImapClient(true);

        mailListeners.forEach(l => this.onNewMailReceived(l));
        errorListeners.forEach(l => this.onError(l));
    }

    async onNewMailReceived(handler: NewEmailHandler): Promise<Unsubscriber> {
        const unwrappedImap = await this.getUnwrappedImap();
        unwrappedImap.on('mail', handler);

        // This part emulates default behavior of onNewMail callback on the imap-simple lib
        // However, it was put here to have a possibility to subscribe
        // _ on messages not only when you create a client.
        const criteria = ['ALL'];
        const newMessages = await this.search(criteria);
        if (newMessages.length) {
            unwrappedImap.emit('mail', newMessages.length);
        }

        this.mailHandlers.push(handler);

        return () => {
            this.mailHandlers = this.mailHandlers.filter(h => h !== handler);
            return unwrappedImap.off('mail', handler);
        };
    }

    /**
     * Allows to subscribe on errors.
     * These errors are some unexpected errors or ECONNRESET,
     * when a server closes the connection.
     *
     * In other cases, the connection keeps going on according to keepalive policy.
     *
     * @param handler An error handler.
     */
    async onError(handler: ErrorHandler): Promise<Unsubscriber> {
        const client = await this.getImapClient();
        client.on('error', handler);

        this.errorHandlers.push(handler);

        return () => {
            this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
            return client.off('error', handler);
        };
    }

    async getUnwrappedImap(): Promise<OriginImap | GmailOriginImapClient> {
        const unwrappedImap = await this.getImapClient();
        return unwrappedImap.imap;
    }

    private async getImapClient(shouldBeCreatedNew = false): Promise<ExtendedImapClient> {
        if (!this.imapClientPromise || shouldBeCreatedNew) {
            this.imapClientPromise = this.getConnection();
        }

        return this.imapClientPromise;
    }

    private async getConnection(): Promise<ExtendedImapClient> {
        const imapSimple = await imap.connect(this.emailConfig);
        await imapSimple.openBox(this.mailBox);

        return imapSimple as ExtendedImapClient;
    }

    private parseMessage(imapMessage: Message): Promise<AppMessage> {
        const parser = new MailParser();
        const message = {
            info: { uid: imapMessage.attributes.uid, size: imapMessage.attributes.size },
            headers: {},
            attachments: []
        } as unknown as AppMessage;

        return new Promise((resolve, reject) => {
            parser.once('end', () => {
                resolve(message);
            });
            parser.once('error', error => {
                reject(error);
            });

            parser.on('headers', (headers: Map<string, HeaderValue>) => {
                headers.forEach((value, name) => message.headers[name] = value);
            });

            parser.on('data', (data: MessageText | AttachmentStream) => {
                if (data.type === 'text') {
                    message.text = data.html as string || data.textAsHtml || '';
                } else if (data.type === 'attachment') {
                    const attachment = new MessageAttachment(data);
                    message.attachments.push(attachment);
                }
            });

            imapMessage.parts.forEach(part => parser.write(part.body));
            parser.end();
        });
    }
}
