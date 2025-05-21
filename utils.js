async function askTextName(text) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8"
        },
        body: JSON.stringify({
            "system_instruction": {
                "parts": [
                    {
                        "text": "You are given some text. You task is to output an appropriate heading name representing the text. The topic name can be of 3-4 words."
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
    const answer = await response.json()
    return answer.candidates[0].content.parts[0].text
}
/**
 * @param {string[]} topics 
 * */
async function askTopicsName(topics) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8"
        },
        body: JSON.stringify({
            "system_instruction": {
                "parts": [
                    {
                        "text": "You are given some topics. You task is to output an appropriate super topics name, representing them propperly. The topic name can be of 3-4 words."
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
    const answer = await response.json()
    return answer.candidates[0].content.parts[0].text
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
export async function namifyTree(parent, key, tree) {
    if (typeof tree === 'string') {
        delete parent[key]
        parent[await askTextName(tree)] = tree
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
            parent[await askTopicsName(Object.keys(tree))] = tree
        }
        return
    }
    const value = tree[child_keys[0]]
    parent[key] = value
    await namifyTree(parent, key, value)
    return
}
