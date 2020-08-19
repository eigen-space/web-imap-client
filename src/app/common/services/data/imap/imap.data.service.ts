import * as imap from 'imap-simple';
import { ImapSimple, ImapSimpleOptions, Message } from 'imap-simple';
import { AppMessage } from '../../../types/imap/app-message';
import { AttachmentStream, HeaderValue, MailParser, MessageText } from 'mailparser';
import { MessageAttachment } from '../../../entities/message-attachment/message-attachment';
import { Criteria } from '../../../../..';

interface ImapDataServiceConfig {
    options: ImapSimpleOptions;
    mailBox: string;
}

export class ImapDataService {
    private connection: Promise<ImapSimple>;
    private readonly emailConfig: ImapSimpleOptions;
    private readonly mailBox: string;

    constructor(config: ImapDataServiceConfig) {
        this.emailConfig = config.options;
        this.mailBox = config.mailBox;
    }

    async search(criteria: Criteria): Promise<AppMessage[]> {
        const imapSimple = await this.getConnection();

        const fetchOptions = { bodies: '', struct: true };
        const imapMessages = await imapSimple.search(criteria, fetchOptions);

        const messages = await Promise.all(imapMessages.map(message => this.parseMessage(message)));
        // @ts-ignore
        return messages.sort((a, b) => a.headers.date - b.headers.date);
    }

    private async getConnection(): Promise<ImapSimple> {
        if (!this.connection) {
            return this.connect();
        }

        return this.connection;
    }

    private async connect(): Promise<ImapSimple> {
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
