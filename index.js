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

// Login
app.post('/api/login', async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'Token gerekli!' });
    }
    
    try {
        const client = new Client({
            checkUpdate: false,
            readyStatus: false,
            patchVoice: false
        });
        
        client.on('error', (error) => {
            console.error('Client error:', error.message);
        });
        
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

// RPC uygula - WebSocket direkt kullan
app.post('/api/rpc/apply', async (req, res) => {
    const { userId, rpcData } = req.body;
    
    const client = activeClients.get(userId);
    if (!client) {
        return res.status(401).json({ error: 'Önce giriş yapmalısın!' });
    }
    
    try {
        console.log('📝 RPC Data:', rpcData);
        
        // Önce mevcut RPC'yi temizle
        const clearPayload = {
            op: 3,
            d: {
                status: 'online',
                since: 0,
                activities: [],
                afk: false
            }
        };
        
        if (client.ws && client.ws.shards && client.ws.shards.size > 0) {
            const shard = client.ws.shards.first();
            if (shard && shard.connection && shard.connection.readyState === 1) {
                shard.send(clearPayload);
                console.log('🧹 Eski RPC temizlendi');
            }
        }
        
        // 5 saniye bekle
        console.log('⏳ 5 saniye bekleniyor...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Activity type mapping
        const activityTypes = {
            'PLAYING': 0,
            'STREAMING': 1,
            'LISTENING': 2,
            'WATCHING': 3,
            'COMPETING': 5
        };
        
        // Activity objesi
        const activity = {
            name: rpcData.name,
            type: activityTypes[rpcData.type] || 0,
            application_id: '0',
            created_at: Date.now()
        };
        
        if (rpcData.details) activity.details = rpcData.details;
        if (rpcData.state) activity.state = rpcData.state;
        
        // Timestamp - Maksimum 10 yıl ile sınırla
        if (rpcData.customTime) {
            const now = Date.now();
            const maxHours = Math.min(rpcData.customTime, 87600); // Max 10 yıl
            const hoursInMs = maxHours * 60 * 60 * 1000;
            const startTime = now - hoursInMs;
            
            // Timestamp pozitif olmalı
            if (startTime > 0) {
                activity.timestamps = { start: startTime };
                console.log(`⏰ Özel zaman: ${maxHours} saat (${Math.floor(maxHours/24)} gün)`);
            } else {
                console.log('⚠️ Süre çok büyük, şu anki zaman kullanılıyor');
                activity.timestamps = { start: Date.now() };
            }
        } else if (rpcData.useTimestamp) {
            activity.timestamps = { start: Date.now() };
        }
        
        // Custom Status da ekle (görünürlük için)
        const customStatus = {
            name: 'Custom Status',
            type: 4,
            state: rpcData.name,
            emoji: null
        };
        
        // Yeni presence payload
        const presencePayload = {
            op: 3,
            d: {
                status: rpcData.status || 'online',
                since: 0,
                activities: [customStatus, activity],
                afk: false
            }
        };
        
        console.log('📤 Yeni Presence:', JSON.stringify(presencePayload, null, 2));
        
        // WebSocket'e direkt gönder
        if (client.ws && client.ws.shards && client.ws.shards.size > 0) {
            const shard = client.ws.shards.first();
            if (shard && shard.connection && shard.connection.readyState === 1) {
                shard.send(presencePayload);
                console.log('✅ Yeni RPC uygulandı!');
            }
        }
        
        res.json({ success: true, message: 'RPC uygulandı!' });
    } catch (error) {
        console.error('❌ RPC Hatası:', error);
        res.status(500).json({ error: 'RPC uygulanamadı!', details: error.message });
    }
});

// RPC temizle
app.post('/api/rpc/clear', async (req, res) => {
    const { userId } = req.body;
    
    const client = activeClients.get(userId);
    if (!client) {
        return res.status(401).json({ error: 'Önce giriş yapmalısın!' });
    }
    
    try {
        // Tüm aktiviteleri temizle - Discord'un kabul ettiği format
        const clearPayload = {
            op: 3,
            d: {
                status: 'online',
                since: 0,
                activities: [],
                afk: false
            }
        };
        
        if (client.ws && client.ws.shards && client.ws.shards.size > 0) {
            const shard = client.ws.shards.first();
            if (shard && shard.connection && shard.connection.readyState === 1) {
                // Birden fazla kez gönder ve daha uzun bekle
                for (let i = 0; i < 5; i++) {
                    shard.send(clearPayload);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                console.log('✅ Tüm RPC\'ler temizlendi (5 kez gönderildi)!');
            }
        }
        
        res.json({ success: true, message: 'RPC temizlendi!' });
    } catch (error) {
        console.error('❌ Temizleme hatası:', error);
        res.status(500).json({ error: 'RPC temizlenemedi!', details: error.message });
    }
});

// Çıkış
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
    console.log('║   ✅ RPC TOOL BAŞLATILDI          ║');
    console.log('╚════════════════════════════════════╝');
    console.log(`🌐 Tarayıcıda aç: http://localhost:${PORT}`);
    console.log('════════════════════════════════════');
});
