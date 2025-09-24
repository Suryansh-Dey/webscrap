async function askTextName(text) {
    let retriesRemaining = 3;
    let answer
    while (retriesRemaining--) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json;charset=UTF-8"
            },
            body: JSON.stringify({
                "system_instruction": {
                    "parts": [
                        {
                            "text": "You are given contents of an webpage. Your task is to output an appropriate heading name of this page. The topic name can be of 3-4 words. Avoid too general names like Overview, Info etc. JUST OUTPUT THE TOPIC NAME ONLY."
                        }
                    ]
                },
                "contents": [
                    {
                        "parts": [
                            {
                                text
                            }
                        ]
                    }
                ]
            })
        })
        answer = await response.json()
        if (!answer.candidates) {
            if (answer.error.code == 503) {
                console.log("Gemini overloaded. retriesRemaining:", retriesRemaining)
            } else
                throw Error("Gemini Error:" + JSON.stringify(answer))
        }
        else break
    }

    return answer.candidates[0].content.parts[0].text.trim()
}
/**
 * @param {string[]} topics 
 * */
async function askTopicsName(topics) {
    let retriesRemaining = 3
    let answer
    while (retriesRemaining--) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json;charset=UTF-8"
            },
            body: JSON.stringify({
                "system_instruction": {
                    "parts": [
                        {
                            "text": `You are given some topics. You task is to output an appropriate super topics name, representing them propperly. The topic name can be of 3-4 words. JUST OUTPUT THE TOPIC NAME ONLY.
Example:
Input: Bitotsav, Pantheon, Deepotsav
Output: College fests`
                        }
                    ]
                },
                "contents": [
                    {
                        "parts": [
                            {
                                text: topics.join(', ')
                            }
                        ]
                    }
                ]
            })
        })
        answer = await response.json()
        if (!answer.candidates) {
            if (answer.error.code == 503) {
                console.log("Gemini overloaded. retriesRemaining:", retriesRemaining)
            } else
                throw Error("Gemini Error:" + JSON.stringify(answer))
        }
        else break
    }

    return answer.candidates[0].content.parts[0].text.trim()
}
/**
 * Yup, binary tree with JS crap
 *@param {Object.<string, string>} map 
 * */
export function intoTree(map) {
    const tree = {}
    for (const [link, text] of Object.entries(map)) {
        const parts = link.split('/');
        let last_part = tree
        const end = parts.pop()
        for (const part of parts) {
            if (!last_part.hasOwnProperty(part))
                last_part[part] = {}
            last_part = last_part[part]
        }
        last_part[end] = text
    }
    return tree
}
async function namifyTree(parent, key, tree) {
    if (typeof tree === 'string') {
        delete parent[key]
        const name = await askTextName(tree)
        parent[name] = (parent[name] || '') + tree
        console.log("Naming contents of", key, " to ", name)
        return
    }
    let child_keys = Object.keys(tree)
    if (!parent || child_keys.length > 1) {
        let tasks = []
        for (const [key, value] of Object.entries(tree)) {
            tasks.push(namifyTree(tree, key, value))
        }
        await Promise.all(tasks)
        if (parent) {
            delete parent[key]
            const name = await askTopicsName(Object.keys(tree))
            parent[name] = { ...parent[name], ...tree }
        }
        return
    }
    const value = tree[child_keys[0]]
    parent[key] = value
    await namifyTree(parent, key, value)
    return
}
export async function namify(pages) {
    const uniquePages = {}
    let i = 0;
    for (const [key, value] of Object.entries(pages)) {
        uniquePages[key + '/' + i++] = value
    }

    const pageTree = intoTree(uniquePages)
    await namifyTree(null, null, pageTree)
    return pageTree
}
