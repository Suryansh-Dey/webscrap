import fetchMarkdown, { fetchHTML } from "./function.js"
import { namify } from './utils.js'
import util from 'util';
import stream from 'stream';
const { Readable } = stream;
const pipeline = util.promisify(stream.pipeline);
/** Most pages in one `raw_html` request. */
const MAX_RAW_PAGES = 50

/** Answers `body` as JSON, with `statusCode`. */
async function respond(responseStream, statusCode, body) {
    responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode, headers: { 'Content-Type': 'application/json' }
    })
    await pipeline(Readable.from(Buffer.from(JSON.stringify(body))), responseStream)
}
/** @returns {boolean} whether `page` is a `{url, selector?, header?, footer?}` */
function isRawRequest(page) {
    return typeof page?.url === 'string' && ['undefined', 'string'].includes(typeof page.selector)
}

export const handler = awslambda.streamifyResponse(async (event, responseStream, _context) => {
    event = event.body
    if (typeof event === 'string')
        event = JSON.parse(event) //For function URL

    if (event.raw_html) {
        // Many pages share one browser only because each is fetched once: a crawl from each could
        // open pages without bound.
        if (event.url !== undefined || event.limit !== undefined)
            return respond(responseStream, 400, { error: "raw_html takes `pages`, not `url` or `limit`" })
        if (!Array.isArray(event.pages) || !event.pages.length || event.pages.length > MAX_RAW_PAGES || !event.pages.every(isRawRequest))
            return respond(responseStream, 400, { error: `raw_html takes \`pages\`: 1 to ${MAX_RAW_PAGES} of {url, selector?, header?, footer?}` })
        return respond(responseStream, 200, { pages: await fetchHTML(event.pages) })
    }

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
