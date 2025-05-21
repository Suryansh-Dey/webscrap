import fetchMarkdown from "./function.js"
import { intoTree, namifyTree } from './utils.js'

export async function handler(event) {
    let pages = await fetchMarkdown(new URL(event.url), { images: event.images }, event.limit);
    if (event.tree) {
        pages = intoTree(pages)
        namifyTree(pages)
    }
    return {
        statusCode: 200,
        body: pages
    }
}
