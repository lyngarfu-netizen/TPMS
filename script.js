// ==========================================
// 1. FUNGSI LOGOUT
// ==========================================
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// ==========================================
// 2. TETAPAN UTAMA & DATA TAYAR
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

// Simpan bacaan PSI terkini & status amaran setiap tayar
const tireReadings = {}; // Simpan nilai PSI semasa (cth: {"Depan Kiri (FL1)": 85})
const currentTireStatus = {}; // Simpan status masalah (true/false)

// Had asal (Nilai lalai)
let minLimit = 90;
let maxLimit = 120;

// Kemaskini label keselamatan pada UI
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
// 4. FUNGSI UNTUK USER HANTAR HAD BARU (PUBLISH KE MQTT)
// ==========================================
// Panggil fungsi ini apabila user tekan butang "Simpan Tetapan Had" di UI
function updateLimitsFromUser(newMin, newMax) {
    const minVal = parseInt(newMin, 10);
    const maxVal = parseInt(newMax, 10);

    if (isNaN(minVal) || isNaN(maxVal) || minVal >= maxVal) {
        alert("Sila masukkan nilai had PSI yang sah! Had Min mesti lebih kecil dari Had Max.");
        return;
    }

    // Publish ke MQTT Broker supaya ESP32 & peranti lain terima tetapan baru
    client.publish("lori/VKT8821/config/minPSI", minVal.toString(), { retain: true });
    client.publish("lori/VKT8821/config/maxPSI", maxVal.toString(), { retain: true });

    console.log(`[USER UPDATE] Hantar Had Baru: Min=${minVal}, Max=${maxVal}`);
}

// Fungsi untuk semak semula semua tayar bila limit bertukar
function reevaluateAllTires() {
    Object.keys(tireMap).forEach(topic => {
        const target = tireMap[topic];
        const psiValue = tireReadings[target.name];

        if (psiValue !== undefined) {
            const boxElement = document.getElementById(target.boxId);
            const isUnderMin = psiValue < minLimit;
            const isOverMax = psiValue > maxLimit;
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

    // Kemaskini panel diagnostik bawah
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
// 5. LOGIK SAMBUNGAN MQTT & DATA RECEIVE
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

    // 1. TERIMA TETAPAN MIN PSI (Daripada App User atau ESP32)
    if (topic === "lori/VKT8821/config/minPSI") {
        const parsedMin = parseInt(msgString, 10);
        if (!isNaN(parsedMin) && parsedMin > 0) {
            minLimit = parsedMin;
            console.log("Had Min Diberkemaskini:", minLimit);
            updateSafetyLabels();
            reevaluateAllTires(); // Semak semula tayar guna limit baru!
        }
        return;
    }

    // 2. TERIMA TETAPAN MAX PSI (Daripada App User atau ESP32)
    if (topic === "lori/VKT8821/config/maxPSI") {
        const parsedMax = parseInt(msgString, 10);
        if (!isNaN(parsedMax) && parsedMax > 0) {
            maxLimit = parsedMax;
            console.log("Had Max Diberkemaskini:", maxLimit);
            updateSafetyLabels();
            reevaluateAllTires(); // Semak semula tayar guna limit baru!
        }
        return;
    }

    // 3. TERIMA BACAAN TAYAR REAL-TIME
    if (tireMap[topic]) {
        try {
            let psiValue = Number(msgString);

            if (msgString.startsWith("{")) {
                const data = JSON.parse(msgString);
                psiValue = Number(data.psi ?? data.value ?? 0);
            }

            if (isNaN(psiValue)) return;

            const target = tireMap[topic];
            
            // Simpan bacaan terkini dalam memori
            tireReadings[target.name] = psiValue;

            const psiElement = document.getElementById(target.psiId);
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && boxElement) {
                psiElement.innerHTML = `${psiValue} <small>PSI</small>`;

                // Semak amaran (Bawah min ATAU Atas max)
                const isUnderMin = psiValue < minLimit;
                const isOverMax = psiValue > maxLimit;
                const isWarning = isUnderMin || isOverMax;

                if (isWarning) {
                    boxElement.classList.add("warning");
                    
                    // Notifikasi jika tayar baru masuk status merah
                    if (!currentTireStatus[target.name]) {
                        currentTireStatus[target.name] = true;
                        const statusText = isUnderMin ? "TERLALU RENDAH" : "TERLALU TINGGI";
                        showAppPopupNotification(
                            "AMARAN TPMS LORI", 
                            `Tayar ${target.name} ${statusText}! Bacaan: ${psiValue} PSI (Had: ${minLimit}-${maxLimit}).`
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
