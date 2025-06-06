// =============== FILE: voting-config-sync.js ===============
// File ini untuk menggantikan bagian countdown di votes_app.js

/**
 * Countdown timer yang tersinkronisasi dengan konfigurasi dari localStorage
 */
function initializeCountdown() {
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

    // Logika tahun dinamis yang pintar
    const now = new Date();
    const currentYear = now.getFullYear();

    // Cek apakah event tahun ini sudah lewat (setelah 6 Oktober)
    const thisYearEndDate = new Date(currentYear, 9, 6, 16, 20, 0); // 6 Oktober tahun ini

    let eventYear;
    if (now > thisYearEndDate) {
      // Jika sudah lewat 6 Oktober, gunakan tahun depan
      eventYear = currentYear + 1;
    } else {
      // Jika belum lewat 6 Oktober, gunakan tahun ini
      eventYear = currentYear;
    }

    return {
      startDate: new Date(eventYear, 4, 25, 20, 20, 0), // 25 Mei, 20:20:00
      endDate: new Date(eventYear, 9, 6, 16, 20, 0), // 6 Oktober, 16:20:00
    };
  };

  // Load konfigurasi
  const config = loadVotingConfig();
  const votingStartDate = config.startDate;
  const votingEndDate = config.endDate;

  // Make variables globally accessible
  window.votingStartDate = votingStartDate;
  window.votingEndDate = votingEndDate;

  const overlay = document.getElementById("votingOverlay");
  const countdownTitle = document.querySelector(".countdown-title");
  const countdownDescription = document.querySelector(".countdown-description");
  if (!overlay || !countdownTitle || !countdownDescription) return;

  // Start the current time clock with millisecond precision
  updateCurrentTimeWithPrecision();
  setInterval(updateCurrentTimeWithPrecision, 100);

  // Listen for storage changes (when config is updated from another tab/page)
  window.addEventListener("storage", (e) => {
    if (e.key === "votingConfig") {
      location.reload(); // Reload page to apply new config
    }
  });

  // Check current voting status with precise time comparison
  const checkVotingStatus = () => {
    const now = new Date();
    const nowMs = now.getTime();
    const startMs = votingStartDate.getTime();
    const endMs = votingEndDate.getTime();

    updateRemainingTimeWithPrecision(nowMs, endMs);

    // Case 1: Before voting starts
    if (nowMs < startMs) {
      overlay.classList.remove("hidden");
      countdownTitle.textContent = "Voting Belum Dimulai";
      countdownDescription.textContent = "Pemilihan akan dimulai dalam:";

      const distance = startMs - nowMs;
      updateCountdownDisplayWithPrecision(distance);
      return "before";
    }
    // Case 2: After voting ends
    else if (nowMs >= endMs) {
      overlay.classList.remove("hidden");
      countdownTitle.textContent = "Voting Telah Berakhir";
      countdownDescription.textContent = "Terima kasih atas partisipasi Anda.";

      document.querySelector(".countdown-timer").style.display = "none";
      return "after";
    }
    // Case 3: During voting period
    else {
      overlay.classList.add("hidden");
      return "during";
    }
  };

  // Helper function to update countdown display
  const updateCountdownDisplayWithPrecision = (distance) => {
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById("days").textContent = days
      .toString()
      .padStart(2, "0");
    document.getElementById("hours").textContent = hours
      .toString()
      .padStart(2, "0");
    document.getElementById("minutes").textContent = minutes
      .toString()
      .padStart(2, "0");
    document.getElementById("seconds").textContent = seconds
      .toString()
      .padStart(2, "0");
  };

  // Initial check
  const initialStatus = checkVotingStatus();

  if (initialStatus === "during") {
    showToast(
      "Voting sedang berlangsung! Silakan pilih kandidat Anda.",
      "success"
    );
  }

  // Update countdown every 100ms
  const countdown = setInterval(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const startMs = votingStartDate.getTime();
    const endMs = votingEndDate.getTime();

    if (nowMs < startMs) {
      const distance = startMs - nowMs;
      updateCountdownDisplayWithPrecision(distance);

      if (distance <= 100) {
        showToast(
          "Voting telah dimulai! Silakan pilih kandidat Anda.",
          "success"
        );
        checkVotingStatus();
      }
    } else if (nowMs < endMs) {
      if (!overlay.classList.contains("hidden")) {
        overlay.classList.add("hidden");
        showToast(
          "Voting telah dimulai! Silakan pilih kandidat Anda.",
          "success"
        );
      }

      updateRemainingTimeWithPrecision(nowMs, endMs);

      const distance = endMs - nowMs;
      if (distance <= 100) {
        showToast("Voting telah berakhir!", "info");
        checkVotingStatus();
      }
    } else {
      if (overlay.classList.contains("hidden")) {
        checkVotingStatus();
      }
    }
  }, 100);
}

function updateCurrentTimeWithPrecision() {
  const now = new Date();
  const timeElement = document.getElementById("currentTime");
  if (!timeElement) return;

  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");

  timeElement.textContent = `${hours}:${minutes}:${seconds}`;
}

function updateRemainingTimeWithPrecision(nowMs, endMs) {
  const timeElement = document.getElementById("timeRemaining");
  if (!timeElement) return;

  const startMs = window.votingStartDate.getTime();

  let distance;
  let isVotingActive = false;

  // Jika sebelum voting dimulai, tidak tampilkan remaining time
  if (nowMs < startMs) {
    timeElement.textContent = "00:00:00";
    timeElement.classList.remove("time-critical");
    timeElement.style.color = "#ff6b35"; // Orange untuk menunggu
    return;
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
    timeElement.classList.remove("time-critical");
    timeElement.style.color = "#dc3545"; // Merah untuk berakhir
    return;
  }

  // Hitung jam, menit, detik dengan batasan 24 jam
  const totalHours = Math.floor(distance / (1000 * 60 * 60));
  const hours = totalHours % 24; // Batasi jam maksimal 24 jam
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Format dengan leading zero
  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");
  const secondsStr = seconds.toString().padStart(2, "0");

  timeElement.textContent = `${hoursStr}:${minutesStr}:${secondsStr}`;

  // Logika untuk membuat countdown merah jika kurang dari 5 menit
  if (isVotingActive && distance < 5 * 60 * 1000) {
    // 5 menit = 5 * 60 * 1000 ms
    timeElement.classList.add("time-critical");
  } else {
    timeElement.classList.remove("time-critical");
  }
}

// Bind event saat DOM siap
document.addEventListener("DOMContentLoaded", () => {
  const currentYear = new Date().getFullYear();
  const electionYear = currentYear + 1;

  const electionPeriodElement = document.getElementById("electionPeriod");
  if (electionPeriodElement) {
    electionPeriodElement.textContent = electionYear;
  }

  const footerYearElement = document.querySelector("footer p");
  if (footerYearElement) {
    footerYearElement.innerHTML = footerYearElement.innerHTML
      .replace("2025", currentYear)
      .replace("2026", electionYear);
  }

  initializeCountdown();
});
