// Konfigurasi MQTT Broker (Contoh menggunakan broker awam standard)
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const MQTT_TOPIC = "tpms/vkt8821/data"; // Tukar mengikut topik MQTT ESP32 anda

// Sambung ke MQTT
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
    document.getElementById("connection-status").innerHTML = '<div class="pulse-dot" style="background: #00ff66;"></div> ONLINE';
    console.log("Berjaya sambung ke MQTT Broker");
    client.subscribe(MQTT_TOPIC);
});

client.on("message", (topic, payload) => {
    try {
        const data = JSON.parse(payload.toString());
        // Jangkaan format JSON dari MQTT: 
        // { "fl1": 110, "fr1": 85, "bl1": 115, "br1": 120, "bl2": 112, "br2": 115 }
        
        updateDashboard(data);
        checkTireAlerts(data);
        
        document.getElementById("last-update").innerText = "Baru Sahaja";
    } catch (e) {
        console.error("Ralat parse data MQTT:", e);
    }
});

// Fungsi kemaskini nilai PSI pada paparan Lori
function updateDashboard(data) {
    const tires = ['fl1', 'fr1', 'bl1', 'br1', 'bl2', 'br2'];
    
    tires.forEach(t => {
        if (data[t] !== undefined) {
            const psiVal = data[t];
            document.getElementById(`psi-${t}`).innerHTML = `${psiVal} <small>PSI</small>`;
            
            const box = document.getElementById(`box-${t}`);
            // Logik Amaran: Jika kurang dari 90 PSI, tukar jadi merah (Bahaya)
            if (psiVal < 90) {
                box.style.borderColor = "#ff3333";
                box.style.background = "rgba(255, 51, 51, 0.2)";
            } else {
                box.style.borderColor = "#00f0ff";
                box.style.background = "rgba(16, 21, 32, 0.8)";
            }
        }
    });
}

// Fungsi Semak Amaran & Papar Pop-up Gaya WhatsApp
function checkTireAlerts(data) {
    const minPsi = 90;
    let problemTires = [];
    
    // Nama penuh untuk rujukan spesifik
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
        // Papar status bahaya di panel Diagnostic
        alertTitle.innerText = "AMARAN TEKANAN RENDAH!";
        alertMsg.innerText = "Tayar bermasalah: " + problemTires.join(", ");
        alertPanel.style.borderColor = "#ff3333";
        alertPanel.style.background = "rgba(255, 51, 51, 0.1)";

        // Papar Custom Popup (Gaya WhatsApp) di skrin
        showWhatsAppPopup("AMARAN TAYAR KEBOCORAN!", "Bermasalah pada: " + problemTires.join(" | "));

    } else {
        // Kembali normal
        alertTitle.innerText = "SISTEM NORMAL";
        alertMsg.innerText = "Semua 6 tayar berada dalam julat selamat.";
        alertPanel.style.borderColor = "#2a384e";
        alertPanel.style.background = "rgba(16, 21, 32, 0.8)";
    }
}

// Fungsi Kawal Popup Notifikasi Di Skrin
function showWhatsAppPopup(title, message) {
    const popup = document.getElementById("whatsapp-notification-popup");
    document.getElementById("wa-notif-title").innerText = title;
    document.getElementById("wa-notif-msg").innerText = message;

    popup.classList.add("show");

    // Hilangkan sendiri selepas 6 saat
    setTimeout(() => {
        popup.classList.remove("show");
    }, 6000);
}

function logoutTPMS() {
    window.location.href = "login.html";
}
