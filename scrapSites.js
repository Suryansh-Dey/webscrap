/**
 * @param {URL} url 
 * @returns {string}
 */
function standardise(url) {
    return url.href.toLowerCase().replace(/#.*/, '').replaceAll('//', '/')
}
/** @typedef {{images:boolean}} Options */
/**
 * @param {URL} url 
 * @param {(url:URL)=>Promise<string>|Promise<boolean>} visit 
 * @param {Options} options 
 * @param {(data:string, originalURL:URL, images:boolean)=> string} dataProcess 
 * @param {(data:string)=>URL[]} getNeighbours 
 * @param {number} limit 
 * @returns {Promise<Object<string,string>>} markdownOfPages
 */
export async function scrapSites(url, visit, options, dataProcess, getNeighbours, limit) {
    const visited = {}
    const queue = [{
        url,
        data: dataProcess(await visit(url), url, options.images)
    }]
    limit--

    while (queue.length) {
        const childPage = queue.pop()
        visited[standardise(childPage.url)] = childPage.data

        const pagePromises = []
        for (const neighbour of getNeighbours(childPage.data)) {
            if (!visited.hasOwnProperty(standardise(neighbour)) && neighbour.origin === url.origin && limit) {
                pagePromises.push((async () => {
                    try {
                        const html = await visit(neighbour)
                        if (html)
                            queue.push({
                                url: neighbour,
                                data: dataProcess(html, url, options.images)
                            })
                    } catch (error) {
                        console.log("failed to scrap", neighbour, ". Error:", error)
                    }
                })())
                limit--
            }
        }
        await Promise.all(pagePromises)
    }
    return visited
}
