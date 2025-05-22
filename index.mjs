import fetchMarkdown from "./function.js"
import { namify } from './utils.js'
import util from 'util';
import stream from 'stream';
const { Readable } = stream;
const pipeline = util.promisify(stream.pipeline);

export const handler = awslambda.streamifyResponse(async (event, responseStream, _context) => {
    event = JSON.parse(event.body) //For function URL
    let pages = await fetchMarkdown(new URL(event.url), { images: event.images }, event.limit);
    if (event.tree) 
        pages = namify(pages)

    const requestStream = Readable.from(Buffer.from(JSON.stringify(pages)));
    await pipeline(requestStream, responseStream);
});
