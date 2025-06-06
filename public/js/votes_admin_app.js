// =============== FILE: simple-countdown.js ===============
// Countdown timer sederhana tanpa overlay

/**
 * Simple countdown timer yang hanya menampilkan waktu saat ini dan waktu tersisa
 */
function initializeSimpleCountdown() {
  // AMBIL KONFIGURASI DARI LOCALSTORAGE
  const loadVotingConfig = () => {
    const saved = localStorage.getItem("votingConfig");
    if (saved) {
      const config = JSON.parse(saved);
      return {
        startDate: new Date(config.startDate),
        endDate: new Date(config.endDate),
      };
    }

    // FALLBACK: Jika tidak ada konfigurasi, gunakan nilai default

    // Logika tahun dinamis yang pintar
    const now = new Date();
    const currentYear = now.getFullYear();

    // Cek apakah event tahun ini sudah lewat (setelah 22 November)
    const thisYearEndDate = new Date(currentYear, 10, 22, 19, 1, 0); // 22 Nov tahun ini

    let eventYear;
    if (now > thisYearEndDate) {
      // Jika sudah lewat 22 Nov, gunakan tahun depan
      eventYear = currentYear + 1;
    } else {
      // Jika belum lewat 22 Nov, gunakan tahun ini
      eventYear = currentYear;
    }

    return {
      startDate: new Date(eventYear, 4, 25, 20, 20, 0), // 25 Mei, 20:20:00
      endDate: new Date(eventYear, 9, 5, 16, 20, 0), // 22 Nov, 19:01:00
    };
  };

  // Load konfigurasi
  const config = loadVotingConfig();
  const votingStartDate = config.startDate;
  const votingEndDate = config.endDate;

  // Make variables globally accessible
  window.votingStartDate = votingStartDate;
  window.votingEndDate = votingEndDate;

  // Start the current time clock
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);

  // Start the remaining time countdown
  updateRemainingTime();
  setInterval(updateRemainingTime, 1000);

  // Listen for storage changes (when config is updated from another tab/page)
  window.addEventListener("storage", (e) => {
    if (e.key === "votingConfig") {
      location.reload(); // Reload page to apply new config
    }
  });
}

/**
 * Update waktu saat ini
 */
function updateCurrentTime() {
  const now = new Date();
  const timeElement = document.getElementById("currentTime");
  if (!timeElement) return;

  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");

  timeElement.textContent = `${hours}:${minutes}:${seconds}`;
}

/**
 * Update waktu tersisa untuk voting
 */
function updateRemainingTime() {
  const timeElement = document.getElementById("timeRemaining");
  if (!timeElement) return;

  const now = new Date();
  const nowMs = now.getTime();
  const startMs = window.votingStartDate.getTime();
  const endMs = window.votingEndDate.getTime();

  let distance;
  let isVotingActive = false;

  // Jika sebelum voting dimulai, hitung waktu sampai voting dimulai
  if (nowMs < startMs) {
    distance = startMs - nowMs;
    timeElement.style.color = "#ff6b35"; // Orange untuk menunggu
  }
  // Jika voting sedang berlangsung, hitung waktu tersisa
  else if (nowMs >= startMs && nowMs < endMs) {
    distance = endMs - nowMs;
    isVotingActive = true;
    timeElement.style.color = "#28a745"; // Hijau untuk aktif
  }
  // Jika voting sudah berakhir
  else {
    timeElement.textContent = "00:00:00";
    timeElement.style.color = "#dc3545"; // Merah untuk berakhir
    return;
  }

  // Hitung jam, menit, detik
  const totalHours = Math.floor(distance / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Batasi jam maksimal 24 jam (format 24 jam berulang)
  const hours = totalHours % 24;

  // Format dengan leading zero
  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");
  const secondsStr = seconds.toString().padStart(2, "0");

  timeElement.textContent = `${hoursStr}:${minutesStr}:${secondsStr}`;

  // Tambahkan efek berkedip jika waktu hampir habis (kurang dari 5 menit)
  if (isVotingActive && distance < 5 * 60 * 1000) {
    timeElement.classList.add("time-critical");
  } else {
    timeElement.classList.remove("time-critical");
  }

  if (nowMs < window.votingStartDate.getTime() || nowMs >= endMs) {
    timeElement.textContent = "00:00:00";
    timeElement.classList.remove("time-critical");
    return;
  }
}

// Bind event saat DOM siap
document.addEventListener("DOMContentLoaded", () => {
  const currentYear = new Date().getFullYear();
  const electionYear = currentYear + 1;

  // Update tahun pemilihan
  const electionPeriodElement = document.getElementById("electionPeriod");
  if (electionPeriodElement) {
    electionPeriodElement.textContent = electionYear;
  }

  // Update footer jika ada
  const footerYearElement = document.querySelector("footer p");
  if (footerYearElement) {
    footerYearElement.innerHTML = footerYearElement.innerHTML
      .replace("2025", currentYear)
      .replace("2026", electionYear);
  }

  // Inisialisasi countdown
  initializeSimpleCountdown();
});
