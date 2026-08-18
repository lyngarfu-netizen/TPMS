// ==========================================
// 1. FUNGSI LOGOUT
// ==========================================
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// ==========================================
// 2. SAMBUNGAN MQTT BROKER & PEMETAAN TAYAR
// ==========================================
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const client = mqtt.connect(MQTT_BROKER);

const tireMap = {
    "lori/VKT8821/tayar/fl1": { psiId: "psi-fl1", boxId: "box-fl1", name: "Depan Kiri (FL1)" },
    "lori/VKT8821/tayar/fr1": { psiId: "psi-fr1", boxId: "box-fr1", name: "Depan Kanan (FR1)" },
    "lori/VKT8821/tayar/bl1": { psiId: "psi-bl1", boxId: "box-bl1", name: "B. Kiri 1 (BL1)" },
    "lori/VKT8821/tayar/br1": { psiId: "psi-br1", boxId: "box-br1", name: "B. Kanan 1 (BR1)" },
    "lori/VKT8821/tayar/bl2": { psiId: "psi-bl2", boxId: "box-bl2", name: "B. Kiri 2 (BL2)" },
    "lori/VKT8821/tayar/br2": { psiId: "psi-br2", boxId: "box-br2", name: "B. Kanan 2 (BR2)" }
};

const currentTireStatus = {}; 

// HAD KESELAMATAN TETAP (HARDCODED HAD MIN = 90 & MAX = 120)
const MIN_SAFETY_LIMIT = 90;
const MAX_SAFETY_LIMIT = 120;

// Aktifkan Audio Context
document.addEventListener("click", () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {}
}, { once: true });

// ==========================================
// 3. FUNGSI POPUP & ONESIGNAL PUSH API
// ==========================================
function showAppPopupNotification(title, message) {
    if ("vibrate" in navigator) {
        try { navigator.vibrate([300, 100, 300]); } catch (e) {}
    }

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}

    const popup = document.getElementById("whatsapp-notification-popup");
    const titleEl = document.getElementById("wa-notif-title");
    const msgEl = document.getElementById("wa-notif-msg");

    if (popup && titleEl && msgEl) {
        titleEl.innerText = title;
        msgEl.innerText = message;
        popup.classList.add("show");

        setTimeout(() => {
            popup.classList.remove("show");
        }, 5000);
    }

    const ONESIGNAL_APP_ID = "4c893bd9-4907-4c45-8977-c76fab5c51b9";
    const ONESIGNAL_REST_API_KEY = "os_v2_app_jsetxwkja5gelclxy5x2wxcrxfi3gbdgxyqeihu5v52leffnn2tpxnq6ccwa3piddsoiwutic55c5tqvz6eqeewkfcxukoex5dztorq";

    fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            included_segments: ["Total Subscriptions"],
            headings: { "en": title },
            contents: { "en": message }
        })
    })
    .then(response => response.json())
    .then(data => console.log("Notifikasi Berjaya Dihantar:", data))
    .catch((error) => console.error("Ralat Hantar Notifikasi:", error));
}

// ==========================================
// 4. KEMASKINI PANEL DIAGNOSTIK
// ==========================================
function updateAlertPanel() {
    const faultyTires = Object.keys(currentTireStatus).filter(name => currentTireStatus[name] === true);
    const alertPanel = document.getElementById("alert-panel");
    const alertTitle = document.getElementById("alert-title");
    const alertMsg = document.getElementById("alert-msg");

    if (alertPanel && alertTitle && alertMsg) {
        if (faultyTires.length > 0) {
            alertPanel.classList.add("danger");
            alertTitle.innerText = "AMARAN TEKANAN LORI!";
            alertMsg.innerText = `Tayar bermasalah: ${faultyTires.join(", ")}`;
        } else {
            alertPanel.classList.remove("danger");
            alertTitle.innerText = "SISTEM NORMAL";
            alertMsg.innerText = `Semua tayar dalam julat selamat (${MIN_SAFETY_LIMIT}-${MAX_SAFETY_LIMIT} PSI).`;
        }
    }
}

// ==========================================
// 5. MQTT EVENTS
// ==========================================
client.on("connect", () => {
    console.log("MQTT Connected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }
    
    // Subscribe khusus kepada data tayar
    client.subscribe("lori/VKT8821/tayar/#");
});

client.on("message", (topic, message) => {
    const msgString = message.toString().trim();

    if (tireMap[topic]) {
        try {
            let psiValue = 0;

            if (msgString.startsWith("{")) {
                const data = JSON.parse(msgString);
                psiValue = parseFloat(data.psi ?? data.value ?? 0);
            } else {
                psiValue = parseFloat(msgString);
            }

            if (isNaN(psiValue)) return;

            const target = tireMap[topic];
            const psiElement = document.getElementById(target.psiId);
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && boxElement) {
                // Paparkan nilai PSI
                psiElement.innerHTML = `${Math.round(psiValue)} <small>PSI</small>`;

                // LOGIK SEMAKAN HAD AMARAN
                const isUnderMin = psiValue < MIN_SAFETY_LIMIT;
                const isOverMax = psiValue > MAX_SAFETY_LIMIT;
                const isWarning = isUnderMin || isOverMax;

                if (isWarning) {
                    boxElement.classList.add("warning");
                    
                    if (!currentTireStatus[target.name]) {
                        currentTireStatus[target.name] = true;
                        const statusText = isUnderMin ? "TERLALU RENDAH" : "TERLALU TINGGI";
                        showAppPopupNotification(
                            "AMARAN TPMS LORI", 
                            `Tayar ${target.name} ${statusText}! Bacaan: ${Math.round(psiValue)} PSI (Had: ${MIN_SAFETY_LIMIT}-${MAX_SAFETY_LIMIT}).`
                        );
                    }
                } else {
                    boxElement.classList.remove("warning");
                    currentTireStatus[target.name] = false;
                }

                updateAlertPanel();

                const lastUpdate = document.getElementById("last-update");
                if (lastUpdate) {
                    const now = new Date();
                    lastUpdate.innerText = now.toLocaleTimeString();
                }
            }
        } catch (e) {
            console.error("Ralat parse data tayar:", e);
        }
    }
});
