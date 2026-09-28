const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { loadEnvConfig } = require("@next/env");
const { Server } = require("socket.io");
const { startBackgroundScanner } = require("./src/lib/backgroundScanner");

// Load Next.js environment variables (like .env.local)
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const io = new Server({
        cors: {
            origin: "*",
        },
    });

    // Handler for incoming HTTP requests
    const requestHandler = (req, res) => {
        const parsedUrl = parse(req.url || "", true);
        handle(req, res, parsedUrl);
    };

    // Primary HTTP server on port 3000 (standard Next.js port)
    const server3000 = createServer(requestHandler);
    io.attach(server3000);

    // Alternate HTTP server on port 3001 (legacy/configured port)
    const server3001 = createServer(requestHandler);
    io.attach(server3001);

    // Start background options scanner
    startBackgroundScanner(io);

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        // Broadcast messages to all clients
        socket.on("send_message", (data) => {
            // data: { username, text, timestamp }
            io.emit("receive_message", data);
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    server3000.listen(3000, () => {
        console.log("> Ready on http://localhost:3000");
    }).on("error", (err) => {
        console.warn("> Port 3000 unavailable or in use:", err.message);
    });

    server3001.listen(3001, () => {
        console.log("> Ready on http://localhost:3001");
    }).on("error", (err) => {
        console.warn("> Port 3001 unavailable or in use:", err.message);
    });
});
