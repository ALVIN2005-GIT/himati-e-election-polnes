// votes_result_app.js - Enhanced with super aesthetic animations

import { getAllCandidates, BASE_PUBLIC_FILE_URL } from "./candidates_api.js";
import { getVotesByCandidate } from "./votes_api.js";

// Store global vote data
let candidatesData = [];
let votesData = [];
let percentages = [];
let wsConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Animation state tracking
let animationQueue = new Map();
let isAnimating = new Map();

export async function initResultsPage() {
  const electionPeriodEl = document.getElementById("electionPeriod");
  if (electionPeriodEl) {
    const currentYear = new Date().getFullYear();
    electionPeriodEl.textContent = `${currentYear}/${currentYear + 1}`;
  }

  setupCountdown();
  await loadVotingResults();
  setupWebSocket();
  initializeAnimationStyles();
}

function initializeAnimationStyles() {
  // Add custom CSS animations if not already present
  if (!document.getElementById("voting-animations-css")) {
    const style = document.createElement("style");
    style.id = "voting-animations-css";
    style.textContent = `
      @keyframes numberPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); color: #ff6b35; text-shadow: 0 0 15px rgba(255, 107, 53, 0.6); }
        100% { transform: scale(1); }
      }
      
      @keyframes progressSlide {
        0% { transform: scaleX(0); transform-origin: left; }
        100% { transform: scaleX(1); transform-origin: left; }
      }
      
      @keyframes percentageGlow {
        0% { text-shadow: 0 0 5px rgba(13, 110, 253, 0.3); }
        50% { text-shadow: 0 0 20px rgba(13, 110, 253, 0.8), 0 0 30px rgba(13, 110, 253, 0.6); }
        100% { text-shadow: 0 0 5px rgba(13, 110, 253, 0.3); }
      }
      
      @keyframes cardHighlight {
        0% { box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15); }
        50% { box-shadow: 0 8px 25px rgba(13, 110, 253, 0.3), 0 0 20px rgba(13, 110, 253, 0.2); }
        100% { box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15); }
      }
      
      @keyframes sparkle {
        0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
        50% { opacity: 1; transform: scale(1) rotate(180deg); }
      }
      
      .vote-count-animate {
        animation: numberPulse 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }
      
      .progress-animate {
        animation: progressSlide 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }
      
      .percentage-glow {
        animation: percentageGlow 1.5s ease-in-out;
      }
      
      .card-highlight {
        animation: cardHighlight 1s ease-in-out;
      }
      
      .sparkle-effect {
        position: relative;
        overflow: visible;
      }
      
      .sparkle-effect::after {
        content: '✨';
        position: absolute;
        top: -10px;
        right: -10px;
        font-size: 1.2rem;
        animation: sparkle 2s ease-in-out;
        pointer-events: none;
      }
      
      .number-counter {
        display: inline-block;
        min-width: 80px;
        text-align: center;
        font-variant-numeric: tabular-nums;
        transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }
      
      .progress-bar {
        transition: width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                    background-color 0.5s ease;
        position: relative;
        overflow: hidden;
      }
      
      .progress-bar::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        animation: shimmer 2s infinite;
      }
      
      @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }
      
      .result-box.updating {
        transform: translateY(-2px);
        transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }
    `;
    document.head.appendChild(style);
  }
}

function setupCountdown() {
  const countdownEl = document.getElementById("countdown");
  if (!countdownEl) return;

  const countDownDate = new Date().getTime() + 12 * 60 * 60 * 1000;

  const countDownTimer = setInterval(function () {
    const now = new Date().getTime();
    const distance = countDownDate - now;

    const hours = Math.floor(distance / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownEl.innerHTML =
      (hours < 10 ? "0" + hours : hours) +
      ":" +
      (minutes < 10 ? "0" + minutes : minutes) +
      ":" +
      (seconds < 10 ? "0" + seconds : seconds);

    if (distance < 0) {
      clearInterval(countDownTimer);
      countdownEl.innerHTML = "Waktu Habis";
    }
  }, 1000);
}

export function setupWebSocket() {
  if (wsConnection) {
    wsConnection.close();
  }

  wsConnection = new WebSocket("ws://localhost:5410/ws/votes");

  wsConnection.onopen = () => {
    reconnectAttempts = 0;
    updateConnectionStatus(true);
  };

  wsConnection.onclose = (event) => {
    console.warn("WebSocket connection closed:", event.code, event.reason);
    updateConnectionStatus(false);

    if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;

      setTimeout(() => {
        setupWebSocket();
      }, 3000 * reconnectAttempts);
    }
  };

  wsConnection.onerror = (error) => {
    console.error("WebSocket error:", error);
    updateConnectionStatus(false);
  };

  wsConnection.onmessage = (event) => {
    if (!event.data) return;

    try {
      const data = JSON.parse(event.data);

      if (Array.isArray(data)) {
        handleVoteDataArray(data);
      } else if (data.candidate_id && typeof data.total_votes !== "undefined") {
        handleSingleVoteUpdate(data);
      }

      updateLastRefreshTime();
    } catch (err) {
      console.error(
        "Failed to parse WebSocket message:",
        err,
        "Raw data:",
        event.data
      );
    }
  };
}

function handleVoteDataArray(voteDataArray) {
  voteDataArray.forEach((voteData) => {
    const candidateId = Number(voteData.candidate_id);
    const totalVotes = Number(voteData.total_votes);
    const percentage = Number(voteData.percentage);

    const candidateIndex = candidatesData.findIndex(
      (c) => c.id === candidateId
    );
    if (candidateIndex !== -1) {
      const oldVotes = votesData[candidateIndex];
      const oldPercentage = parseFloat(percentages[candidateIndex]);

      votesData[candidateIndex] = totalVotes;
      percentages[candidateIndex] = percentage.toFixed(1);

      // Animate only if values changed
      if (oldVotes !== totalVotes) {
        animateVoteCountChange(candidateId, oldVotes, totalVotes);
      }

      if (oldPercentage !== percentage) {
        animateProgressBarChange(candidateId, oldPercentage, percentage);
      }
    }
  });

  updateAllVoteDisplays();
}

function handleSingleVoteUpdate(voteData) {
  const candidateId = Number(voteData.candidate_id);
  const totalVotes = Number(voteData.total_votes);

  const candidateIndex = candidatesData.findIndex((c) => c.id === candidateId);
  if (candidateIndex !== -1) {
    const oldVotes = votesData[candidateIndex];
    votesData[candidateIndex] = totalVotes;

    const totalAllVotes = votesData.reduce((sum, votes) => sum + votes, 0);
    const newPercentages = votesData.map((votes) =>
      totalAllVotes > 0 ? ((votes / totalAllVotes) * 100).toFixed(1) : "0.0"
    );

    // Animate changes for all candidates since percentages affect everyone
    candidatesData.forEach((candidate, idx) => {
      const oldPercentage = parseFloat(percentages[idx]);
      const newPercentage = parseFloat(newPercentages[idx]);

      if (oldPercentage !== newPercentage) {
        animateProgressBarChange(candidate.id, oldPercentage, newPercentage);
      }
    });

    percentages = newPercentages;

    // Animate vote count change for the specific candidate
    if (oldVotes !== totalVotes) {
      animateVoteCountChange(candidateId, oldVotes, totalVotes);
    }

    updateAllProgressBars();
  }
}

function animateVoteCountChange(candidateId, oldValue, newValue) {
  const voteCountEl = document.getElementById(`vote-count-${candidateId}`);
  const cardEl = document.querySelector(`[data-candidate-id="${candidateId}"]`);

  if (!voteCountEl) return;

  // Prevent multiple animations on the same element
  if (isAnimating.get(`vote-${candidateId}`)) return;
  isAnimating.set(`vote-${candidateId}`, true);

  // Add highlight to card
  if (cardEl) {
    cardEl.classList.add("updating", "card-highlight");
  }

  // Counter animation
  const duration = 1000;
  const startTime = performance.now();
  const difference = newValue - oldValue;

  function updateCounter(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out cubic)
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(oldValue + difference * easedProgress);

    voteCountEl.textContent = currentValue.toLocaleString("id-ID");

    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    } else {
      // Animation complete
      voteCountEl.textContent = newValue.toLocaleString("id-ID");
      voteCountEl.classList.add("vote-count-animate", "sparkle-effect");

      // Remove animation classes after animation completes
      setTimeout(() => {
        voteCountEl.classList.remove("vote-count-animate", "sparkle-effect");
        if (cardEl) {
          cardEl.classList.remove("updating", "card-highlight");
        }
        isAnimating.set(`vote-${candidateId}`, false);
      }, 800);
    }
  }

  requestAnimationFrame(updateCounter);
}

function animateProgressBarChange(candidateId, oldPercentage, newPercentage) {
  const candidateIndex = candidatesData.findIndex((c) => c.id === candidateId);
  if (candidateIndex === -1) return;

  const progressBar = document.querySelector(
    `[data-candidate-id="${candidateId}"] .progress-bar`
  );

  if (!progressBar) return;

  // Prevent multiple animations
  if (isAnimating.get(`progress-${candidateId}`)) return;
  isAnimating.set(`progress-${candidateId}`, true);

  // Add glow effect to percentage text
  progressBar.classList.add("percentage-glow");

  // Animate width change
  const duration = 1200;
  const startTime = performance.now();
  const difference = newPercentage - oldPercentage;

  function updateProgress(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-in-out cubic)
    const easedProgress =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const currentPercentage = oldPercentage + difference * easedProgress;

    progressBar.style.width = `${currentPercentage}%`;
    progressBar.setAttribute("aria-valuenow", currentPercentage);
    progressBar.textContent = `${currentPercentage.toFixed(1)}%`;

    if (progress < 1) {
      requestAnimationFrame(updateProgress);
    } else {
      // Animation complete
      progressBar.style.width = `${newPercentage}%`;
      progressBar.setAttribute("aria-valuenow", newPercentage);
      progressBar.textContent = `${newPercentage.toFixed(1)}%`;

      setTimeout(() => {
        progressBar.classList.remove("percentage-glow");
        isAnimating.set(`progress-${candidateId}`, false);
      }, 1500);
    }
  }

  requestAnimationFrame(updateProgress);
}

function updateVoteCountDisplay(candidateId, totalVotes) {
  const voteCountEl = document.getElementById(`vote-count-${candidateId}`);
  if (voteCountEl && !isAnimating.get(`vote-${candidateId}`)) {
    voteCountEl.textContent = totalVotes.toLocaleString("id-ID");
  }
}

function updateProgressBar(candidateId, percentage) {
  const candidateIndex = candidatesData.findIndex((c) => c.id === candidateId);
  if (candidateIndex === -1) return;

  const progressBar = document.querySelector(
    `[data-candidate-id="${candidateId}"] .progress-bar`
  );
  if (progressBar && !isAnimating.get(`progress-${candidateId}`)) {
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute("aria-valuenow", percentage);
    progressBar.textContent = `${percentage.toFixed(1)}%`;
  }
}

function updateAllProgressBars() {
  candidatesData.forEach((candidate, index) => {
    const percentage = percentages[index] || 0;
    updateProgressBar(candidate.id, percentage);
  });
}

function updateAllVoteDisplays() {
  candidatesData.forEach((candidate, index) => {
    const voteCount = votesData[index] || 0;
    updateVoteCountDisplay(candidate.id, voteCount);
  });
}

function updateConnectionStatus(isConnected) {
  const statusEl = document.getElementById("connection-status");
  if (statusEl) {
    statusEl.className = isConnected ? "badge bg-success" : "badge bg-danger";
    statusEl.textContent = isConnected ? "Terhubung" : "Terputus";

    // Add pulse animation for connection status changes
    statusEl.style.animation = "none";
    setTimeout(() => {
      statusEl.style.animation = "numberPulse 0.6s ease-in-out";
    }, 10);
  }
}

export async function loadVotingResults() {
  try {
    const resultsContainer = document.getElementById("results-container");
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <p class="text-center text-muted">
          <i class="bi bi-hourglass-split me-2"></i>Mengambil data hasil voting...
        </p>
      `;
    }

    const candidatesResponse = await getAllCandidates();
    if (!candidatesResponse.success) {
      showError("Gagal memuat data kandidat: " + candidatesResponse.message);
      return;
    }

    candidatesData = [...candidatesResponse.data].sort(
      (a, b) => a.number - b.number
    );

    if (!candidatesData || candidatesData.length === 0) {
      showError("Tidak ada data kandidat yang tersedia.");
      return;
    }

    votesData = new Array(candidatesData.length).fill(0);
    percentages = new Array(candidatesData.length).fill("0.0");

    for (let i = 0; i < candidatesData.length; i++) {
      const candidate = candidatesData[i];
      try {
        const voteResponse = await getVotesByCandidate(candidate.id);
        votesData[i] = voteResponse.success
          ? Number(voteResponse.data?.total_votes || 0)
          : 0;
      } catch (error) {
        console.error(
          `Error loading votes for candidate ${candidate.id}:`,
          error
        );
        votesData[i] = 0;
      }
    }

    const totalVotes = votesData.reduce((sum, current) => sum + current, 0);
    percentages = votesData.map((votes) =>
      totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : "0.0"
    );

    updateVoteCounts(candidatesData, votesData, percentages);
  } catch (error) {
    console.error("Error loading voting results:", error);
    showError("Terjadi kesalahan saat memuat hasil pemilihan.");
  }
}

function updateVoteCounts(candidates, voteCounts, percentages) {
  const resultsContainer = document.getElementById("results-container");
  if (!resultsContainer) return;

  resultsContainer.innerHTML = "";

  const statusIndicator = document.createElement("div");
  statusIndicator.className =
    "d-flex justify-content-between align-items-center";

  resultsContainer.appendChild(statusIndicator);

  candidates.forEach((candidate, index) => {
    let photoUrl = candidate.photo_url?.startsWith("http")
      ? candidate.photo_url
      : `${BASE_PUBLIC_FILE_URL}/${
          candidate.photo_url || candidate.photo_key || "placeholder-image.png"
        }`;

    const voteCount = voteCounts[index];
    const percentage = percentages[index];

    const card = document.createElement("div");
    card.className = "result-box";
    card.dataset.candidateId = candidate.id;

    card.innerHTML = `
      <h4 class="text-center">Pasangan ${candidate.number}</h4>
      <img src="${photoUrl}" alt="Foto Kandidat" onerror="this.onerror=null; this.src='placeholder-image.png';">
      <div class="names-row">
        <div class="candidate-name">${candidate.president} <span class="nim">(${
      candidate.president_nim
    })</span></div>
        <div class="candidate-name">${candidate.vice} <span class="nim">(${
      candidate.vice_nim
    })</span></div>
      </div>
      <div class="votes-text">
      <i class="fas fa-users"></i>
        <span id="vote-count-${
          candidate.id
        }" class="vote-count number-counter">${voteCount.toLocaleString(
      "id-ID"
    )}</span>Suara
      </div>
      <div class="progress">
        <div class="progress-bar bg-${getColorClass(
          index
        )}" role="progressbar" style="width: ${percentage}%" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
          ${percentage}%
        </div>
      </div>
    `;

    resultsContainer.appendChild(card);

    // Add entrance animation
    setTimeout(() => {
      card.style.opacity = "0";
      card.style.transform = "translateY(20px)";
      card.style.transition = "all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

      requestAnimationFrame(() => {
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      });
    }, index * 100);
  });

  updateLastRefreshTime();
}

function updateLastRefreshTime() {
  const timeEl = document.getElementById("last-update-time");
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = `Terakhir diperbarui: ${now.toLocaleTimeString(
      "id-ID"
    )}`;
  }
}

function getColorClass(index) {
  const colors = ["success", "primary", "danger", "warning", "info"];
  return colors[index % colors.length];
}

function showError(message) {
  const resultsContainer = document.getElementById("results-container");
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        ${message}
      </div>
    `;
  }
}

export async function refreshVotingData() {
  await loadVotingResults();
}

export function cleanup() {
  if (wsConnection) {
    wsConnection.close(1000, "Page cleanup");
    wsConnection = null;
  }

  // Clear animation states
  animationQueue.clear();
  isAnimating.clear();
}
