const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(PUBLIC_DIR, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, "utf8");

  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const generateTrip = require("../api/generate-trip");
const geoapify = require("../api/geoapify");
const pexels = require("../api/pexels");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request prea mare."));
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Body-ul requestului trebuie sa fie JSON valid."));
      }
    });

    request.on("error", reject);
  });
}

function createVercelResponse(response) {
  return {
    setHeader: (name, value) => response.setHeader(name, value),
    status: (statusCode) => ({
      json: (payload) => {
        response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(payload));
      }
    })
  };
}

async function handleApi(request, response) {
  try {
    request.body = await readBody(request);
    await generateTrip(request, createVercelResponse(response));
  } catch (error) {
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error.message }));
  }
}

async function handleGeoapify(request, response) {
  try {
    await geoapify(request, createVercelResponse(response));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error.message }));
  }
}

async function handlePexels(request, response) {
  try {
    await pexels(request, createVercelResponse(response));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error.message }));
  }
}

function sendStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/generate-trip")) {
    handleApi(request, response);
    return;
  }

  if (request.url.startsWith("/api/geoapify")) {
    handleGeoapify(request, response);
    return;
  }

  if (request.url.startsWith("/api/pexels")) {
    handlePexels(request, response);
    return;
  }

  sendStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`AI Travel Planner ruleaza la http://localhost:${PORT}`);
});
