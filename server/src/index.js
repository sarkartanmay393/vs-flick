const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*", // Allow all for MVP local usage
        methods: ["GET", "POST"]
    }
});

// Store rooms/sessions
// key: pairingCode, value: { created: number, extensionId: string, pwaId: string | null }
const sessions = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Extension creates a session
    socket.on('create_session', (callback) => {
        // Generate unique 4-digit code
        let code;
        do {
            code = Math.floor(1000 + Math.random() * 9000).toString();
        } while (sessions.has(code));

        sessions.set(code, {
            created: Date.now(),
            extensionId: socket.id,
            pwaId: null
        });

        socket.join(code);
        console.log(`Session created: ${code} by ${socket.id}`);

        // Ack with code
        if (typeof callback === 'function') callback({ code });
    });

    // PWA joins a session
    socket.on('join_session', ({ code }, callback) => {
        const session = sessions.get(code);

        if (!session) {
            if (typeof callback === 'function') callback({ error: 'Invalid or expired code' });
            return;
        }

        if (session.pwaId) {
            // Already paired? Maybe allow override or reject. 
            // For MVP, allow override (reconnect scenario).
            console.log(`Session ${code} rejoined by PWA`);
        }

        session.pwaId = socket.id;
        socket.join(code);

        // Notify extension
        socket.to(code).emit('pwa_connected', { pwaId: socket.id });

        console.log(`PWA ${socket.id} joined session ${code}`);
        if (typeof callback === 'function') callback({ success: true });
    });

    // Relay Command: PWA -> Extension
    socket.on('command', (data) => {
        const { code, action } = data;
        const session = sessions.get(code);

        if (session && session.extensionId) {
            io.to(session.extensionId).emit('command', { action });
            console.log(`Command ${action} relayed in ${code}`);
        }
    });

    // Relay Status: Extension -> PWA
    socket.on('status', (data) => {
        const { code, state } = data;
        // Broadcast to room (allows PWA to receive it)
        socket.to(code).emit('status', state);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        for (const [code, session] of sessions.entries()) {
            if (session.extensionId === socket.id) {
                console.log(`Extension disconnected, closing session ${code}`);
                sessions.delete(code);
                io.to(code).emit('session_closed'); // Notify PWA
            } else if (session.pwaId === socket.id) {
                console.log(`PWA disconnected from session ${code}`);
                session.pwaId = null;
                io.to(session.extensionId).emit('pwa_disconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Relay Server running on port ${PORT}`);
});
