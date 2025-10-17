const http = require("http");
const url = require("url");

const BASE_URL = "";
const PORT = 3000;

let totalRequests = 0;
let words = [
    { word: "apple", definition: "A fruit that grows on trees." },
    { word: "banana", definition: "A long yellow fruit." },
    { word: "cat", definition: "A small domesticated carnivorous mammal." },
];

function sendJSON(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

function setCORS(res, origin = "*") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isValidWord(word) {
    return typeof word === "string" && word.match(/^[A-Za-z]+$/) !== null;
}


function isValidDefinition(def) {
    return typeof def === "string" && def.trim().length > 0;
}

const server = http.createServer((req, res) => {
    setCORS(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedURL = url.parse(req.url, true);
    const path = parsedURL.pathname;
    const method = req.method;

    totalRequests++;

    if (path === `${BASE_URL}/api/definitions/` && method === "GET") {
        const query = parsedURL.query;

        if (!query.word) {
            return sendJSON(res, 200, {
                message: `Request #${totalRequests}: All entries retrieved!`,
                data: words,
                totalEntries: words.length,
            });
        }

        const word = words.find(
            (w) => w.word.toLowerCase() === query.word.toLowerCase(),
        );

        if (word) {
            return sendJSON(res, 200, {
                message: `Request #${totalRequests}: Entry retrieved!`,
                data: word,
                totalEntries: words.length,
            });
        } else {
            return sendJSON(res, 404, { error: "Word not found!" });
        }
    }

    if (path === `${BASE_URL}/api/definitions/` && method === "POST") {
        let body = "";

        req.on("data", (chunk) => (body += chunk));

        req.on("end", () => {
            try {
                const newWord = JSON.parse(body);

                if (!newWord.word || !newWord.definition) {
                    return sendJSON(res, 400, {
                        error: "Both 'word' and 'definition' are required",
                    });
                }

                if (!isValidWord(newWord.word)) {
                    return sendJSON(res, 400, {
                        error: "'word' must be a non-empty string with letters only",
                    });
                }

                if (!isValidDefinition(newWord.definition)) {
                    return sendJSON(res, 400, {
                        error: "'definition' must be a non-empty string",
                    });
                }

                const exists = words.some(
                    (w) => w.word.toLowerCase() === newWord.word.toLowerCase(),
                );

                if (exists) {
                    return sendJSON(res, 409, {
                        error: `${newWord.word} already exists`,
                    });
                }

                words.push(newWord);
                return sendJSON(res, 201, {
                    message: `Request #${totalRequests}: New entry recorded!`,
                    data: newWord,
                    totalEntries: words.length,
                });
            } catch (err) {
                return sendJSON(res, 400, { error: "Invalid JSON format" });
            }
        });

        return;
    }

    return sendJSON(res, 404, { error: "Route not found." });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
