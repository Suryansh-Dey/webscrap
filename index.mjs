import fetchMarkdown from "./function.js"
export async function handler(event) {
    return {
        statusCode: 200,
        body: await fetchMarkdown(new URL(event.url), { images: event.images }, event.limit)
    }
}
