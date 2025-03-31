import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// Initialize Turndown with GFM plugin (which supports tables)
const turndownService = new TurndownService();
turndownService.use(gfm);

// Fix: Remove unnecessary <p> tags before conversion
function cleanHTML(html) {
    return html.replace(/<\/?p[^>]*>/g, ''); // Remove <p> tags
}

// Your HTML Table
const htmlTable = `<table>
  <tr>
    <td>Header 1</td>
    <td>Header 2</td>
  </tr>
  <tr>
    <td>Data 1</td>
    <td>Data 2</td>
  </tr>
</table>`;

// Convert HTML table to Markdown
const markdown = turndownService.turndown(cleanHTML(htmlTable));

console.log(markdown);
