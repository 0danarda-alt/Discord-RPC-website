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
            patchVoice: true
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

// ====================== SES KANALINA GİR (Multi-bot tarzı stabil versiyon) ======================
app.post('/api/voice/join', async (req, res) => {
    const { userId, channelId, selfMute = true, selfDeaf = true } = req.body;

    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });
    if (!channelId) return res.status(400).json({ error: 'channelId gerekli!' });

    try {
        const guild = await client.guilds.fetch(req.body.guildId || client.guilds.cache.first()?.id).catch(() => null);
        const channel = client.channels.cache.get(channelId);

        if (!channel || channel.type !== 2) {
            return res.status(404).json({ error: 'Geçerli bir ses kanalı bulunamadı!' });
        }

        // Stabil ses kanalına girme
        await channel.join({
            selfMute: !!selfMute,
            selfDeaf: !!selfDeaf
        });

        console.log(`🔊 [${client.user.tag}] Ses kanalına girdi → ${channel.name}`);

        // Ses bağlantısı kesilirse otomatik geri dön (voiceStateUpdate)
        client.on('voiceStateUpdate', (oldState, newState) => {
            if (newState.member.id === client.user.id && newState.channelId !== channelId) {
                console.log(`[${client.user.tag}] Ses bağlantısı kesildi, geri dönülüyor...`);
                setTimeout(() => {
                    channel.join({ selfMute: !!selfMute, selfDeaf: !!selfDeaf }).catch(() => {});
                }, 3000);
            }
        });

        res.json({
            success: true,
            message: `Ses kanalına girildi: ${channel.name}`
        });
    } catch (error) {
        console.error('Voice join error:', error.message);
        res.status(500).json({ 
            error: 'Ses kanalına girilemedi!', 
            details: error.message 
        });
    }
});

// ====================== SES KANALINDAN ÇIK ======================
app.post('/api/voice/leave', async (req, res) => {
    const { userId } = req.body;
    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });

    try {
        if (client.voice && client.voice.connections) {
            client.voice.connections.forEach((connection) => {
                connection.disconnect();
            });
        }
        console.log(`🔇 [${client.user.tag}] Ses kanalından çıkıldı.`);
        res.json({ success: true, message: 'Ses kanalından çıkıldı!' });
    } catch (error) {
        res.status(500).json({ error: 'Ses kanalından çıkılamadı!', details: error.message });
    }
});

// ====================== RPC UYGULA ======================
app.post('/api/rpc/apply', async (req, res) => {
    const { userId, rpcData } = req.body;
    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });

    try {
        const clearPayload = { op: 3, d: { status: 'online', since: 0, activities: [], afk: false } };
        if (client.ws?.shards?.size > 0) {
            const shard = client.ws.shards.first();
            if (shard?.connection?.readyState === 1) shard.send(clearPayload);
        }

        await new Promise(r => setTimeout(r, 2500));

        const activityTypes = {
            'PLAYING': 0, 'STREAMING': 1, 'LISTENING': 2,
            'WATCHING': 3, 'COMPETING': 5
        };

        const activity = {
            name: rpcData.name || "KaiSearch RPC",
            type: activityTypes[rpcData.type] || 0,
            application_id: rpcData.applicationId || "0",
            created_at: Date.now()
        };

        if (rpcData.details) activity.details = rpcData.details;
        if (rpcData.state) activity.state = rpcData.state;

        if (rpcData.largeImage) {
            activity.assets = {
                large_image: rpcData.largeImage.trim(),
                large_text: rpcData.largeText || undefined
            };
        }

        if (rpcData.customTime && rpcData.customTime > 0) {
            activity.timestamps = { start: Date.now() - (rpcData.customTime * 3600000) };
        } else if (rpcData.useTimestamp) {
            activity.timestamps = { start: Date.now() };
        }

        const customStatus = {
            name: 'Custom Status',
            type: 4,
            state: rpcData.name || "RPC Tool",
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
            if (shard?.connection?.readyState === 1) shard.send(presencePayload);
        }

        res.json({ success: true, message: 'RPC uygulandı!' });
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
    console.log('║     ✅ RPC TOOL + STABİL SES AKTİF         ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`🌐 http://localhost:${PORT}`);
});
