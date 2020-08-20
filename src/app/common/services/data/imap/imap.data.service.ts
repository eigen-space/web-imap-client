import * as imap from 'imap-simple';
import * as OriginImap from 'imap';
import { ImapSimple, ImapSimpleOptions, Message } from 'imap-simple';
import { AppMessage } from '../../../types/imap/app-message';
import { AttachmentStream, HeaderValue, MailParser, MessageText } from 'mailparser';
import { MessageAttachment } from '../../../entities/message-attachment/message-attachment';
import { Criteria } from '../../../../..';
import { MessageSource } from '../../../types/imap/imap-data';

interface ImapDataServiceConfig {
    options: ImapSimpleOptions;
    mailBox: string;
}

export class ImapDataService {
    private imapPromise: Promise<ImapSimple>;
    private readonly emailConfig: ImapSimpleOptions;
    private readonly mailBox: string;

    constructor(config: ImapDataServiceConfig) {
        this.emailConfig = config.options;
        this.mailBox = config.mailBox;

        this.imapPromise = this.getImap();
    }

    async search(criteria: Criteria): Promise<AppMessage[]> {
        const imapSimple = await this.getImap();

        const fetchOptions = { bodies: '', struct: true };
        const imapMessages = await imapSimple.search(criteria, fetchOptions);

        const messages = await Promise.all(imapMessages.map(message => this.parseMessage(message)));
        // @ts-ignore
        return messages.sort((a, b) => a.headers.date - b.headers.date);
    }

    async addMessageLabels(source: MessageSource, labels: string | string[]): Promise<void> {
        const imapSimple = await this.getImap();
        await imapSimple.addMessageLabel(source, labels);
    }

    async deleteMessageLabels(source: MessageSource, labels: string | string[]): Promise<void> {
        const unwrappedImap = await this.getUnwrappedImap();

        return new Promise(function (resolve, reject) {
            // @ts-ignore
            unwrappedImap.delLabels(source, labels, function (err) {
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

        return new Promise(function (resolve, reject) {
            // @ts-ignore
            unwrappedImap.setLabels(source, labels, function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    private async getImap(): Promise<ImapSimple> {
        if (!this.imapPromise) {
            this.imapPromise = this.getConnection();
        }

        return this.imapPromise;
    }

    private async getUnwrappedImap(): Promise<OriginImap> {
        const unwrappedImap = await this.getImap();
        // @ts-ignore
        return unwrappedImap.imap;
    }

    private async getConnection(): Promise<ImapSimple> {
        const imapSimple = await imap.connect(this.emailConfig);
        await imapSimple.openBox(this.mailBox);

        return imapSimple;
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
