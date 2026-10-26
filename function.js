import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { scrapSites } from './scrapSites.js';
import TurndownService from "turndown";
import { gfm } from './gfm.cjs';

let global_count = 0
/** Most pages one browser has open at once in `fetchHTML`. */
const MAX_TABS = 12

/** @typedef {{images:boolean, header:boolean, footer:boolean, link_text_placeholder:boolean}} Options */
/**
 * @param {Options} options
 * @returns {string} cleaned HTML
 */
function cleanHTML(options) {
    let remove = ['script', 'style', 'colgroup', 'svg', 'col']
    if (!options.header) remove.push('header')
    if (!options.footer) remove.push('footer')
    remove.forEach(tag => {
        document.querySelectorAll(tag).forEach(el => el.remove());
    });
    return document.body.innerHTML
}
/**
 * @param {string} html
 * @param {URL} base_url request url.
 * @param {Options} options 
 * @returns {{markdown:string, references:{url:URL, placeholder?:string, text?:string}[]}} markdown
 */
export function htmlToMarkdown(html, base_url, options) {
    const turndownService = new TurndownService();
    turndownService.use(gfm)

    if (options.images) {
        turndownService.addRule('absoluteImages', {
            filter: 'img',
            replacement: (_, node) => {
                const src = node.getAttribute('src');
                if (!src) return '';
                const absoluteSrc = new URL(src, base_url).href;
                const alt = node.getAttribute('alt') || '';
                return `![${alt}](${absoluteSrc})`;
            }
        });
    } else {
        turndownService.addRule('image', {
            filter: ['img', 'picture'],
            replacement: () => ''
        });
    }

    const references = []
    turndownService.addRule("absoluteLinks", {
        filter: "a",
        replacement: function(content, node) {
            const href = node.getAttribute("href")
            if (!href) return ''
            let url
            try {
                url = new URL(href, base_url)
            } catch {
                return '' // Malformed href
            }
            if (!options.link_text_placeholder) {
                references.push({ url })
                return `[${content || url}](${url})`
            }
            const placeholder = `PLACEHOLDER_${global_count++};`
            references.push(
                { url, placeholder, text: content })
            return `[${placeholder}](${url})`

        },
    });

    return { markdown: turndownService.turndown(html), references };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
async function launchBrowser() {
    return puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
}
/**
 * A new tab of `browser` that doesn't load images or media.
 * @param {import('puppeteer-core').Browser} browser
 */
async function newPage(browser) {
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if (request.resourceType() === 'image' || request.resourceType() === 'media') {
            request.abort()
        } else {
            request.continue()
        }
    })
    return page
}
/**
 * @param {URL} url 
 * @param {Options} options 
 * @param {number} [limit=1]
 * @returns {Promise<Record<string, string>> | Promise<Record<string, { markdown: string, placeholders: { placeholder: string, url: URL, text: string }[] }>>}
 */
export default async function fetchMarkdown(url, options, limit = 1) {
    const browser = await launchBrowser();
    let pageCount = 0

    try {
        const pages = await scrapSites(url, async (url) => {
            while (pageCount > 12) await sleep(1000) // Limiting the max number of concurrent pages
            pageCount++
            const page = await newPage(browser);
            const response = await page.goto(url.href.replace(/#.*/, ''), { waitUntil: 'domcontentloaded' })

            let data = false;
            if (response && response.status() < 400 &&
                response.headers()['content-type'] && response.headers()['content-type'].startsWith('text/html')) {
                console.log("Scrapping: ", url.href)
                await sleep(5 * 1000) // Waiting for async js
                data = await page.evaluate(cleanHTML, options);
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
/** @typedef {{url:string, selector?:string, header?:boolean, footer?:boolean}} RawRequest */
/** @typedef {{url:string, html:string, matches?:number} | {error:string}} RawResult */
/**
 * Runs in the page: the elements `selector` matches, cleaned as `cleanHTML` cleans a page, with
 * the links in them made absolute, so `<base>` and redirects are already applied. The selector runs
 * before anything is removed, so a position in it, like `:nth-child(3)`, counts what the person's
 * browser does.
 * @param {string} selector
 * @param {{header:boolean, footer:boolean}} options
 * @returns {{html:string, matches:number}}
 */
function select(selector, options) {
    const matches = [...document.querySelectorAll(selector)]
    let remove = ['script', 'style', 'colgroup', 'svg', 'col']
    if (!options.header) remove.push('header')
    if (!options.footer) remove.push('footer')
    for (const match of matches) {
        match.querySelectorAll(remove.join(',')).forEach(el => el.remove())
        for (const link of [match, ...match.querySelectorAll('a[href]')])
            if (link.matches('a[href]')) link.setAttribute('href', link.href)
    }
    return { html: matches.map(match => match.outerHTML).join('\n'), matches: matches.length }
}
/**
 * @param {import('puppeteer-core').Page} page
 * @param {RawRequest} request
 * @returns {Promise<RawResult>}
 */
async function rawPage(page, { url, selector, header = false, footer = false }) {
    const response = await page.goto(new URL(url).href.replace(/#.*/, ''), { waitUntil: 'domcontentloaded' })
    if (!response) throw new Error('the page gave no response')
    if (response.status() >= 400) throw new Error(`the page answered ${response.status()}`)
    if (!response.headers()['content-type']?.startsWith('text/html')) throw new Error('it is not an HTML page')
    await sleep(5 * 1000) // Waiting for async js
    if (selector === undefined) return { url: page.url(), html: await page.evaluate(cleanHTML, { header, footer }) }
    return { url: page.url(), ...await page.evaluate(select, selector, { header, footer }) }
}
/**
 * Each page's HTML once its scripts ran, cleaned as for markdown: its body, or what its `selector`
 * matches. Each page is fetched once, never crawled, by one browser with at most `MAX_TABS` open;
 * a page that fails gives its own `{error}`.
 * @param {RawRequest[]} requests
 * @returns {Promise<RawResult[]>} in the order of `requests`
 */
export async function fetchHTML(requests) {
    const browser = await launchBrowser()
    let open = 0
    try {
        return await Promise.all(requests.map(async (request) => {
            while (open >= MAX_TABS) await sleep(100)
            open++
            let page
            try {
                page = await newPage(browser)
                return await rawPage(page, request)
            } catch (error) {
                return { error: error?.message ?? String(error) }
            } finally {
                await page?.close().catch(() => { })
                open--
            }
        }))
    } finally {
        await browser.close()
    }
}
