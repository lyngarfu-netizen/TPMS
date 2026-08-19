// ==========================================
// TPMS DASHBOARD - FULL JAVASCRIPT (WITH PUSH NOTIFICATION)
// ==========================================

// 1. FUNGSI LOGOUT
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// 2. HAD KESELAMATAN (MIN DITUKAR KEPADA 80)
const MIN_SAFETY_LIMIT = 80;
const MAX_SAFETY_LIMIT = 120;

// Simpan status setiap tayar
const currentTireStatus = {};

// 3. MQTT BROKER
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const client = mqtt.connect(MQTT_BROKER);

// 4. FUNGSI UPDATE PAPARAN HAD KESELAMATAN (DINAMIK)
function updateSafetyLimitsDisplay() {
    const optimalText = document.getElementById("psi-optimal-text");
    const minText = document.getElementById("psi-min-text");

    if (optimalText) {
        optimalText.innerHTML = `${MIN_SAFETY_LIMIT} - ${MAX_SAFETY_LIMIT} PSI`;
    }

    if (minText) {
        minText.innerHTML = `< ${MIN_SAFETY_LIMIT} PSI`;
    }
}

// 5. FUNGSI UPDATE STATUS TAYAR & PENCETUS NOTIFIKASI
function checkAndUpdateTire(boxId, psiId, psiValue, tireName) {
    const psiElement = document.getElementById(psiId);
    const boxElement = document.getElementById(boxId);

    if (!psiElement || !boxElement) {
        console.warn("Element tidak dijumpai:", boxId, psiId);
        return;
    }

    psiValue = Number(psiValue);

    if (isNaN(psiValue)) {
        console.warn("PSI tidak valid:", psiValue);
        return;
    }

    // PAPAR NILAI PSI
    psiElement.innerHTML = `${Math.round(psiValue)} <small>PSI</small>`;

    // CHECK HAD KESELAMATAN
    const isUnderMin = psiValue < MIN_SAFETY_LIMIT;
    const isOverMax = psiValue > MAX_SAFETY_LIMIT;
    const isWarning = isUnderMin || isOverMax;

    // JIKA PSI TAK SELAMAT
    if (isWarning) {
        boxElement.style.setProperty("border-color", "#ff3366", "important");
        boxElement.style.setProperty("background-color", "rgba(255, 51, 102, 0.35)", "important");
        boxElement.style.setProperty("box-shadow", "0 0 20px #ff3366", "important");
        psiElement.style.setProperty("color", "#ff3366", "important");
        boxElement.classList.add("warning");

        currentTireStatus[tireName] = true;

        // CETUSKAN NOTIFIKASI LOKAL JIKA ADA AMARAN TAYAR
        triggerLocalNotification("AMARAN TPMS: " + tireName, `Tekanan tidak selamat: ${Math.round(psiValue)} PSI!`);
    } 
    // JIKA PSI NORMAL
    else {
        boxElement.style.setProperty("border-color", "#00f0ff", "important");
        boxElement.style.setProperty("background-color", "rgba(16, 21, 32, 0.95)", "important");
        boxElement.style.setProperty("box-shadow", "0 0 10px rgba(0, 240, 255, 0.2)", "important");
        psiElement.style.setProperty("color", "#00f0ff", "important");
        boxElement.classList.remove("warning");

        currentTireStatus[tireName] = false;
    }

    // UPDATE ALERT PANEL DENGAN SEGERA
    updateAlertPanel();
}

// 6. FUNGSI PAPAR NOTIFIKASI MELALUI SERVICE WORKER
function triggerLocalNotification(title, message) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
                body: message,
                icon: '192icon.png',
                badge: '192icon.png',
                vibrate: [300, 100, 300],
                tag: 'tpms-warning',
                renotify: true
            });
        });
    }
}

// 7. UPDATE ALERT PANEL
function updateAlertPanel() {
    updateSafetyLimitsDisplay();

    const faultyTires = Object.keys(currentTireStatus).filter(
        name => currentTireStatus[name] === true
    );

    const alertPanel = document.getElementById("alert-panel");
    const alertTitle = document.getElementById("alert-title");
    const alertMsg = document.getElementById("alert-msg");

    if (!alertPanel || !alertTitle || !alertMsg) return;

    if (faultyTires.length > 0) {
        alertPanel.style.setProperty("background-color", "rgba(255, 51, 102, 0.2)", "important");
        alertPanel.style.setProperty("border-color", "#ff3366", "important");
        alertPanel.style.setProperty("color", "#ff3366", "important");
        alertTitle.innerText = "AMARAN TEKANAN TAYAR!";
        alertMsg.innerText = `Tayar bermasalah: ${faultyTires.join(", ")}`;
    } else {
        alertPanel.style.setProperty("background-color", "rgba(0, 255, 136, 0.1)", "important");
        alertPanel.style.setProperty("border-color", "#00ff88", "important");
        alertPanel.style.setProperty("color", "#00ff88", "important");
        alertTitle.innerText = "SISTEM NORMAL";
        alertMsg.innerText = `Semua tayar dalam julat selamat (${MIN_SAFETY_LIMIT}-${MAX_SAFETY_LIMIT} PSI).`;
    }
}

// 8. MQTT CONNECT
client.on("connect", () => {
    console.log("MQTT CONNECTED!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }

    client.subscribe("lori/VKT8821/#", (error) => {
        if (!error) {
            console.log("Subscribed to: lori/VKT8821/#");
        }
    });
});

client.on("error", (error) => {
    console.error("MQTT ERROR:", error);
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> ERROR';
    }
});

client.on("close", () => {
    console.warn("MQTT Disconnected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> DISCONNECTED';
    }
});

// 9. MQTT MESSAGE RECEIVER
client.on("message", (topic, message) => {
    const msgString = message.toString().trim();
    const cleanTopic = topic.toLowerCase();
    let psiValue = NaN;

    if (msgString.startsWith("{")) {
        try {
            const data = JSON.parse(msgString);
            psiValue = parseFloat(data.psi ?? data.value ?? data.pressure);
        } catch (error) {
            return;
        }
    } else {
        psiValue = parseFloat(msgString);
    }

    if (isNaN(psiValue)) return;

    if (cleanTopic.includes("fl1")) {
        checkAndUpdateTire("box-fl1", "psi-fl1", psiValue, "Depan Kiri (FL1)");
    } else if (cleanTopic.includes("fr1")) {
        checkAndUpdateTire("box-fr1", "psi-fr1", psiValue, "Depan Kanan (FR1)");
    } else if (cleanTopic.includes("bl1")) {
        checkAndUpdateTire("box-bl1", "psi-bl1", psiValue, "B. Kiri 1 (BL1)");
    } else if (cleanTopic.includes("br1")) {
        checkAndUpdateTire("box-br1", "psi-br1", psiValue, "B. Kanan 1 (BR1)");
    } else if (cleanTopic.includes("bl2")) {
        checkAndUpdateTire("box-bl2", "psi-bl2", psiValue, "B. Kiri 2 (BL2)");
    } else if (cleanTopic.includes("br2")) {
        checkAndUpdateTire("box-br2", "psi-br2", psiValue, "B. Kanan 2 (BR2)");
    }

    const lastUpdate = document.getElementById("last-update");
    if (lastUpdate) {
        const now = new Date();
        lastUpdate.innerText = now.toLocaleTimeString();
    }
});

// 10. DAFTAR SERVICE WORKER & MOHON KEBENARAN NOTIFIKASI
document.addEventListener("DOMContentLoaded", () => {
    console.log("TPMS Dashboard Loaded");
    updateSafetyLimitsDisplay();
    updateAlertPanel();

    // Daftar Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker berjaya didaftarkan:', registration.scope);
            })
            .catch((error) => {
                console.error('Pendaftaran Service Worker gagal:', error);
            });
    }

    // Minta izin kebenaran notifikasi automatik
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    console.log('Kebenaran notifikasi diberikan!');
                }
            });
        }
    }
});


// Gantikan dengan Token dan Chat ID bot Telegram anda sendiri
const TELEGRAM_BOT_TOKEN = '8671783367:AAHJmt-8pgn-S2geNPsHTTku2GCjGLUTDbk';
const TELEGRAM_CHAT_ID = '8671783367:AAHJmt-8pgn-S2geNPsHTTku2GCjGLUTDbk';

function hantarNotifikasiTelegram(pesanTeks) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const data = {
        chat_id: 1501342995,
        text: pesanTeks,
        parse_mode: 'Markdown'
    };

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.ok) {
            console.log("Notifikasi Telegram berjaya dihantar!");
        } else {
            console.error("Gagal hantar Telegram:", data);
        }
    })
    .catch(error => console.error("Ralat rangkaian Telegram:", error));
}
