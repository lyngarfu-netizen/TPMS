// Konfigurasi MQTT Broker (Guna port WSS secure untuk GitHub Pages)
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const MQTT_TOPIC = "tpms/vkt8821/data"; // Pastikan sama dengan kod ESP32 di Wokwi

// Sambung ke MQTT Broker
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
    const statusBadge = document.getElementById("connection-status");
    if(statusBadge) {
        statusBadge.innerHTML = '<div class="pulse-dot" style="background: #00ff66; box-shadow: 0 0 10px #00ff66;"></div> ONLINE';
    }
    console.log("Berjaya sambung ke MQTT Broker!");
    client.subscribe(MQTT_TOPIC);
});

client.on("error", (err) => {
    console.error("Ralat Sambungan MQTT: ", err);
    const statusBadge = document.getElementById("connection-status");
    if(statusBadge) {
        statusBadge.innerHTML = '<div class="pulse-dot" style="background: #ff3366;"></div> ERROR';
    }
});

client.on("message", (topic, payload) => {
    try {
        const data = JSON.parse(payload.toString());
        console.log("Data diterima dari Wokwi:", data);
        
        updateDashboard(data);
        checkTireAlerts(data);
        
        const lastUpdate = document.getElementById("last-update");
        if(lastUpdate) {
            lastUpdate.innerText = "Baru Sahaja";
        }
    } catch (e) {
        console.error("Ralat parse JSON data:", e);
    }
});

// Fungsi kemaskini nilai PSI pada paparan Lori
function updateDashboard(data) {
    const tires = ['fl1', 'fr1', 'bl1', 'br1', 'bl2', 'br2'];
    
    tires.forEach(t => {
        if (data[t] !== undefined) {
            const psiVal = data[t];
            const psiElement = document.getElementById(`psi-${t}`);
            if(psiElement) {
                psiElement.innerHTML = `${psiVal} <small>PSI</small>`;
            }
            
            const box = document.getElementById(`box-${t}`);
            if (box) {
                // Logik Amaran: Jika kurang dari 90 PSI, tukar jadi merah (Bahaya)
                if (psiVal < 90) {
                    box.classList.add("warning");
                } else {
                    box.classList.remove("warning");
                }
            }
        }
    });
}

// Fungsi Semak Amaran & Papar Pop-up Gaya WhatsApp
function checkTireAlerts(data) {
    const minPsi = 90;
    let problemTires = [];
    
    const tireNames = {
        fl1: "Depan Kiri (FL1)",
        fr1: "Depan Kanan (FR1)",
        bl1: "Belakang Kiri 1 (BL1)",
        br1: "Belakang Kanan 1 (BR1)",
        bl2: "Belakang Kiri 2 (BL2)",
        br2: "Belakang Kanan 2 (BR2)"
    };

    for (let key in tireNames) {
        if (data[key] !== undefined && data[key] < minPsi) {
            problemTires.push(`${tireNames[key]} (${data[key]} PSI)`);
        }
    }

    const alertTitle = document.getElementById("alert-title");
    const alertMsg = document.getElementById("alert-msg");
    const alertPanel = document.getElementById("alert-panel");

    if (problemTires.length > 0) {
        if(alertTitle) alertTitle.innerText = "AMARAN TEKANAN RENDAH!";
        if(alertMsg) alertMsg.innerText = "Tayar bermasalah: " + problemTires.join(", ");
        if(alertPanel) {
            alertPanel.classList.add("danger");
        }

        // Papar Custom Popup (Gaya WhatsApp)
        showWhatsAppPopup("AMARAN TAYAR BOCOR!", "Bermasalah pada: " + problemTires.join(" | "));

    } else {
        if(alertTitle) alertTitle.innerText = "SISTEM NORMAL";
        if(alertMsg) alertMsg.innerText = "Semua 6 tayar berada dalam julat selamat.";
        if(alertPanel) {
            alertPanel.classList.remove("danger");
        }
    }
}

// Fungsi Kawal Popup Notifikasi Di Skrin
function showWhatsAppPopup(title, message) {
    const popup = document.getElementById("whatsapp-notification-popup");
    const titleEl = document.getElementById("wa-notif-title");
    const msgEl = document.getElementById("wa-notif-msg");

    if(titleEl) titleEl.innerText = title;
    if(msgEl) msgEl.innerText = message;

    if(popup) {
        popup.classList.add("show");

        // Hilangkan sendiri selepas 6 saat
        setTimeout(() => {
            popup.classList.remove("show");
        }, 6000);
    }
}

function logoutTPMS() {
    window.location.href = "login.html";
}
