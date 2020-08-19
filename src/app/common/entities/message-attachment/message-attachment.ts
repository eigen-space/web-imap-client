import * as fs from 'fs';
import { AttachmentStream, HeaderValue } from 'mailparser';
import * as tmp from 'tmp';

export class MessageAttachment {
    path?: fs.PathLike;
    contentType?: string;
    contentDisposition?: string;
    filename?: string;
    headers?: { [name: string]: HeaderValue };
    checksum?: string;
    size?: number;
    contentId?: string;
    cid?: string;
    related?: boolean;

    constructor(data: AttachmentStream) {
        this.contentType = data.contentType;
        this.contentDisposition = data.contentDisposition;
        this.filename = data.filename;
        this.headers = {};
        data.headers.forEach((value, name) => this.headers![name] = value);
        this.checksum = data.checksum;
        this.contentId = data.contentId;
        this.cid = data.cid;
        this.related = data.related;

        const fileResult = tmp.fileSync({ discardDescriptor: true });

        this.path = fileResult.name;
        data.content.pipe(fs.createWriteStream(this.path));
        data.content.once('end', () => {
            data.release();
            this.size = data.size;
        });
    }
}
