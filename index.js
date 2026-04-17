const express = require('express');
const { Client } = require('discord.js-selfbot-v13');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const activeClients = new Map();

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
            patchVoice: false
        });

        client.on('error', (error) => console.error('Client error:', error.message));

        await client.login(token);

        const userId = client.user.id;
        activeClients.set(userId, client);

        console.log(`✅ Giriş: ${client.user.tag} (${userId})`);

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

// ====================== SES KANALINA GİR ======================
app.post('/api/voice/join', async (req, res) => {
    const { userId, channelId, selfMute = true, selfDeaf = true } = req.body;

    const client = activeClients.get(userId);
    if (!client) {
        return res.status(401).json({ error: 'Önce giriş yapmalısın!' });
    }

    if (!channelId) {
        return res.status(400).json({ error: 'channelId gerekli!' });
    }

    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel || channel.type !== 2) { // 2 = GuildVoice
            return res.status(404).json({ error: 'Geçerli bir ses kanalı bulunamadı!' });
        }

        // Selfbot'ta voice join
        const connection = await client.voice.joinChannel(channel, {
            selfMute: !!selfMute,
            selfDeaf: !!selfDeaf,
            selfVideo: false
        });

        console.log(`🔊 Ses kanalına girildi: ${channel.name} (${channelId}) - User: ${client.user.tag}`);

        res.json({
            success: true,
            message: `Ses kanalına girildi: ${channel.name}`,
            channel: { id: channel.id, name: channel.name }
        });
    } catch (error) {
        console.error('Voice join error:', error);
        res.status(500).json({ error: 'Ses kanalına girilemedi!', details: error.message });
    }
});

// ====================== SES KANALINDAN ÇIK ======================
app.post('/api/voice/leave', async (req, res) => {
    const { userId } = req.body;

    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });

    try {
        if (client.voice && client.voice.connections) {
            for (const [guildId, connection] of client.voice.connections) {
                connection.disconnect();
            }
        }
        console.log(`🔇 Ses bağlantısı kesildi: ${client.user.tag}`);
        res.json({ success: true, message: 'Ses kanalından çıkıldı!' });
    } catch (error) {
        console.error('Voice leave error:', error);
        res.status(500).json({ error: 'Ses kanalından çıkılamadı!', details: error.message });
    }
});

// ====================== RPC UYGULA (Fotoğraf + Timestamp iyileştirildi) ======================
app.post('/api/rpc/apply', async (req, res) => {
    const { userId, rpcData } = req.body;
    const client = activeClients.get(userId);

    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });

    try {
        // Eski RPC'yi temizle
        const clearPayload = { op: 3, d: { status: 'online', since: 0, activities: [], afk: false } };

        if (client.ws?.shards?.size > 0) {
            const shard = client.ws.shards.first();
            if (shard?.connection?.readyState === 1) shard.send(clearPayload);
        }

        await new Promise(r => setTimeout(r, 3000)); // 3 saniye bekle (daha stabil)

        const activityTypes = {
            'PLAYING': 0, 'STREAMING': 1, 'LISTENING': 2,
            'WATCHING': 3, 'COMPETING': 5
        };

        const activity = {
            name: rpcData.name,
            type: activityTypes[rpcData.type] || 0,
            application_id: rpcData.applicationId || '0', // İstersen kendi app ID'ni verebilirsin
            created_at: Date.now()
        };

        if (rpcData.details) activity.details = rpcData.details;
        if (rpcData.state) activity.state = rpcData.state;

        // === YENİ: BÜYÜK FOTOĞRAF (large_image) ===
        if (rpcData.largeImage) {
            activity.assets = activity.assets || {};
            activity.assets.large_image = rpcData.largeImage;   // Örnek: "mp:external/..." veya uygulama asset adı
            if (rpcData.largeText) activity.assets.large_text = rpcData.largeText;
        }

        // Timestamp
        if (rpcData.customTime) {
            const maxHours = Math.min(rpcData.customTime, 87600);
            const startTime = Date.now() - (maxHours * 3600000);
            if (startTime > 0) activity.timestamps = { start: startTime };
        } else if (rpcData.useTimestamp) {
            activity.timestamps = { start: Date.now() };
        }

        // Custom Status + Activity
        const customStatus = {
            name: 'Custom Status',
            type: 4,
            state: rpcData.name,
            emoji: null
        };

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

        res.json({ success: true, message: 'RPC + fotoğraf uygulandı!' });
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
                    await new Promise(r => setTimeout(r, 800));
                }
            }
        }
        res.json({ success: true, message: 'RPC temizlendi!' });
    } catch (error) {
        res.status(500).json({ error: 'Temizlenemedi!', details: error.message });
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
    console.log('╔════════════════════════════════════╗');
    console.log('║ ✅ RPC TOOL + SES + FOTOĞRAF AKTİF ║');
    console.log('╚════════════════════════════════════╝');
    console.log(`🌐 http://localhost:${PORT}`);
});
