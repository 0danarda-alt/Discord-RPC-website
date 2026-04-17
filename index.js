const express = require('express');
const { Client } = require('discord.js-selfbot-v13');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const activeClients = new Map();

// ====================== ANA SAYFA ======================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====================== LOGIN ======================
app.post('/api/login', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token gerekli!' });

    try {
        const client = new Client({
            checkUpdate: false,
            readyStatus: false,
            patchVoice: true   // Ses için önemli
        });

        client.on('error', (error) => console.error('Client error:', error.message));

        await client.login(token);

        const userId = client.user.id;
        activeClients.set(userId, client);

        console.log(`✅ Giriş başarılı: ${client.user.tag} (${userId})`);

        res.json({
            success: true,
            user: {
                id: userId,
                username: client.user.username,
                tag: client.user.tag,
                avatar: client.user.displayAvatarURL()
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(401).json({ error: 'Geçersiz token!', details: error.message });
    }
});

// ====================== SES KANALINA GİR (Düzeltilmiş) ======================
app.post('/api/voice/join', async (req, res) => {
    const { userId, channelId, selfMute = true, selfDeaf = false } = req.body;

    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });
    if (!channelId) return res.status(400).json({ error: 'channelId gerekli!' });

    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel || channel.type !== 2) {
            return res.status(404).json({ error: 'Geçerli bir ses kanalı bulunamadı! (Sadece ses kanalı IDsi girin)' });
        }

        // Daha stabil join yöntemi
        await channel.join({
            selfMute: !!selfMute,
            selfDeaf: !!selfDeaf
        });

        console.log(`🔊 Ses kanalına girildi → ${channel.name} (${channelId}) | ${client.user.tag}`);

        res.json({
            success: true,
            message: `Ses kanalına girildi: ${channel.name}`,
            channel: { id: channel.id, name: channel.name }
        });
    } catch (error) {
        console.error('Voice join error:', error.message);
        res.status(500).json({ error: 'Ses kanalına girilemedi! Kanal ID doğru mu? Bot ses kanalında mı?', details: error.message });
    }
});

// ====================== SES KANALINDAN ÇIK ======================
app.post('/api/voice/leave', async (req, res) => {
    const { userId } = req.body;
    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });

    try {
        client.voice?.connections?.forEach(conn => conn.disconnect());
        console.log(`🔇 Ses kanalından çıkıldı: ${client.user.tag}`);
        res.json({ success: true, message: 'Ses kanalından çıkıldı!' });
    } catch (error) {
        res.status(500).json({ error: 'Çıkış yapılırken hata oluştu!', details: error.message });
    }
});

// ====================== RPC UYGULA (Fotoğraf Düzeltilmiş) ======================
app.post('/api/rpc/apply', async (req, res) => {
    const { userId, rpcData } = req.body;
    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });

    try {
        // Eski RPC temizle
        const clearPayload = { op: 3, d: { status: 'online', since: 0, activities: [], afk: false } };
        if (client.ws?.shards?.size > 0) {
            const shard = client.ws.shards.first();
            if (shard?.connection?.readyState === 1) shard.send(clearPayload);
        }

        await new Promise(r => setTimeout(r, 2500));

        const activityTypes = { 'PLAYING': 0, 'STREAMING': 1, 'LISTENING': 2, 'WATCHING': 3, 'COMPETING': 5 };

        const activity = {
            name: rpcData.name || "KaiSearch RPC",
            type: activityTypes[rpcData.type] || 0,
            application_id: rpcData.applicationId || "0",   // Buraya kendi app ID'nizi yazabilirsiniz
            created_at: Date.now()
        };

        if (rpcData.details) activity.details = rpcData.details;
        if (rpcData.state) activity.state = rpcData.state;

        // ====================== BÜYÜK FOTOĞRAF ======================
        if (rpcData.largeImage && rpcData.largeImage.trim() !== '') {
            activity.assets = {};
            activity.assets.large_image = rpcData.largeImage.trim();   // Asset adı (ör: myphoto)
            if (rpcData.largeText) activity.assets.large_text = rpcData.largeText.trim();
        }

        // Timestamp
        if (rpcData.customTime && rpcData.customTime > 0) {
            const startTime = Date.now() - (rpcData.customTime * 3600000);
            activity.timestamps = { start: startTime };
        } else if (rpcData.useTimestamp) {
            activity.timestamps = { start: Date.now() };
        }

        const customStatus = { name: 'Custom Status', type: 4, state: rpcData.name || "RPC Tool", emoji: null };

        const presencePayload = {
            op: 3,
            d: {
                status: rpcData.status || 'online',
                since: 0,
                activities: [customStatus, activity],
                afk: false
            }
        };

        if (client.ws?.shards?.size > 0) {
            const shard = client.ws.shards.first();
            if (shard?.connection?.readyState === 1) {
                shard.send(presencePayload);
            }
        }

        res.json({ success: true, message: 'RPC uygulandı! (Fotoğraf için asset adı kullandığından emin ol)' });
    } catch (error) {
        console.error('RPC Hatası:', error);
        res.status(500).json({ error: 'RPC uygulanamadı!', details: error.message });
    }
});

// ====================== RPC TEMİZLE ======================
app.post('/api/rpc/clear', async (req, res) => {
    const { userId } = req.body;
    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });

    try {
        const clearPayload = { op: 3, d: { status: 'online', since: 0, activities: [], afk: false } };
        if (client.ws?.shards?.size > 0) {
            const shard = client.ws.shards.first();
            if (shard?.connection?.readyState === 1) {
                for (let i = 0; i < 5; i++) {
                    shard.send(clearPayload);
                    await new Promise(r => setTimeout(r, 700));
                }
            }
        }
        res.json({ success: true, message: 'RPC temizlendi!' });
    } catch (error) {
        res.status(500).json({ error: 'RPC temizlenemedi!', details: error.message });
    }
});

// ====================== LOGOUT ======================
app.post('/api/logout', async (req, res) => {
    const { userId } = req.body;
    const client = activeClients.get(userId);
    if (client) {
        await client.destroy();
        activeClients.delete(userId);
    }
    res.json({ success: true, message: 'Çıkış yapıldı!' });
});

app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     ✅ RPC + SES + FOTOĞRAF DÜZELTİLDİ     ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`🌐 http://localhost:${PORT}`);
});
