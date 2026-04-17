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

            // Login ekranını gizle, ana ekranı göster
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('mainSection').style.display = 'block';

            // Kullanıcı bilgisini göster
            document.getElementById('userInfo').innerHTML = `
                <img src="${data.user.avatar}" width="80" style="border-radius:50%; border: 3px solid #5865f2;">
                <h2>${data.user.tag}</h2>
                <p style="color:#b9bbbe;">ID: ${data.user.id}</p>
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

    const res = await fetch('/api/voice/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUserId,
            channelId: channelId,
            selfMute: true,
            selfDeaf: false
        })
    });

    const data = await res.json();
    alert(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
}

// ====================== SES KANALINDAN ÇIK ======================
async function leaveVoice() {
    const res = await fetch('/api/voice/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
    });

    const data = await res.json();
    alert(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
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

    const res = await fetch('/api/rpc/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, rpcData })
    });

    const data = await res.json();
    alert(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
}

// ====================== RPC TEMİZLE ======================
async function clearRPC() {
    const res = await fetch('/api/rpc/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
    });

    const data = await res.json();
    alert(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
}

// ====================== LOGOUT ======================
async function logout() {
    if (confirm('Çıkış yapmak istediğinden emin misin?')) {
        await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        location.reload();
    }
}
