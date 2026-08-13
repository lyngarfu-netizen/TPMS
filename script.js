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

// Pemadan Topik MQTT ke ID HTML (6 Tayar: FL1, FR1, BL1, BR1, BL2, BR2)
const tireMap = {
    "lori/VKT8821/tayar/fl1": { psiId: "psi-fl1", boxId: "box-fl1", name: "Depan Kiri (FL1)" },
    "lori/VKT8821/tayar/fr1": { psiId: "psi-fr1", boxId: "box-fr1", name: "Depan Kanan (FR1)" },
    "lori/VKT8821/tayar/bl1": { psiId: "psi-bl1", boxId: "box-bl1", name: "B. Kiri 1 (BL1)" },
    "lori/VKT8821/tayar/br1": { psiId: "psi-br1", boxId: "box-br1", name: "B. Kanan 1 (BR1)" },
    "lori/VKT8821/tayar/bl2": { psiId: "psi-bl2", boxId: "box-bl2", name: "B. Kiri 2 (BL2)" },
    "lori/VKT8821/tayar/br2": { psiId: "psi-br2", boxId: "box-br2", name: "B. Kanan 2 (BR2)" }
};

let lowPressureTires = [];

// Tetapan Had Awal (Default sebelum terima dari ESP32)
let minLimit = 90;
let maxLimit = 120;

// ==========================================
// 3. FUNGSI NOTIFIKASI GAYA WHATSAPP (UI + BUNYI + GETAR)
// ==========================================
function showWhatsAppNotification(title, message) {
    // 1. Getaran peranti (vibrate)
    if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    // 2. Bunyi amaran menggunakan Web Audio API
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.log("Audio disekat pelayar:", e);
    }

    // 3. Paparkan Kotak Notifikasi Terapung Gaya WhatsApp di Skrin
    const popup = document.getElementById("whatsapp-notification-popup");
    const titleEl = document.getElementById("wa-notif-title");
    const msgEl = document.getElementById("wa-notif-msg");

    if (popup && titleEl && msgEl) {
        titleEl.innerText = title;
        msgEl.innerText = message;

        // Tunjuk kotak (tambah kelas show)
        popup.classList.add("show");

        // Hilangkan automatik selepas 4 saat
        setTimeout(() => {
            popup.classList.remove("show");
        }, 4000);
    }
}

client.on("connect", () => {
    console.log("MQTT Connected!");
    const statusBox = document.getElementById("connection-status");
    if (statusBox) {
        statusBox.innerHTML = '<div class="pulse-dot"></div> CONNECTED';
    }
    
    // Langgan semua topik lori (termasuk tayar dan config)
    client.subscribe("lori/VKT8821/tayar/#");
    client.subscribe("lori/VKT8821/config/#");
});

client.on("message", (topic, message) => {
    const msgString = message.toString();
    console.log("Data Terima:", topic, msgString);

    // 1. Tangkap data jika ia melibatkan tetapan Had (Config) - Auto-Sync
    if (topic === "lori/VKT8821/config/minPSI") {
        minLimit = parseInt(msgString);
        console.log("Had Min Ditukar ke:", minLimit);
        return;
    }
    if (topic === "lori/VKT8821/config/maxPSI") {
        maxLimit = parseInt(msgString);
        console.log("Had Max Ditukar ke:", maxLimit);
        return;
    }

    // 2. Tangkap data bacaan tayar
    if (tireMap[topic]) {
        try {
            const data = JSON.parse(msgString);
            const target = tireMap[topic];

            const psiElement = document.getElementById(target.psiId);
            const boxElement = document.getElementById(target.boxId);

            if (psiElement && boxElement) {
                // Tampilkan data PSI sahaja
                psiElement.innerHTML = `${data.psi} <small>PSI</small>`;

                // Amaran Tekanan mengikut had dinamik (minLimit & maxLimit)
                if (data.psi < minLimit || data.psi > maxLimit) {
                    boxElement.classList.add("warning");
                    
                    if (!lowPressureTires.includes(target.name)) {
                        lowPressureTires.push(target.name);
                        
                        // Cetuskan notifikasi bentuk WhatsApp, bunyi & getar
                        showWhatsAppNotification(
                            "AMARAN TPMS LORI", 
                            `Tayar ${target.name} bermasalah! Bacaan: ${data.psi} PSI (Had: ${minLimit}-${maxLimit}).`
                        );
                    }
                } else {
                    boxElement.classList.remove("warning");
                    lowPressureTires = lowPressureTires.filter(t => t !== target.name);
                }

                // Kemaskini Alert Panel
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

                // Kemaskini masa
                const lastUpdate = document.getElementById("last-update");
                if (lastUpdate) {
                    const now = new Date();
                    lastUpdate.innerText = now.toLocaleTimeString();
                }
            }
        } catch (e) {
            console.error("Ralat parse JSON:", e);
        }
    }
});
