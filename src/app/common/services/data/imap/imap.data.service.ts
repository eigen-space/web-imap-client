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
import { AppMessage, MessageAttachment, SendMessageOptions } from '../../../../..';

interface ImapDataServiceConfig {
    options: ImapSimpleOptions;
    mailBox: string;
}

export class ImapDataService {
    private imapClientPromise: Promise<ExtendedImapClient>;
    private readonly emailConfig: ImapSimpleOptions;
    private readonly mailBox: string;
    private readonly transporter: Mail;

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

        const fetchOptions = { bodies: '', struct: true };
        const imapMessages = await imapSimple.search(criteria, fetchOptions);

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

    // Flag `safely` determines behaviour which immediately closes connections and interrupts sending request in the queue
    async disconnect(safely = true): Promise<void> {
        const unwrappedImap = await this.getUnwrappedImap();
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

    private async getImapClient(): Promise<ExtendedImapClient> {
        if (!this.imapClientPromise) {
            this.imapClientPromise = this.getConnection();
        }

        return this.imapClientPromise;
    }

    private async getUnwrappedImap(): Promise<OriginImap | GmailOriginImapClient> {
        const unwrappedImap = await this.getImapClient();
        return unwrappedImap.imap;
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
