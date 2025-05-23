import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { scrapSites } from './scrapSites.js';
import TurndownService from "turndown";
const turndownService = new TurndownService();
import { gfm } from 'turndown-plugin-gfm';
const fetchEndpoint = "https://api.vinaiak.com/fetch/";
turndownService.use(gfm)

/**
 * @param {string} html
 * @param {string} url request url.
 * @param {boolean} images 
 * @returns {string} markdown
 */
function htmlToMarkdown(html, url, images = true) {
    html = html
        .replace(/<style[^>]*>.*?<\/style>/gis, "")
        .replace(/<script[^>]*>.*?<\/script>/gis, "")
        .replace(/style="[^"]*"/gis, "")

    turndownService.addRule("customImage", {
        filter: "img",
        replacement: function(content, node) {
            if (!images) return ' '
            const alt = node.getAttribute("alt") || "";
            let src = node.getAttribute("src") || "";

            if (src.includes(fetchEndpoint)) return `<img src="${src}" alt="${alt}">`;

            src = new URL(src, url).toString();
            return `![${alt}](${src})`;
        },
    });
    turndownService.addRule("customLink", {
        filter: "a",
        replacement: function(content, node) {
            let href = node.getAttribute("href") || "";
            href = new URL(href, url).toString();

            return `[${content}](${href})`;
        },
    });
    return turndownService.turndown(html)
        .replace(/<img[^>]*src="([^"]*)"[^>]*>/gis, (_, rawUrl) => `<img src="${new URL(rawUrl, url)}">`);
}
/**
 * @param {URL} url 
 * @returns {boolean}
 */
function isPage(url) {
    const parts = url.pathname.split('.');
    const extention = parts[parts.length - 1].slice(1)
    return parts.length === 1 || extention.includes('/') || extention === 'htm'
}
/**
 * @param {string} data
 * @returns {URL[]} refferedSites
 */
function getReferencedSites(data, parentURL) {
    return data.match(/https?:\/\/[^\s"'<>\)]+/g)?.map(url => {
        try {
            const processURL = new URL(url, parentURL)
            if (!isPage(processURL) || processURL.origin !== parentURL.origin) return null
            return processURL
        }
        catch { return null }
    })
        ?.filter(num => num !== null) || []
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
        }, options, htmlToMarkdown, getReferencedSites, limit)
        return pages
    } finally {
        const pages = await browser.pages();
        await Promise.all(pages.map(page => page.close()));
        await browser.close();
    }
}
