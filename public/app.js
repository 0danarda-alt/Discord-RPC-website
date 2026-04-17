let currentUser = null;

// Alert göster
function showAlert(message, type = 'success') {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `alert ${type} active`;
    
    setTimeout(() => {
        alert.classList.remove('active');
    }, 5000);
}

// Login
async function login() {
    const token = document.getElementById('tokenInput').value.trim();
    
    if (!token) {
        showAlert('Token boş olamaz!', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showUserInfo();
            document.querySelector('.login-section').classList.remove('active');
            document.querySelector('.rpc-section').classList.add('active');
            showAlert(`Hoş geldin, ${data.user.username}!`, 'success');
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        showAlert('Bağlantı hatası!', 'error');
    }
}

// Kullanıcı bilgilerini göster
function showUserInfo() {
    const userInfo = document.getElementById('userInfo');
    userInfo.innerHTML = `
        <img src="${currentUser.avatar}" alt="Avatar">
        <div class="info">
            <h3>${currentUser.username}</h3>
            <p>ID: ${currentUser.id}</p>
        </div>
    `;
}

// RPC uygula
async function applyRPC() {
    const name = document.getElementById('name').value.trim();
    
    if (!name) {
        showAlert('Aktivite ismi zorunlu!', 'error');
        return;
    }
    
    const customTimeValue = parseFloat(document.getElementById('customTime').value);
    const timeUnit = document.getElementById('timeUnit').value;
    
    let customTimeInHours = null;
    if (customTimeValue) {
        switch(timeUnit) {
            case 'seconds':
                customTimeInHours = customTimeValue / 3600;
                break;
            case 'minutes':
                customTimeInHours = customTimeValue / 60;
                break;
            case 'hours':
                customTimeInHours = customTimeValue;
                break;
            case 'days':
                customTimeInHours = customTimeValue * 24;
                break;
            case 'years':
                customTimeInHours = customTimeValue * 365 * 24;
                break;
        }
    }
    
    const rpcData = {
        status: document.getElementById('status').value,
        type: document.getElementById('type').value,
        name: name,
        details: document.getElementById('details').value.trim(),
        state: document.getElementById('state').value.trim(),
        customTime: customTimeInHours,
        useTimestamp: document.getElementById('useTimestamp').checked
    };
    
    try {
        const response = await fetch('/api/rpc/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, rpcData })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('✅ RPC başarıyla uygulandı!', 'success');
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        showAlert('Bağlantı hatası!', 'error');
    }
}

// RPC temizle
async function clearRPC() {
    if (!confirm('RPC\'yi temizlemek istediğinden emin misin?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/rpc/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Formu temizle
            document.getElementById('name').value = '';
            document.getElementById('details').value = '';
            document.getElementById('state').value = '';
            document.getElementById('customTime').value = '';
            document.getElementById('timeUnit').value = 'hours';
            document.getElementById('status').value = 'online';
            document.getElementById('type').value = 'PLAYING';
            document.getElementById('useTimestamp').checked = true;
            
            showAlert('✅ RPC temizlendi!', 'success');
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        showAlert('Bağlantı hatası!', 'error');
    }
}

// Çıkış
async function logout() {
    if (!confirm('Çıkış yapmak istediğinden emin misin?')) {
        return;
    }
    
    try {
        await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        currentUser = null;
        document.querySelector('.rpc-section').classList.remove('active');
        document.querySelector('.login-section').classList.add('active');
        document.getElementById('tokenInput').value = '';
        
        showAlert('Çıkış yapıldı!', 'success');
    } catch (error) {
        showAlert('Bağlantı hatası!', 'error');
    }
}

// Enter tuşu ile giriş
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tokenInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });
});
