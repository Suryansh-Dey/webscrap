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
 * @returns {string[]} refferedSites
 */
function getReferencedSites(data, base) {
    return data.match(/\bhttps?:\/\/[^\s]+/g)
        .map(url => {
            try {
                return URL(url, base)
            }
            catch { return null }
        })
        .filter(num => num !== null)
}

/**
 * @param {URL} url 
 * @param {import('./scrapSites.js').Options} options 
 * @param {number} [depth=1]
 * @returns {Promise<string[]>} pages
 */
export default async function fetchMarkdown(url, options, depth = 1) {
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
    const page = await browser.newPage();

    try {
        const pages = await scrapSites(new URL(url), async (url) => {
            await page.goto(url);
            return await page.evaluate(() => document.documentElement.querySelector("body").innerHTML);
        }, options, htmlToMarkdown, getReferencedSites, depth)
        return pages
    } finally {
        await page.close();
        await browser.close();
    }
}
