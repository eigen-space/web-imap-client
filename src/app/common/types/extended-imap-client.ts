import { ImapSimple } from 'imap-simple';
import * as OriginImap from 'imap';
import { GmailOriginImapClient } from './gmail-origin-imap-client';

export interface ExtendedImapClient extends ImapSimple {
    imap: OriginImap | GmailOriginImapClient;
}