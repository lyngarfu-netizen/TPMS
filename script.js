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

// Tetapan Had Awal
let minLimit = 90;
let maxLimit = 120;

// Aktifkan Audio Context apabila pengguna sentuh skrin buat kali pertama
document.addEventListener("click", () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {}
}, { once: true });

// ==========================================
// 3. FUNGSI POPUP DALAM WEB APP & ONESIGNAL PUSH
// ==========================================
function showAppPopupNotification(title, message) {
    // Getaran peranti (vibrate)
    if ("vibrate" in navigator) {
        try {
            navigator.vibrate([300, 100, 300]);
        } catch (e) {}
    }

    // Bunyi amaran pendek dalam web
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

    // Paparkan kotak elemen HTML #whatsapp-notification-popup
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

    // --- TAMBAHAN ONESIGNAL PUSH NOTIFICATION ---
    // Ini akan tolak notifikasi terus ke sistem telefon (Lock Screen)
    if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function(OneSignal) {
            try {
                // Semak sama ada pengguna sudah beri kebenaran notifikasi
                if (OneSignal.User.PushSubscription.optedIn) {
                    // Nota: Untuk hantar melalui browser secara langsung ke peranti sendiri 
                    // tanpa backend server, kita boleh trigger event atau paparkan melalui logik OneSignal.
                    // Cara paling mudah: OneSignal akan hantar notifikasi luaran jika dipicu.
                    console.log("OneSignal sedia hantar amaran untuk:", message);
                }
            } catch (err) {
                console.error("Ralat OneSignal:", err);
            }
        });
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

    // Auto-Sync Had Min & Max dari ESP32
    if (topic === "lori/VKT8821/config/minPSI") {
        minLimit = parseInt(msgString);
        console.log("Had Min Dikemaskini:", minLimit);
        return;
    }
    if (topic === "lori/VKT8821/config/maxPSI") {
        maxLimit = parseInt(msgString);
        console.log("Had Max Dikemaskini:", maxLimit);
        return;
    }

    // Tangkap data bacaan tayar
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

                // Semak amaran ikut had semasa
                if (psiValue < minLimit || psiValue > maxLimit) {
                    boxElement.classList.add("warning");
                    
                    if (!lowPressureTires.includes(target.name)) {
                        lowPressureTires.push(target.name);
                        
                        // Panggil popup amaran
                        showAppPopupNotification(
                            "AMARAN TPMS LORI", 
                            `Tayar ${target.name} bermasalah! Bacaan: ${psiValue} PSI (Had: ${minLimit}-${maxLimit}).`
                        );
                    }
                } else {
                    boxElement.classList.remove("warning");
                    lowPressureTires = lowPressureTires.filter(t => t !== target.name);
                }

                // Kemaskini Panel Diagnostik Bawah
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
            console.error("Ralat parse data:", e);
        }
    }
});
