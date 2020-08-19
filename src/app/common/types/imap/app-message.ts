import { HeaderValue } from 'mailparser';
import { MessageAttachment } from '../../entities/message-attachment/message-attachment';

interface MessageInfo {
    uid: number;
    size: number;
}

export interface AppMessage {
    info: MessageInfo;
    headers: {
        date: Date,
        [name: string]: HeaderValue
    };
    text?: string;
    attachments: MessageAttachment[];
}
