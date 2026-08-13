// ==========================================
// 1. FUNGSI LOGOUT
// ==========================================
function logoutTPMS() {
    localStorage.removeItem("tpms_logged_in");
    window.location.href = "login.html";
}

// ==========================================
// 2. SAMBUNGAN MQTT BROKER & KEMASKINI TAYAR (6 TAYAR)
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

let lowPressureTires = [];

let minLimit = 90;
let maxLimit = 120;

// Minta izin kebenaran audio/getar pelayar semasa mula-mula klik skrin
document.addEventListener("click", () => {
    if (window.AudioContext || window.webkitAudioContext) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
}, { once: true });

// ==========================================
// 3. FUNGSI NOTIFIKASI TEPAT & KONSISTEN
// ==========================================
function showWhatsAppNotification(title, message) {
    // 1. Getaran peranti (Vibrate API)
    if ("vibrate" in navigator) {
        try {
            navigator.vibrate([300, 100, 300, 100, 300]);
        } catch (e) {
            console.log("Getaran disekat:", e);
        }
    }

    // 2. Bunyi Amaran (Web Audio API - Bip Kuat)
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Frekuensi tinggi untuk amaran
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
        console.log("Audio disekat pelayar:", e);
    }

    // 3. Paparkan Kotak Popup UI Terapung di Skrin Web
    const popup = document.getElementById("whatsapp-notification-popup");
    const titleEl = document.getElementById("wa-notif-title");
    const msgEl = document.getElementById("wa-notif-msg");

    if (popup && titleEl && msgEl) {
        titleEl.innerText = title;
        msgEl.innerText = message;
        popup.classList.add("show");

        // Hilangkan automatik selepas 5 saat
        setTimeout(() => {
            popup.classList.remove("show");
        }, 5000);
    }
}

client.on("connect", () => {
    console.log("MQTT Connected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }
    
    client.subscribe("lori/VKT8821/tayar/#");
    client.subscribe("lori/VKT8821/config/#");
});

client.on("message", (topic, message) => {
    const msgString = message.toString();
    console.log("Data Terima:", topic, msgString);

    if (topic === "lori/VKT8821/config/minPSI") {
        minLimit = parseInt(msgString);
        return;
    }
    if (topic === "lori/VKT8821/config/maxPSI") {
        maxLimit = parseInt(msgString);
        return;
    }

    if (tireMap[topic]) {
        try {
            let psiValue;
            const rawMessage = msgString.trim();

            if (rawMessage.startsWith("{")) {
                const data = JSON.parse(rawMessage);
                psiValue = parseInt(data.psi);
            } else {
                psiValue = parseInt(rawMessage);
            }

            const target = tireMap[topic];
            const psiElement = document.getElementById(target.psiId);
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && boxElement) {
                psiElement.innerHTML = `${psiValue} <small>PSI</small>`;

                if (psiValue < minLimit || psiValue > maxLimit) {
                    boxElement.classList.add("warning");
                    
                    if (!lowPressureTires.includes(target.name)) {
                        lowPressureTires.push(target.name);
                        
                        // Cetuskan popup gaya WhatsApp, bunyi & getar
                        showWhatsAppNotification(
                            "AMARAN TPMS LORI", 
                            `Tayar ${target.name} bermasalah! Bacaan: ${psiValue} PSI (Had: ${minLimit}-${maxLimit}).`
                        );
                    }
                } else {
                    boxElement.classList.remove("warning");
                    lowPressureTires = lowPressureTires.filter(t => t !== target.name);
                }

                const alertPanel = document.getElementById("alert-panel");
                const alertTitle = document.getElementById("alert-title");
                const alertMsg = document.getElementById("alert-msg");

                if (alertPanel && alertTitle && alertMsg) {
                    if (lowPressureTires.length > 0) {
                        alertPanel.classList.add("danger");
                        alertTitle.innerText = "AMARAN TEKANAN LORI!";
                        alertMsg.innerText = `Tayar bermasalah: ${lowPressureTires.join(", ")}`;
                    } else {
                        alertPanel.classList.remove("danger");
                        alertTitle.innerText = "SISTEM NORMAL";
                        alertMsg.innerText = `Semua tayar dalam julat selamat (${minLimit}-${maxLimit} PSI).`;
                    }
                }

                const lastUpdate = document.getElementById("last-update");
                if (lastUpdate) {
                    const now = new Date();
                    lastUpdate.innerText = now.toLocaleTimeString();
                }
            }
        } catch (e) {
            console.error("Ralat memproses data tayar:", e);
        }
    }
});
