import * as OriginImap from 'imap';
import { MessageSource } from './imap-data';

// Extension. This type is available for gmail imap only.
export interface GmailOriginImapClient extends OriginImap {
    setLabels(source: MessageSource, labels: string | string[], callback: (err: Error) => void): void;
    addLabels(source: MessageSource, labels: string | string[], callback: (err: Error) => void): void;
    delLabels(source: MessageSource, labels: string | string[], callback: (err: Error) => void): void;
}