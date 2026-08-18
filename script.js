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

// Simpan bacaan & status tayar
const tireReadings = {}; 
const currentTireStatus = {}; 

// Tetapan Had Awal (Dipaksa jadi Number)
let minLimit = 90;
let maxLimit = 120;

// Kemaskini paparan had keselamatan UI
function updateSafetyLabels() {
    const optimalPsiEl = document.getElementById("optimal-psi-label"); 
    const minPsiEl = document.getElementById("min-psi-label");         
    
    if (optimalPsiEl) optimalPsiEl.innerText = `${minLimit} - ${maxLimit} PSI`;
    if (minPsiEl) minPsiEl.innerText = `< ${minLimit} PSI`;
}

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
// 4. FUNGSI PENILAIAN SEMULA SEMUA TAYAR
// ==========================================
function reevaluateAllTires() {
    Object.keys(tireMap).forEach(topic => {
        const target = tireMap[topic];
        const psiValue = tireReadings[target.name];

        if (psiValue !== undefined) {
            const boxElement = document.getElementById(target.boxId);
            
            // PAKSA SEMUA JADI NOMBOR SEBELUM BANDING
            const currentPsi = Number(psiValue);
            const currentMin = Number(minLimit);
            const currentMax = Number(maxLimit);

            const isUnderMin = currentPsi < currentMin;
            const isOverMax = currentPsi > currentMax;
            const isWarning = isUnderMin || isOverMax;

            if (boxElement) {
                if (isWarning) {
                    boxElement.classList.add("warning");
                    currentTireStatus[target.name] = true;
                } else {
                    boxElement.classList.remove("warning");
                    currentTireStatus[target.name] = false;
                }
            }
        }
    });

    updateAlertPanel();
}

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
            alertMsg.innerText = `Semua tayar dalam julat selamat (${minLimit}-${maxLimit} PSI).`;
        }
    }
}

// ==========================================
// 5. MQTT EVENT LISTENERS
// ==========================================
client.on("connect", () => {
    console.log("MQTT Connected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }
    
    client.subscribe("lori/VKT8821/tayar/#");
    client.subscribe("lori/VKT8821/config/#");
    
    updateSafetyLabels();
});

client.on("message", (topic, message) => {
    const msgString = message.toString().trim();

    // 1. TERIMA TETAPAN MIN PSI
    if (topic === "lori/VKT8821/config/minPSI") {
        const parsedMin = Number(msgString);
        if (!isNaN(parsedMin) && parsedMin > 0) {
            minLimit = parsedMin; // Simpan sebagai Nombor
            console.log("[CONFIG] Had Min Berjaya Ditukar:", minLimit);
            updateSafetyLabels();
            reevaluateAllTires();
        }
        return;
    }

    // 2. TERIMA TETAPAN MAX PSI
    if (topic === "lori/VKT8821/config/maxPSI") {
        const parsedMax = Number(msgString);
        if (!isNaN(parsedMax) && parsedMax > 0) {
            maxLimit = parsedMax; // Simpan sebagai Nombor
            console.log("[CONFIG] Had Max Berjaya Ditukar:", maxLimit);
            updateSafetyLabels();
            reevaluateAllTires();
        }
        return;
    }

    // 3. TERIMA BACAAN TAYAR REAL-TIME
    if (tireMap[topic]) {
        try {
            let psiValue = 0;

            if (msgString.startsWith("{")) {
                const data = JSON.parse(msgString);
                psiValue = Number(data.psi ?? data.value ?? 0);
            } else {
                psiValue = Number(msgString); // PAKSA CONVERT JADI NOMBOR
            }

            if (isNaN(psiValue)) {
                console.warn("Format PSI tidak sah:", msgString);
                return;
            }

            const target = tireMap[topic];
            tireReadings[target.name] = psiValue; // Simpan bacaan terkini

            const psiElement = document.getElementById(target.psiId);
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && boxElement) {
                psiElement.innerHTML = `${psiValue} <small>PSI</small>`;

                // PAKSAAN NOMBOR UNTUK PEMBANDINGAN SAMA SKALAR
                const currentPsi = Number(psiValue);
                const currentMin = Number(minLimit);
                const currentMax = Number(maxLimit);

                const isUnderMin = currentPsi < currentMin;
                const isOverMax = currentPsi > currentMax;
                const isWarning = isUnderMin || isOverMax;

                console.log(`[SEMAK] ${target.name} | PSI: ${currentPsi} | Min: ${currentMin} | Max: ${currentMax} | Amar: ${isWarning}`);

                if (isWarning) {
                    boxElement.classList.add("warning");
                    
                    if (!currentTireStatus[target.name]) {
                        currentTireStatus[target.name] = true;
                        const statusText = isUnderMin ? "TERLALU RENDAH" : "TERLALU TINGGI";
                        showAppPopupNotification(
                            "AMARAN TPMS LORI", 
                            `Tayar ${target.name} ${statusText}! Bacaan: ${currentPsi} PSI (Had: ${currentMin}-${currentMax}).`
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
