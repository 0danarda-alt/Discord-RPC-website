let currentUserId = null;
let currentUser = null;

// ====================== LOGIN ======================
async function login() {
    const token = document.getElementById('token').value.trim();
    if (!token) return alert('Lütfen token giriniz!');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (data.success) {
            currentUserId = data.user.id;
            currentUser = data.user;

            // Login ekranını gizle
            document.getElementById('loginSection').style.display = 'none';
            // Ana ekranı göster
            document.getElementById('mainSection').style.display = 'block';

            // Kullanıcı bilgisini göster
            document.getElementById('userInfo').innerHTML = `
                <img src="${data.user.avatar}" width="85" style="border-radius:50%; border: 4px solid #5865f2;">
                <h2>${data.user.tag}</h2>
                <p style="color:#b9bbbe; margin: 5px 0;">ID: ${data.user.id}</p>
            `;

            alert(`✅ Hoş geldin, ${data.user.username}!`);
        } else {
            alert('❌ Hata: ' + (data.error || 'Bilinmeyen hata'));
        }
    } catch (err) {
        alert('Bağlantı hatası! Sunucunun çalıştığından emin olun.');
    }
}

// ====================== SES KANALINA GİR ======================
async function joinVoice() {
    const channelId = document.getElementById('channelId').value.trim();
    if (!channelId) return alert('Ses Kanal ID giriniz!');

    try {
        const res = await fetch('/api/voice/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUserId,
                channelId: channelId,
                selfMute: true,
                selfDeaf: true
            })
        });

        const data = await res.json();
        alert(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
    } catch (err) {
        alert('Bağlantı hatası oluştu!');
    }
}

// ====================== SES KANALINDAN ÇIK ======================
async function leaveVoice() {
    try {
        const res = await fetch('/api/voice/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });

        const data = await res.json();
        alert(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
    } catch (err) {
        alert('Çıkış yapılırken hata oluştu!');
    }
}

// ====================== RPC UYGULA ======================
async function applyRPC() {
    const rpcData = {
        name: document.getElementById('name').value || "KaiSearch RPC",
        type: document.getElementById('type').value,
        details: document.getElementById('details').value,
        state: document.getElementById('state').value,
        largeImage: document.getElementById('largeImage').value.trim(),
        largeText: document.getElementById('largeText').value.trim(),
        useTimestamp: document.getElementById('useTimestamp').checked,
        customTime: parseInt(document.getElementById('customTime').value) || 0,
        status: document.getElementById('status').value
    };

    try {
        const res = await fetch('/api/rpc/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, rpcData })
        });

        const data = await res.json();
        alert(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
    } catch (err) {
        alert('RPC uygulanırken hata oluştu!');
    }
}

// ====================== RPC TEMİZLE ======================
async function clearRPC() {
    try {
        const res = await fetch('/api/rpc/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });

        const data = await res.json();
        alert(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
    } catch (err) {
        alert('RPC temizlenirken hata oluştu!');
    }
}

// ====================== LOGOUT ======================
async function logout() {
    if (confirm('Çıkış yapmak istediğinden emin misin?')) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });
        } catch (e) {}
        location.reload();
    }
}
