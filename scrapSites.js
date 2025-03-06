/**
 * @typedef {{images:boolean}} Options
 */
/**
 * @param {URL} url 
 * @param {(url:URL)=>Promis<string>} visit 
 * @param {Options} options 
 * @param {(data:string, url:URL, images:boolean)=> string} dataProcess 
 * @param {(data:string)=>URL[]} getNeighbours 
 * @param {number} depth 
 * @param {Object<string,string>} visited 
 * @returns {Promise<string[]>} markdownOfPages
 */
async function bfs(url, visit, options, dataProcess, getNeighbours, depth, visited) {
    if (!depth) return
    const data = dataProcess(await visit(url), url, options.images)

    for (const neighbour of getNeighbours(data, url.origin)) {
        const urlWithoutHash = neighbour.href.replace(url.hash, "")

        if (!visited.hasOwnProperty(urlWithoutHash) && neighbour.origin === url.origin) {
            visited[urlWithoutHash] = data
            bfs(neighbour, visit, options, dataProcess, getNeighbours, depth - 1, visited)
        }
    }

    return Object.values(visited)
}
/**
 * @param {URL} url 
 * @param {(url:URL)=>Promis<string>} visit 
 * @param {Options} options 
 * @param {(data:string, url:URL, images:boolean)=> string} dataProcess 
 * @param {(data:string)=>URL[]} getNeighbours 
 * @param {number} depth 
 * @returns {Promis<string[]>} markdownOfPages
 */
export function scrapSites(url, visit, options, dataProcess, getNeighbours, depth) {
    const visited = {}
    return bfs(url, visit, options, dataProcess, getNeighbours, depth, visited)
}
