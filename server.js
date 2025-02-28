const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("ws");
const WebSocket = require("ws");

const app = express();
app.use(cors());
app.use(cors({ origin: "http://192.168.29.142:3000", credentials: true }));

const server = http.createServer(app);
const wss = new WebSocket.Server({
    server,
    maxPayload: 64 * 1024 * 1024 // 64MB max file size
});

// Store clients with their IDs
const clients = new Map();

wss.on("connection", (ws) => {
    // Generate a unique ID for the client
    const clientId = Math.random().toString(36).substr(2, 9);
    clients.set(ws, clientId);

    // Send the client their ID
    ws.send(JSON.stringify({
        type: "userId",
        userId: clientId
    }));

    console.log(`Client connected with ID: ${clientId}`);

    ws.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());
            console.log("Received message type:", parsedMessage.type);

            switch (parsedMessage.type) {
                case "chat":
                    // Add the actual sender ID to the message
                    const messageWithSender = {
                        ...parsedMessage,
                        sender: clients.get(ws)
                    };

                    // Broadcast the message to all clients except the sender
                    wss.clients.forEach((client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(messageWithSender));
                        }
                    });
                    break;

                case "file":
                    // Add sender information to the file message
                    const fileWithSender = {
                        ...parsedMessage,
                        sender: clients.get(ws)
                    };

                    // Broadcast the file to all clients except the sender
                    wss.clients.forEach((client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(fileWithSender));
                        }
                    });
                    break;

                case "call-offer":
                    // Add caller information to the offer
                    const callOffer = {
                        ...parsedMessage,
                        caller: clients.get(ws)
                    };

                    // Send to specific target or broadcast if target is "other"
                    wss.clients.forEach((client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(callOffer));
                        }
                    });
                    break;

                case "call-answer":
                case "call-rejected":
                case "ice-candidate":
                    // Forward these messages to the specific target
                    wss.clients.forEach((client) => {
                        if (clients.get(client) === parsedMessage.target && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(parsedMessage));
                        }
                    });
                    break;
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    ws.on("close", () => {
        console.log(`Client ${clients.get(ws)} disconnected`);
        clients.delete(ws);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
