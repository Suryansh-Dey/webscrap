import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { scrapSites } from './scrapSites.js';
import TurndownService from "turndown";
const turndownService = new TurndownService();
const fetchEndpoint = "https://api.vinaiak.com/fetch/";

/**
 * @param {string} html
 * @param {string} url request url.
 * @param {boolean} images 
 * @returns {string} markdown
 */
function htmlToMarkdown(html, url, images = true) {
    html = html
        .replace(/<style[^>]*>.*?<\/style>/gis, "")
        .replace(/<script[^>]*>.*?<\/script>/gis, "");
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
    return turndownService.turndown(html);
}
/**
 * @param {string} data
 * @returns {URL[]} refferedSites
 */
function getReferencedSites(data, base) {
    return data.match(/https?:\/\/[^\s\)\]>]+/g)
        .map(url => {
            try {
                const processURL = new URL(url, base)
                if (processURL.pathname.includes('.')) return null
                else return processURL
            }
            catch { return null }
        })
        .filter(num => num !== null)
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

    try {
        const pages = await scrapSites(url, async (url) => {
            const page = await browser.newPage();
            await page.goto(url.href.replace(/#.*/, ''));
            console.log("Visited: ", url.href)
            const html = await page.evaluate(() => document.documentElement.querySelector("body").innerHTML);
            await page.close();
            return html
        }, options, htmlToMarkdown, getReferencedSites, limit)
        return pages
    } finally {
        await browser.close();
    }
}
