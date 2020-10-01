import { Readable } from 'stream';
import * as Mail from 'nodemailer/lib/mailer';

export interface SendMessageOptions {
    to: string;
    subject: string;
    text?: string | Buffer | Readable;
    html?: string | Buffer | Readable;
    attachments?: Mail.Attachment[];
}
