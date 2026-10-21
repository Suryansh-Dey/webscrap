import fetchMarkdown from "./function.js"
import { namify } from './utils.js'
import util from 'util';
import stream from 'stream';
const { Readable } = stream;
const pipeline = util.promisify(stream.pipeline);

export const handler = awslambda.streamifyResponse(async (event, responseStream, _context) => {
    event = event.body
    if (typeof event === 'string')
        event = JSON.parse(event) //For function URL

    if (event.link_text_placeholder && event.tree)
        throw new Error("link_text_placeholder and tree cannot be used together")
    let pages = await fetchMarkdown(new URL(event.url), {
        images: event.images || false, header: event.header || false, footer: event.footer || false,
        link_text_placeholder: event.link_text_placeholder || false
    }, event.limit);
    if (event.tree)
        pages = await namify(pages)

    const requestStream = Readable.from(Buffer.from(JSON.stringify(pages)));
    await pipeline(requestStream, responseStream);
});
