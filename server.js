const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

const PORT = process.env.PORT || 3000;

// Menyediakan file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Manajemen state room sederhana
const rooms = {};

io.on('connection', (socket) => {
    console.log(`[Connected] User unik terhubung: ${socket.id}`);

    // Handler saat user meminta bergabung ke room
    socket.on('join-room', ({ roomCode, username }) => {
        socket.join(roomCode);
        socket.username = username;
        socket.roomCode = roomCode;

        if (!rooms[roomCode]) {
            rooms[roomCode] = [];
        }
        
        // Simpan data user ke dalam memori room server
        rooms[roomCode].push({ id: socket.id, username });

        console.log(`[Join] ${username} (${socket.id}) masuk ke room: ${roomCode}`);

        // Ambil daftar user lain yang SUDAH ADA di room tersebut sebelum user ini masuk
        const otherUsers = rooms[roomCode].filter(user => user.id !== socket.id);
        
        // Kirim daftar teman yang sudah ada ke user yang baru bergabung
        socket.emit('all-users', otherUsers);

        // Informasikan ke user lama bahwa ada anggota baru masuk
        socket.to(roomCode).emit('user-joined', {
            id: socket.id,
            username: username
        });
    });

    // Meneruskan penawaran koneksi WebRTC (Offer)
    socket.on('sending-signal', (payload) => {
        io.to(payload.userToSignal).emit('user-joined-signal', {
            signal: payload.signal,
            callerId: payload.callerId,
            username: socket.username
        });
    });

    // Meneruskan balasan koneksi WebRTC (Answer)
    socket.on('returning-signal', (payload) => {
        io.to(payload.callerId).emit('receiving-returned-signal', {
            signal: payload.signal,
            id: socket.id
        });
    });

    // Handler saat user mematikan kamera/panggilan terputus
    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if (rooms[roomCode]) {
            // Hapus user dari list room server
            rooms[roomCode] = rooms[roomCode].filter(user => user.id !== socket.id);
            if (rooms[roomCode].length === 0) {
                delete rooms[roomCode];
            }
        }
        // Beritahu semua orang di room bahwa user ini telah keluar
        socket.to(roomCode).emit('user-left', socket.id);
        console.log(`[Disconnected] User keluar: ${socket.id}`);
    });
});

http.listen(PORT, () => {
    console.log(`🚀 Camcum Server berjalan 100% aktif di http://localhost:${PORT}`);
});