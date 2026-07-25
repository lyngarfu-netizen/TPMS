// Kod Rahsia Unik Lori (Penjual Boleh Ubah Di Sini)
const SECRET_CODE = "TPMS-8821";

// Semak jika pengguna dah pernah login (Permanent Login)
window.onload = function() {
    if (localStorage.getItem("tpms_logged_in") === "true") {
        window.location.replace("dashboard.html");
        return;
    }

    // Deteksi sama ada pengguna buka kat Phone atau PC
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        document.getElementById("pc-section").classList.add("hidden");
        document.getElementById("mobile-section").classList.remove("hidden");
    } else {
        generateQRCode();
    }
};

// Login PC guna Kod
function loginWithCodePC() {
    const input = document.getElementById("pc-code-input").value.trim();
    if (input === SECRET_CODE) {
        localStorage.setItem("tpms_logged_in", "true");
        window.location.replace("dashboard.html");
    } else {
        alert("Kod Unik Salah! Sila cuba lagi.");
    }
}

// Login Phone guna Kod
function loginWithCodeMobile() {
    const input = document.getElementById("mobile-code-input").value.trim();
    if (input === SECRET_CODE) {
        localStorage.setItem("tpms_logged_in", "true");
        window.location.replace("dashboard.html");
    } else {
        alert("Kod Unik Salah!");
    }
}

// Jana QR Code di skrin PC
function generateQRCode() {
    const currentUrl = window.location.href.split('?')[0];
    const qrUrl = currentUrl + "?code=" + SECRET_CODE;
    
    new QRCode(document.getElementById("qrcode"), {
        text: qrUrl,
        width: 150,
        height: 150,
        colorDark : "#0a0e17",
        colorLight : "#ffffff"
    });
}

// Bukak Kamera Phone untuk Scan QR Code
function startQRScanner() {
    document.getElementById("reader").classList.remove("hidden");
    const html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        (decodedText) => {
            if (decodedText.includes(SECRET_CODE) || decodedText === SECRET_CODE) {
                html5QrCode.stop();
                localStorage.setItem("tpms_logged_in", "true");
                alert("Berjaya Disahkan!");
                window.location.replace("dashboard.html");
            } else {
                alert("QR Code tidak sah!");
            }
        },
        (errorMessage) => { /* Scanning... */ }
    ).catch(err => {
        alert("Gagal membuka kamera: " + err);
    });
}