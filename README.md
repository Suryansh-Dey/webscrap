AWS Lambda function for web scrapping. [Demo](https://drive.google.com/file/d/12_RpFsxBZkTdla1rrd-MOi0R-Q57Rf_u/view?usp=drive_link)
```js
export async function scrapURL(url: string): Promise<string> { //Returns markdown string
    return await fetch("https://w7j2ouzoexsr4fqzfix767hx240nrypa.lambda-url.ap-south-1.on.aws" + "/scrap/site", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.toString() }),
    })
    .then(async (response) => {
        if (response.status != 200) {
            throw new Error("Failed to fetch " + url);
        }
        return response
            .json()
            .then((pages) => Object.values(pages)[0])
    })
}

scrapURL("https://bitmesra.ac.in/Show_Brochure_Details/109/108").then(data=>console.log(data))
```
