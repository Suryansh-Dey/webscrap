import fetchMarkdown from "./function.js"
export async function handler(event) {
    return {
        statusCode: 200,
        body: await fetchMarkdown(event.url, { images: event.images }, event.depth)
    }
}
fetchMarkdown("https://vinaiak.com", { images: true })
