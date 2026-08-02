const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { loadEnvConfig } = require("@next/env");
const { Server } = require("socket.io");
const { startBackgroundScanner } = require("./src/lib/backgroundScanner");
const { startMomentumScanner } = require("./src/lib/momentumBot");

// Load Next.js environment variables (like .env.local)
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url || "", true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(server, {
        cors: {
            origin: "*",
        },
    });

    // Start background options scanner
    startBackgroundScanner(io);
    startMomentumScanner(io);

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

    server.listen(3001, (err) => {
        if (err) throw err;
        console.log("> Ready on http://localhost:3001");
    });
});
