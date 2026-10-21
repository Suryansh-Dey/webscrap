/**
 * @param {URL} url 
 * @returns {string}
 */
function standardise(url) {
    return url.href.toLowerCase().replace(/#.*/, '').replaceAll('//', '/')
}
/**
 * @param {URL} url
 * @returns {boolean}
 */
function isPage(url) {
    const parts = url.pathname.split('.');
    const extention = parts[parts.length - 1]
    return parts.length === 1 || extention.includes('/') || extention === 'html' || extention === 'aspx'
}
/** @typedef {{images:boolean, header:boolean, footer:boolean, link_text_placeholder:boolean}} Options */
/**
 * BFS in js
 * @param {URL} base_url 
 * @param {(url:URL)=>Promise<string|boolean>} visit 
 * @param {Options} options 
 * @param {(data:string, originalURL:URL, options:Options)=> {markdown:string, references:{url:URL, placeholder?:string, text?:string}[]} dataProcess 
 * @param {number} limit 
 * @returns {Promise<Object<string,string>> | Promise<Record<string, { markdown: string, placeholders: { placeholder: string, url: URL, text: string }[] }>>} object of {url:markdown}
 */
export async function scrapSites(base_url, visit, options, dataProcess, limit) {
    const visited_pages = {}
    const visited = {}
    visited[standardise(base_url)] = true
    const queue = [{
        url: base_url,
        ...dataProcess(await visit(base_url), base_url, options)
    }]
    limit--

    let childPage
    while (childPage = queue.shift()) {
        visited_pages[childPage.url] = options.link_text_placeholder ? { markdown: childPage.markdown, placeholders: childPage.references } : childPage.markdown

        const pagePromises = []
        for (const { url: neighbour } of childPage.references) {
            const standard_url = standardise(neighbour)
            if (!visited[standard_url] && limit && !standardise(base_url).startsWith(standard_url) && base_url.origin === neighbour.origin && isPage(neighbour)) {
                visited[standard_url] = true
                pagePromises.push((async () => {
                    try {
                        const html = await visit(neighbour)
                        if (html)
                            queue.push({
                                url: neighbour,
                                ...dataProcess(html, neighbour, options)
                            })
                    } catch (error) {
                        console.log("failed to scrap", neighbour.href, ". Error:", error)
                    }
                })())
                limit--
            }
        }
        await Promise.all(pagePromises)
    }
    return visited_pages
}
