import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { scrapSites } from './scrapSites.js';
import TurndownService from "turndown";
import { gfm } from './gfm.cjs';

/**
 * @param {string} html
 * @param {URL} base_url request url.
 * @param {{images:boolean, header:boolean, footer:boolean}} options 
 * @returns {{markdown:string, references:URL[]}} markdown
 */
function htmlToMarkdown(html, base_url, options) {
    const turndownService = new TurndownService();
    turndownService.use(gfm)

    const remove = ['script', 'style', 'colgroup']
    if (!options.images) remove.push('img')
    if (!options.header) remove.push('header')
    if (!options.footer) remove.push('footer')
    turndownService.remove(remove)

    const references = []
    turndownService.addRule("absoluteLinks", {
        filter: "a",
        replacement: function(content, node) {
            const href = node.getAttribute("href");
            if (!href) return ''
            const url = new URL(href, base_url);
            if (url.origin === base_url.origin && isPage(url))
                references.push(url)

            return `[${content || url}](${url})`;
        },
    });
    if (options.images) {
        turndownService.addRule('absoluteImages', {
            filter: 'img',
            replacement: (_, node) => {
                const src = node.getAttribute('src');
                const absoluteSrc = new URL(src, base_url).href;
                const alt = node.getAttribute('alt') || '';
                return `![${alt}](${absoluteSrc})`;
            }
        });
    }

    return {
        markdown: turndownService.turndown(html)
        , references
    };
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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
/**
 * @param {URL} url 
 * @param {import('./scrapSites.js').Options} options 
 * @param {number} [limit=1]
 * @returns {Promise<Object<string,string>>} pages
 */
export default async function fetchMarkdown(url, options, limit = 1) {
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
    let pageCount = 0

    try {
        const pages = await scrapSites(url, async (url) => {
            while (pageCount > 12) await sleep(1000) // Limiting the max number of concurrent pages
            pageCount++
            const page = await browser.newPage();

            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (request.resourceType() === 'image' || request.resourceType() === 'media') {
                    request.abort()
                } else {
                    request.continue()
                }
            })
            const response = await page.goto(url.href.replace(/#.*/, ''), { waitUntil: 'domcontentloaded' })

            let data = false;
            if (response && response.status() < 400 &&
                response.headers()['content-type'] && response.headers()['content-type'].startsWith('text/html')) {
                console.log("Scrapping: ", url.href)
                await sleep(5 * 1000) // Waiting for async js
                const html = await page.evaluate(() => document.body.innerHTML);
                data = html
            }
            await page.close();
            pageCount--
            return data
        }, options, htmlToMarkdown, limit)
        return pages
    } finally {
        const pages = await browser.pages();
        await Promise.all(pages.map(page => page.close()));
        await browser.close();
    }
}
