/**
 * @param {URL} url 
 * @returns {string}
 */
function standardise(url) {
    return url.href.toLowerCase().replace(/#.*/, '').replaceAll('//', '/')
}
/** @typedef {{images:boolean}} Options */
/**
 * BFS in js
 * @param {URL} url 
 * @param {(url:URL)=>Promise<string>|Promise<boolean>} visit 
 * @param {Options} options 
 * @param {(data:string, originalURL:URL, images:boolean)=> {markdown:string, references:URL[]} dataProcess 
 * @param {(data:string)=>URL[]} getNeighbours 
 * @param {number} limit 
 * @returns {Promise<Object<string,string>>} markdownOfPages
 */
export async function scrapSites(url, visit, options, dataProcess, limit) {
    const visited_pages = {}
    const visited = {}
    visited[standardise(url)] = true
    const queue = [{
        url,
        ...dataProcess(await visit(url), url, options)
    }]
    limit--

    while (queue.length) {
        const childPage = queue.shift()
        visited_pages[childPage.url] = childPage.markdown

        const pagePromises = []
        for (const neighbour of childPage.references) {
            const standard_url = standardise(neighbour)
            if (!visited[standard_url] && limit && !standardise(url).startsWith(standard_url)) {
                visited[standard_url] = true
                pagePromises.push((async () => {
                    try {
                        const html = await visit(neighbour)
                        if (html)
                            queue.push({
                                url: neighbour,
                                ...dataProcess(html, url, options.images)
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
