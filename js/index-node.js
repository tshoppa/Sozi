
import http from "http";
import path from "path";
import {pathToFileURL} from "url";
import {execFile} from "child_process";

const PORT = 3000;
const INDEX_PATH = path.normalize(path.join(__dirname, "..", "index.html"));
const INDEX_URL = pathToFileURL(INDEX_PATH);
const BROWSER_CMD = "firefox";

function handleRequest(req, res) {
    console.log(`Request: ${req.url}`);

    /* Requests
     *
     * List directory.
     * Get local file (SVG, JSON).
     * Create/Update local file (JSON, HTML).
     * Poll file change status.
     */
}

http.createServer(handleRequest).listen(PORT, () => {
    execFile(BROWSER_CMD, ["--new-window", INDEX_URL]);
});
