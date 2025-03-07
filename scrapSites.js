/** @typedef {{images:boolean}} Options */
/**
 * @param {URL} url 
 * @param {(url:URL)=>Promise<string>} visit 
 * @param {Options} options 
 * @param {(data:string, originalURL:URL, images:boolean)=> string} dataProcess 
 * @param {(data:string)=>URL[]} getNeighbours 
 * @param {number} limit 
 * @returns {Promise<string[]>} markdownOfPages
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
        visited[childPage.url.href.replace(/#.*/, '')] = childPage.data

        const pagePromises = []
        for (const neighbour of getNeighbours(childPage.data)) {
            if (!visited.hasOwnProperty(neighbour.href.replace(/#.*/, '')) && neighbour.origin === url.origin && limit) {
                pagePromises.push((async () => queue.push({
                    url: neighbour,
                    data: dataProcess(await visit(neighbour), url, options.images)
                }))())
                limit--
            }
        }
        await Promise.all(pagePromises)
    }
    return Object.values(visited)
}
