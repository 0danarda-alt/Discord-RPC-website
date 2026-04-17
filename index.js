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

// ====================== SES KANALINA GİR (En Stabil Versiyon) ======================
app.post('/api/voice/join', async (req, res) => {
    const { userId, channelId, guildId = "1410199090146312276", selfMute = true, selfDeaf = true } = req.body;

    const client = activeClients.get(userId);
    if (!client) return res.status(401).json({ error: 'Önce giriş yapmalısın!' });
    if (!channelId) return res.status(400).json({ error: 'channelId gerekli!' });

    try {
        console.log(`[${client.user.tag}] Ses kanalına bağlanılıyor... ChannelID: ${channelId} | GuildID: ${guildId}`);

        // 1. Guild fetch et (zorunlu)
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            return res.status(404).json({ error: 'Sunucu bulunamadı! Hesap sunucuda mı?' });
        }

        // 2. Kanalı fetch et
        let channel = await client.channels.fetch(channelId).catch(() => null);

        if (!channel) {
            channel = guild.channels.cache.get(channelId);
        }

        if (!channel || channel.type !== 2) {
            return res.status(404).json({ 
                error: 'Ses kanalı bulunamadı!',
                details: `Kanal ID: ${channelId} | Tip: ${channel ? channel.type : 'null'}`
            });
        }

        // 3. Ses kanalına gir
        await client.voice.joinChannel(channel, {
            selfMute: !!selfMute,
            selfDeaf: !!selfDeaf
        });

        console.log(`✅ [${client.user.tag}] Ses kanalına GİRİLDİ → ${channel.name}`);

        res.json({
            success: true,
            message: `Ses kanalına girildi: ${channel.name}`
        });

    } catch (error) {
        console.error(`Voice join error [${client?.user?.tag}]:`, error.message);
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
        if (client.voice?.connections) {
            client.voice.connections.forEach(conn => conn.disconnect());
        }
        res.json({ success: true, message: 'Ses kanalından çıkıldı!' });
    } catch (error) {
        res.status(500).json({ error: 'Çıkış hatası!', details: error.message });
    }
});

// RPC ve diğer endpoint'ler (önceki kodlardan aynı kalıyor, kısalttım)
app.post('/api/rpc/apply', async (req, res) => { /* ... önceki RPC kodu ... */ res.json({ success: true, message: 'RPC uygulandı!' }); });
app.post('/api/rpc/clear', async (req, res) => { /* ... önceki temizleme kodu ... */ res.json({ success: true, message: 'RPC temizlendi!' }); });
app.post('/api/logout', async (req, res) => { /* ... logout ... */ res.json({ success: true, message: 'Çıkış yapıldı!' }); });

app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     RPC TOOL + SES (Son Deneme) AKTİF      ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`🌐 http://localhost:${PORT}`);
});
