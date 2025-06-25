// ======================= IMPORT API =======================
import {
  getAllCandidates,
  getCandidateById,
  getPresignedUrl,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  uploadFile,
  BASE_PUBLIC_FILE_URL,
} from "./candidates_api.js";

import { voteForCandidate, checkVoteStatus } from "./votes_api.js";

// ======================= GLOBAL VARIABLES =======================
let editingCandidateId = null; // To track which candidate is being edited
let userHasVoted = false; // To track if user has already voted
// ======================= BIND EVENT SAAT DOM SIAP =======================
document.addEventListener("DOMContentLoaded", () => {
  // Menampilkan tahun di elemen dengan id "electionPeriod"
  const electionPeriodElement = document.getElementById("electionPeriod");
  if (electionPeriodElement) {
    const currentYear = new Date().getFullYear();
    // Changed to add 1 year to both start and end year
    electionPeriodElement.textContent = `${currentYear + 1}/${currentYear + 2}`;
  }

  // Initialize both views
  initializeApp();
});

// ======================= SHOW TOAST =======================
// Modified showToast function to respect the lock
function showToast(message, type = "success") {
  // If toast is locked, don't show new toasts
  if (window._toastLocked) return;

  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.className = `toast ${type} show`;
  toast.textContent = message;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
// ======================= SHOW CONFIRM TOAST =======================
function showConfirmToast(message) {
  return new Promise((resolve) => {
    const confirmToast = document.getElementById("confirm-toast");
    const confirmMessage = document.getElementById("confirm-message");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    if (!confirmToast || !confirmMessage || !yesBtn || !noBtn) {
      return resolve(false);
    }

    // Tampilkan toast: hapus hidden, lalu trigger animasi show
    confirmMessage.textContent = message;
    confirmToast.classList.remove("hidden");

    // Delay sedikit agar transisi animasi bisa aktif
    setTimeout(() => {
      confirmToast.classList.add("show");
    }, 10);

    const cleanup = () => {
      // Mulai animasi keluar
      confirmToast.classList.remove("show");

      // Setelah animasi selesai (300ms), sembunyikan elemen
      setTimeout(() => {
        confirmToast.classList.add("hidden");
        document.removeEventListener("mousedown", onOutsideClick);
        yesBtn.removeEventListener("click", onYes);
        noBtn.removeEventListener("click", onNo);
      }, 300);
    };

    const onYes = () => {
      cleanup();
      resolve(true);
    };
    const onNo = () => {
      cleanup();
      resolve(false);
    };

    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);

    const onOutsideClick = (event) => {
      if (!confirmToast.contains(event.target)) {
        cleanup();
        resolve(false); // anggap user memilih "Tidak"
      }
    };

    setTimeout(() => {
      document.addEventListener("mousedown", onOutsideClick);
    }, 50);
  });
}

async function checkUserVoteStatus(period = null) {
  try {
    const response = await checkVoteStatus(period);
    if (response.success && response.data) {
      userHasVoted = response.data.has_voted || false;
    }
  } catch (error) {
    // Set default tanpa log error 400
    userHasVoted = false;
    // Hanya log jika bukan 400 error
    if (
      !error.message.includes("400") &&
      !error.message.includes("Bad Request")
    ) {
      console.warn("Vote status check failed:", error.message);
    }
  }
}
// ======================= INITIALIZE APP =======================
export function initializeApp() {
  // Check vote status saat app dimulai
  checkUserVoteStatus();
  // Load candidates for public view
  // Load candidates for public view
  const publicContainer = document.getElementById("candidateList");
  if (publicContainer) {
    loadCandidates(); // Load default candidates
  }
  const publicAdminContainer = document.getElementById("candidateAdminList");
  if (publicAdminContainer) {
    populatePeriodSelector(); // Tambahkan ini
    loadAdminCandidates(); //// Load default candidates
  }

  // Load candidates for admin view
  const adminContainer = document.getElementById("adminCandidateList");
  if (adminContainer) {
    populateAdminPeriodSelector(); // Add this line
    loadCandidatesAdmin(); // Load default candidates
  }

  // Set up form submission handler
  const form = document.getElementById("candidateForm");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);

    // Add reset handler to clear editing state
    form.addEventListener("reset", () => {
      editingCandidateId = null;
      document.getElementById("formTitle").textContent = "Tambah Kandidat Baru";
      document.getElementById("submitBtn").textContent = "Simpan";

      // Clear photo preview
      const photoPreview = document.getElementById("photoPreview");
      if (photoPreview) {
        photoPreview.style.display = "none";
        photoPreview.src = "";
      }
    });
  }

  // ======================= PERBAIKAN 2: File Upload Validation =======================
  async function validateAndUploadFile(file) {
    // ✅ Validasi file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

    if (!file) {
      throw new Error("File tidak boleh kosong");
    }

    if (file.size > maxSize) {
      throw new Error("Ukuran file tidak boleh lebih dari 5MB");
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error("Format file harus JPEG, PNG, JPG, atau WebP");
    }

    // Lanjutkan dengan upload jika validasi passed
    const uniqueFilename = `${Date.now()}-${file.name}`;
    const presignedRes = await getPresignedUrl(uniqueFilename);

    if (!presignedRes?.success || !presignedRes.data?.url) {
      throw new Error("Gagal mendapatkan URL upload");
    }

    return { presignedRes, uniqueFilename };
  }
  // Set up file input preview
  const photoInput = document.getElementById("photo");
  const photoPreview = document.getElementById("photoPreview");
  if (photoInput && photoPreview) {
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          photoPreview.src = e.target.result;
          photoPreview.style.display = "block";
        };
        reader.readAsDataURL(file);
      } else {
        photoPreview.style.display = "none";
      }
    });
  }

  // Add modal functions to window
  window.showCandidateDetail = showCandidateDetail;
  window.closeModal = closeModal;
  window.handleVoteClick = handleVoteClick;
}

// ======================= HANDLE SUBMIT FORM =======================
async function handleFormSubmit(e) {
  showToast("Membuat kandidat...", "info");
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  // Basic form validation
  const requiredFields = [
    "number",
    "president",
    "vice",
    "president_nim",
    "vice_nim",
    "vision",
  ];

  for (const field of requiredFields) {
    if (!formData.get(field) || formData.get(field).trim() === "") {
      showToast(`Field ${field} wajib diisi`, "error");
      return;
    }
  }

  // Get candidate data from form
  const candidateData = {
    number: Number(formData.get("number")),
    president: formData.get("president").trim(),
    vice: formData.get("vice").trim(),
    vision: formData.get("vision").trim(),
    mission: formData
      .get("mission")
      .split("\n")
      .filter((m) => m.trim() !== ""),
    president_study_program: formData.get("president_study_program").trim(),
    vice_study_program: formData.get("vice_study_program").trim(),
    president_nim: formData.get("president_nim").trim(),
    vice_nim: formData.get("vice_nim").trim(),
  };

  try {
    // If we're editing an existing candidate
    if (editingCandidateId) {
      const file = formData.get("photo");

      // If a new photo was selected, upload it
      if (file && file.size > 0) {
        showToast("Mengupload foto baru...", "info");

        try {
          // Generate a unique filename to avoid caching issues
          const uniqueFilename = `${Date.now()}-${file.name}`;
          const presignedRes = await getPresignedUrl(uniqueFilename);

          if (!presignedRes?.success) {
            throw new Error(
              presignedRes.message || "Failed to get presigned URL"
            );
          }

          // Pastikan data dan url ada dalam respons
          if (!presignedRes.data || !presignedRes.data.url) {
            throw new Error("Format response presigned URL tidak valid");
          }

          const uploadUrl = presignedRes.data.url;
          const photoKey = presignedRes.data.key || `2026/${uniqueFilename}`;

          // Lakukan upload dengan parameter minimal
          const uploaded = await uploadFile(uploadUrl, file);

          if (!uploaded) {
            throw new Error("Upload gagal. Coba lagi atau gunakan file lain.");
          }

          // Jika berhasil, masukkan photo_key ke dalam candidateData

          candidateData.photo_key = photoKey;
        } catch (uploadError) {
          showToast(`Upload gagal: ${uploadError.message}`, "error");

          return;
        }
      }

      // Update the candidate
      try {
        const updateRes = await updateCandidate(
          editingCandidateId,
          candidateData
        );

        if (!updateRes.success) {
          throw new Error(updateRes.message || "Failed to update candidate");
        }

        showToast("Kandidat berhasil diperbarui!", "success");
      } catch (updateError) {
        showToast(`Update gagal: ${updateError.message}`, "error");

        return;
      }
    }
    // Creating a new candidate
    else {
      const file = formData.get("photo");

      // Photo validation
      if (!file || file.size === 0) {
        showToast("Foto kandidat wajib diisi", "error");
        return;
      }

      try {
        // Generate a unique filename to avoid caching issues
        const uniqueFilename = `${Date.now()}-${file.name}`;
        const presignedRes = await getPresignedUrl(uniqueFilename);

        if (!presignedRes?.success) {
          throw new Error(
            presignedRes.message || "Failed to get presigned URL"
          );
        }

        if (!presignedRes.data || !presignedRes.data.url) {
          throw new Error("Format response presigned URL tidak valid");
        }

        const uploadUrl = presignedRes.data.url;
        const photoKey = presignedRes.data.key || `2026/${uniqueFilename}`;

        // Lakukan upload dengan fungsi yang sudah diperbaiki
        const uploaded = await uploadFile(uploadUrl, file);

        if (!uploaded) {
          throw new Error("Upload gagal. Coba lagi atau gunakan file lain.");
        }

        // Jika berhasil, masukkan photo_key ke dalam candidateData

        candidateData.photo_key = photoKey;
      } catch (uploadError) {
        showToast(`Upload gagal: ${uploadError.message}`, "error");

        return;
      }

      // Create the candidate
      try {
        showToast("Membuat kandidat...", "info");

        const createRes = await createCandidate(candidateData);

        if (!createRes.success) {
          throw new Error(createRes.message || "Failed to create candidate");
        }

        showToast("Kandidat berhasil dibuat!", "success");
      } catch (createError) {
        showToast(`Pembuatan kandidat gagal: ${createError.message}`, "error");

        return;
      }
    }

    // Reset form
    form.reset();
    editingCandidateId = null;
    document.getElementById("formTitle").textContent = "Tambah Kandidat Baru";
    document.getElementById("submitBtn").textContent = "Simpan";

    const photoPreview = document.getElementById("photoPreview");
    if (photoPreview) {
      photoPreview.style.display = "none";
      photoPreview.src = "";
    }

    // PENTING: Update period selector setelah create/update
    await populatePeriodSelector();
    await populateAdminPeriodSelector();

    // PENTING: Reload candidate lists dengan period yang sedang dipilih
    const currentPeriod = document.getElementById("periodSelect")?.value;
    const currentAdminPeriod =
      document.getElementById("adminPeriodSelect")?.value;

    await loadCandidates(currentPeriod || null);
    await loadCandidatesAdmin(currentAdminPeriod || null);
    await loadAdminCandidates(currentAdminPeriod || null);
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}

/**
 * Generate array of periods starting from 2026 for the next 10 years
 * @returns {Array} Array of years from 2026 to 2035
 */
// 1. Update fungsi generateDynamicPeriods untuk format "YYYY/YYYY+1"
function generateDynamicPeriods() {
  const startYear = 2026;
  const yearCount = 10;
  const periods = [];

  for (let i = 0; i < yearCount; i++) {
    const year = startYear + i;
    periods.push(`${year}/${year + 1}`);
  }

  return periods;
}

// ======================= PERBAIKAN 2: PERSISTENCE SELECTED PERIOD =======================

// PERBAIKAN: Fungsi untuk save/load selected period
function saveSelectedPeriod(selectId, period) {
  // Gunakan sessionStorage untuk persistence dalam session
  sessionStorage.setItem(`selected_period_${selectId}`, period || "");
}

function loadSelectedPeriod(selectId) {
  return sessionStorage.getItem(`selected_period_${selectId}`) || "";
}
// 2. Update populatePeriodSelector - bagian extract existing periods
async function populatePeriodSelector() {
  try {
    const res = await getAllCandidates();

    if (!res.success || !res.data) {
      populateEmptyPeriodSelector("periodSelect");
      return;
    }

    // Extract unique periods dari data kandidat yang ada
    const existingPeriods = [
      ...new Set(
        res.data.map((candidate) => {
          const year = new Date(candidate.created_at).getFullYear();
          const nextYear = year + 1;
          return `${nextYear}/${nextYear + 1}`;
        })
      ),
    ];

    // Generate dynamic periods (2026/2027 - 2035/2036)
    const dynamicPeriods = generateDynamicPeriods();

    // Gabungkan existing periods dengan dynamic periods, lalu sort
    const allPeriods = [
      ...new Set([...existingPeriods, ...dynamicPeriods]),
    ].sort();

    const select = document.getElementById("periodSelect");
    if (!select) return;

    const savedPeriod = loadSelectedPeriod("periodSelect");

    select.innerHTML = '<option value="">Semua Periode</option>';

    allPeriods.forEach((period) => {
      const option = document.createElement("option");
      option.value = period;

      const hasCandidates = existingPeriods.includes(period);
      option.textContent = hasCandidates
        ? period
        : `${period} (Belum ada kandidat)`;

      if (!hasCandidates) {
        option.className = "no-candidates";
      }

      select.appendChild(option);
    });

    // Set default period
    if (savedPeriod && allPeriods.includes(savedPeriod)) {
      select.value = savedPeriod;
    } else if (savedPeriod === "") {
      select.value = "";
    } else {
      const defaultPeriod = "2026/2027";
      select.value = defaultPeriod;
      saveSelectedPeriod("periodSelect", defaultPeriod);
    }

    // Event listener tetap sama, hanya update header title
    if (!select.hasAttribute("data-listener-added")) {
      select.setAttribute("data-listener-added", "true");

      select.addEventListener("change", (e) => {
        const selectedPeriod = e.target.value;
        saveSelectedPeriod("periodSelect", selectedPeriod);

        const periodToPass =
          selectedPeriod && selectedPeriod.trim() !== ""
            ? selectedPeriod
            : null;
        loadCandidates(periodToPass);
        loadAdminCandidates(periodToPass);
        loadCandidatesAdmin(periodToPass);

        // Update header title
        const headerTitle = document.querySelector(".header-title");
        if (headerTitle) {
          const baseTitleText = "Pemilihan HIMA TI";
          const displayPeriod = selectedPeriod || "2026/2027";
          headerTitle.innerHTML = `${baseTitleText} <span id="electionPeriod">${displayPeriod}</span>`;
        }
      });
    }

    const initialPeriod =
      select.value && select.value.trim() !== "" ? select.value : null;
    loadCandidates(initialPeriod);
    loadAdminCandidates(initialPeriod);
  } catch (error) {
    populateEmptyPeriodSelector("periodSelect");
  }
}

// ======================= UPDATED LOAD CANDIDATES WITH BETTER MESSAGING =======================
// ======================= FIXED LOAD CANDIDATES WITH PROPER TOAST LOGIC =======================
export async function loadCandidates(period = null) {
  const container = document.getElementById("candidateList");
  if (!container) return;

  try {
    // Ambil SEMUA data dulu, lalu filter di frontend
    const res = await getAllCandidates();

    if (!res.success || !res.data || res.data == null) {
      container.innerHTML = `<div class='no-data'>
        <i class='bi bi-exclamation-circle'></i>
        <p>Gagal mengambil data kandidat</p>
      </div>`;
      showToast("Gagal mengambil data kandidat", "error");
      return;
    }

    let filteredData = res.data;

    // Filter berdasarkan period di frontend
    if (period && period.trim() !== "") {
      filteredData = res.data.filter((candidate) => {
        const candidateYear = new Date(candidate.created_at).getFullYear();
        const nextYear = candidateYear + 1;
        const candidatePeriod = `${nextYear}/${nextYear + 1}`;
        return candidatePeriod === period;
      });
    }

    container.innerHTML = "";

    // ===== FIX: Jangan tampilkan toast sukses jika tidak ada kandidat =====
    if (filteredData.length === 0) {
      let noCandidateMsg;
      if (period && period.trim() !== "") {
        noCandidateMsg = `
          <div class='no-data'>
            <i class='bi bi-calendar-x'></i>
            <h3>Belum Ada Kandidat</h3>
            <p>Belum ada kandidat yang terdaftar untuk periode ${period}.</p>
            <small>Silakan pilih periode lain atau tunggu hingga ada kandidat yang mendaftar.</small>
          </div>`;

        // ===== FIX: Toast untuk periode kosong =====
        showToast(`Tidak ada kandidat untuk periode ${period}`, "warning");
      } else {
        noCandidateMsg = `
          <div class='no-data'>
            <i class='bi bi-person-x'></i>
            <h3>Tidak Ada Kandidat</h3>
            <p>Belum ada kandidat yang terdaftar dalam sistem.</p>
            <small>Silakan hubungi administrator untuk informasi lebih lanjut.</small>
          </div>`;

        // ===== FIX: Toast untuk sistem kosong =====
        showToast("Belum ada kandidat yang terdaftar dalam sistem", "warning");
      }
      container.innerHTML = noCandidateMsg;
      return; // ===== PENTING: Return di sini, jangan lanjut ke toast sukses =====
    }

    // Sort candidates by number before displaying
    const sortedCandidates = [...filteredData].sort(
      (a, b) => a.number - b.number
    );

    // Render candidates
    const candidatesGrid = document.createElement("div");
    candidatesGrid.className = "row g-4 justify-content-center";

    sortedCandidates.forEach((candidate) => {
      // Proper image URL handling
      let photoUrl;
      if (candidate.photo_url) {
        if (candidate.photo_url.startsWith("http")) {
          photoUrl = candidate.photo_url;
        } else {
          photoUrl = `${BASE_PUBLIC_FILE_URL}/${candidate.photo_url}`;
        }
      } else if (candidate.photo_key) {
        photoUrl = `${BASE_PUBLIC_FILE_URL}/${candidate.photo_key}`;
      } else {
        photoUrl = "/public/assets/placeholder-image.jpg";
      }

      // Function untuk render tombol vote berdasarkan status
      function renderVoteButton(candidateId) {
        if (userHasVoted) {
          return `<div class="voted-message">
            <i class="bi bi-check-circle-fill text-success me-1"></i>
            <span class="text-muted">Anda sudah memilih</span>
          </div>`;
        } else {
          return `<button class="coblos-button" data-id="${candidateId}">
            <i class="bi bi-crosshair me-1"></i> Coblos
          </button>`;
        }
      }

      const col = document.createElement("div");
      col.className = "col-12 col-sm-6 col-lg-4 d-flex justify-content-center";

      const card = document.createElement("div");
      card.className = "candidate-card";

      card.innerHTML = `
  <div class="candidate-number">${candidate.number || ""}</div>
  <div class="candidate-photo">
    <img src="${photoUrl}" alt="Foto Kandidat" onerror="this.onerror=null; this.src='/public/assets/placeholder-image.jpg';">
  </div>
  <div class="candidate-info-simple">
    <div class="candidate-pair">
      <div class="candidate-block">
        <div class="role-label">Calon Ketua</div>
        <span class="candidate-president">${candidate.president || ""}</span>
      </div>
      <div class="candidate-block">
        <div class="role-label">Calon Wakil Ketua</div>
        <span class="candidate-vice">${candidate.vice || ""}</span>
      </div>
    </div>
  </div>
  <div class="card-footer">
    ${renderVoteButton(candidate.id)}
  </div>
`;

      col.appendChild(card);
      candidatesGrid.appendChild(col);
    });

    container.appendChild(candidatesGrid);

    // Add the modal HTML to the page
    if (!document.getElementById("candidateDetailModal")) {
      const modalHTML = `
    <div id="candidateDetailModal" class="modal">
      <div class="modal-content">
        <div id="modalContent"></div>
        <button class="modal-close-btn" onclick="closeModal()">Tutup</button>
      </div>
    </div>
  `;
      document.body.insertAdjacentHTML("beforeend", modalHTML);

      document.addEventListener("click", function (event) {
        const modal = document.getElementById("candidateDetailModal");
        const modalContent = document.querySelector(".modal-content");

        // Jika modal terbuka dan klik terjadi di luar modalContent
        if (
          modal &&
          modal.style.display === "block" &&
          !modalContent.contains(event.target) &&
          !event.target.closest(".candidate-photo") // Cegah dari penutup modal saat klik gambar
        ) {
          closeModal();
        }
      });
    }

    // Add event listeners
    const candidatePhotos = container.querySelectorAll(".candidate-photo img");
    candidatePhotos.forEach((img, index) => {
      img.addEventListener("click", () => {
        showCandidateDetail(sortedCandidates[index], img.src);
      });
    });

    // Check vote status untuk periode tertentu
    await checkUserVoteStatus(period);

    // Update event listeners untuk vote buttons
    if (!userHasVoted) {
      const voteButtons = container.querySelectorAll(".coblos-button");
      voteButtons.forEach((button) => {
        button.addEventListener("click", handleVoteClick);
      });
    }

    // ===== FIX: Toast sukses hanya muncul jika ADA kandidat yang berhasil dimuat =====
    const successMsg =
      period && period.trim() !== ""
        ? `Data kandidat periode ${period} berhasil dimuat (${filteredData.length} kandidat)`
        : `Data kandidat berhasil dimuat (${filteredData.length} kandidat)`;
    showToast(successMsg, "success");
  } catch (error) {
    container.innerHTML = `<div class='no-data'>
      <i class='bi bi-exclamation-triangle'></i>
      <p>Terjadi kesalahan saat memuat data</p>
      <small>${error.message}</small>
    </div>`;
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}
// ======================= FIXED LOAD ADMIN CANDIDATES =======================
export async function loadAdminCandidates(period = null) {
  const container = document.getElementById("candidateAdminList");
  if (!container) return;

  try {
    // Ambil SEMUA data dulu, lalu filter di frontend
    const res = await getAllCandidates();

    if (!res.success || !res.data || res.data == null) {
      container.innerHTML = `<div class='no-data'>
        <i class='bi bi-exclamation-circle'></i>
        <p>Gagal mengambil data kandidat</p>
      </div>`;
      showToast("Gagal mengambil data kandidat", "error");
      return;
    }

    let filteredData = res.data;

    // Filter berdasarkan period di frontend
    if (period && period.trim() !== "") {
      filteredData = res.data.filter((candidate) => {
        const candidateYear = new Date(candidate.created_at).getFullYear();
        const nextYear = candidateYear + 1;
        const candidatePeriod = `${nextYear}/${nextYear + 1}`;
        return candidatePeriod === period;
      });
    }

    container.innerHTML = "";

    // ===== FIX: Jangan tampilkan toast sukses jika tidak ada kandidat =====
    if (filteredData.length === 0) {
      let noCandidateMsg;
      if (period && period.trim() !== "") {
        noCandidateMsg = `
          <div class='no-data'>
            <i class='bi bi-calendar-x'></i>
            <h3>Belum Ada Kandidat</h3>
            <p>Belum ada kandidat yang terdaftar untuk periode ${period}.</p>
            <small>Silakan pilih periode lain atau tunggu hingga ada kandidat yang mendaftar.</small>
          </div>`;

        // ===== FIX: Toast untuk periode kosong =====
        showToast(`Tidak ada kandidat untuk periode ${period}`, "warning");
      } else {
        noCandidateMsg = `
          <div class='no-data'>
            <i class='bi bi-person-x'></i>
            <h3>Tidak Ada Kandidat</h3>
            <p>Belum ada kandidat yang terdaftar dalam sistem.</p>
            <small>Silakan hubungi administrator untuk informasi lebih lanjut.</small>
          </div>`;

        // ===== FIX: Toast untuk sistem kosong =====
        showToast("Belum ada kandidat yang terdaftar dalam sistem", "warning");
      }
      container.innerHTML = noCandidateMsg;
      return; // ===== PENTING: Return di sini, jangan lanjut ke toast sukses =====
    }

    // Sort candidates by number before displaying
    const sortedCandidates = [...filteredData].sort(
      (a, b) => a.number - b.number
    );

    // Render candidates
    const candidatesGrid = document.createElement("div");
    candidatesGrid.className = "row g-4 justify-content-center";

    sortedCandidates.forEach((candidate) => {
      // Proper image URL handling
      let photoUrl;
      if (candidate.photo_url) {
        if (candidate.photo_url.startsWith("http")) {
          photoUrl = candidate.photo_url;
        } else {
          photoUrl = `${BASE_PUBLIC_FILE_URL}/${candidate.photo_url}`;
        }
      } else if (candidate.photo_key) {
        photoUrl = `${BASE_PUBLIC_FILE_URL}/${candidate.photo_key}`;
      } else {
        photoUrl = "/public/assets/placeholder-image.jpg";
      }

      const col = document.createElement("div");
      col.className = "col-12 col-sm-6 col-lg-4 d-flex justify-content-center";

      const card = document.createElement("div");
      card.className = "candidate-card";

      card.innerHTML = `
      <div class="candidate-number">${candidate.number || ""}</div>
      <div class="candidate-photo">
        <img src="${photoUrl}" alt="Foto Kandidat" onerror="this.onerror=null; this.src='/public/assets/placeholder-image.jpg';">
      </div>
      <div class="candidate-info-simple">
        <div class="candidate-pair">
          <div class="candidate-block">
            <div class="role-label">Calon Ketua</div>
            <span class="candidate-president">${
              candidate.president || ""
            }</span>
          </div>
          <div class="candidate-block">
            <div class="role-label">Calon Wakil Ketua</div>
            <span class="candidate-vice">${candidate.vice || ""}</span>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="coblos-button" data-id="${
          candidate.id
        }"><i class="bi bi-crosshair me-1"></i> Coblos</button>
      </div>
      `;

      col.appendChild(card);
      candidatesGrid.appendChild(col);
    });

    container.appendChild(candidatesGrid);

    // Add the modal HTML to the page
    if (!document.getElementById("candidateDetailModal")) {
      const modalHTML = `
        <div id="candidateDetailModal" class="modal">
          <div class="modal-content">
            <div id="modalContent"></div>
            <button class="modal-close-btn" onclick="closeModal()">Tutup</button>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML("beforeend", modalHTML);

      document.addEventListener("click", function (event) {
        const modal = document.getElementById("candidateDetailModal");
        const modalContent = document.querySelector(".modal-content");

        // Jika modal terbuka dan klik terjadi di luar modalContent
        if (
          modal &&
          modal.style.display === "block" &&
          !modalContent.contains(event.target) &&
          !event.target.closest(".candidate-photo") // Cegah dari penutup modal saat klik gambar
        ) {
          closeModal();
        }
      });
    }

    // Add event listeners
    const candidatePhotos = container.querySelectorAll(".candidate-photo img");
    candidatePhotos.forEach((img, index) => {
      img.addEventListener("click", () => {
        showCandidateDetail(sortedCandidates[index], img.src);
      });
    });

    const voteButtons = container.querySelectorAll(".coblos-button");
    voteButtons.forEach((button) => {
      button.addEventListener("click", handleVoteClick);
    });
  } catch (error) {
    container.innerHTML = `<div class='no-data'>
      <i class='bi bi-exclamation-triangle'></i>
      <p>Terjadi kesalahan saat memuat data</p>
      <small>${error.message}</small>
    </div>`;
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}

// Function to handle vote button click
// Fixed handleVoteClick function for voting functionality

// ===============================

//VOTES API HANDLING AND RENDERING

//================================

/**
 * Function to handle vote button click
 * @param {Event} event - The click event
 */
// ======================= UPDATE HANDLE VOTE CLICK =======================
async function handleVoteClick(event) {
  event.preventDefault();

  // Check if user has already voted
  if (userHasVoted) {
    showToast("Anda sudah pernah memilih sebelumnya", "error");
    return;
  }

  const candidateId = event.target.dataset.id;
  if (!candidateId) {
    showToast("Error: ID kandidat tidak ditemukan", "error");
    return;
  }

  // 🔔 Konfirmasi sebelum voting
  const confirmed = await showConfirmToast("Yakin ingin memilih kandidat ini?");
  if (!confirmed) return;

  // 🔒 Lock tombol agar tidak bisa diklik lagi
  event.target.disabled = true;

  // 💾 Simpan konten asli tombol (dengan icon)
  const originalHTML = event.target.innerHTML;

  // 🔄 Ubah tampilan tombol saat loading
  event.target.innerHTML =
    '<i class="bi bi-hourglass-split me-1"></i> Mencoblos...';

  try {
    // 🚀 Kirim vote ke API
    const response = await voteForCandidate(candidateId);

    if (response.success) {
      // ✅ Update status global
      userHasVoted = true;

      showToast("Vote berhasil! Halaman akan dimuat ulang...", "success");

      // Reload semua candidate lists untuk update tampilan
      setTimeout(async () => {
        const currentPeriod = document.getElementById("periodSelect")?.value;
        const currentAdminPeriod =
          document.getElementById("adminPeriodSelect")?.value;

        await loadCandidates(currentPeriod || null);
        await loadCandidatesAdmin(currentAdminPeriod || null);
        await loadAdminCandidates(currentPeriod || null);
      }, 1500);
    } else {
      showToast(`Vote gagal: ${response.message}`, "error");
      // 🔄 Kembalikan tombol ke keadaan semula
      event.target.disabled = false;
      event.target.innerHTML = originalHTML;
    }
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
    // 🔄 Kembalikan tombol ke keadaan semula
    event.target.disabled = false;
    event.target.innerHTML = originalHTML;
  }
}

export { handleVoteClick, showToast };

// Make sure the function is available globally when needed
if (typeof window !== "undefined") {
  window.handleVoteClick = handleVoteClick;
  window.showToast = showToast;
}

// Function to handle vote button click
// Fixed handleVoteClick function for voting functionality

// ====================================

//VOTES API HANDLING AND RENDERING END

//=====================================

// Function to show candidate detail in modal
function showCandidateDetail(candidate, photoUrl) {
  const modal = document.getElementById("candidateDetailModal");
  const modalContent = document.getElementById("modalContent");

  if (!modal || !modalContent) {
    return;
  }

  modalContent.innerHTML = `
    <div class="modal-candidate-detail">
      <div class="modal-title">Kandidat nomor urut ${candidate.number || ""}
        <span class="close-modal" onclick="closeModal()">&times;</span>  
      </div>
      <div class="candidate-photo">
        <img src="${photoUrl}" alt="Foto Kandidat" onerror="this.onerror=null; this.src='/public/assets/placeholder-image.jpg';">
      </div>
      <div class="candidate-info-detail">
        <div class="candidate-main-info">
          <div class="candidate-president-info">
            <h3>${candidate.president || ""}</h3>
            <p class="candidate-nim">${candidate.president_nim || ""}</p>
            <p class="candidate-study">${
              candidate.president_study_program || ""
            }</p>
          </div>
          <div class="candidate-vice-info">
            <h3>${candidate.vice || ""}</h3>
            <p class="candidate-nim">${candidate.vice_nim || ""}</p>
            <p class="candidate-study">${candidate.vice_study_program || ""}</p>
          </div>
        </div>
        <div class="candidate-vision">
          <h4>Visi:</h4>
          <p>${candidate.vision || ""}</p>
        </div>
        <div class="candidate-mission">
          <h4>Misi:</h4>
          <ol>
            ${(candidate.mission || [])
              .map((item) => `<li>${item}</li>`)
              .join("")}
          </ol>
        </div>
      </div>
    </div>
  `;

  modal.style.display = "block";
}

// Function to close the modal
function closeModal() {
  const modal = document.getElementById("candidateDetailModal");
  if (modal) {
    modal.style.display = "none";
  }
}

// ======================= UPDATED POPULATE ADMIN PERIOD SELECTOR =======================
// 4. Update populateAdminPeriodSelector - sama seperti populatePeriodSelector
async function populateAdminPeriodSelector() {
  try {
    const res = await getAllCandidates();

    if (!res.success || !res.data) {
      populateEmptyPeriodSelector("adminPeriodSelect");
      return;
    }

    // Extract unique periods dari data kandidat yang ada
    const existingPeriods = [
      ...new Set(
        res.data.map((candidate) => {
          const year = new Date(candidate.created_at).getFullYear();
          const nextYear = year + 1;
          return `${nextYear}/${nextYear + 1}`;
        })
      ),
    ];

    // Generate dynamic periods (2026/2027 - 2035/2036)
    const dynamicPeriods = generateDynamicPeriods();

    // Gabungkan existing periods dengan dynamic periods, lalu sort
    const allPeriods = [
      ...new Set([...existingPeriods, ...dynamicPeriods]),
    ].sort();

    const select = document.getElementById("adminPeriodSelect");
    if (!select) return;

    const savedPeriod = loadSelectedPeriod("adminPeriodSelect");

    select.innerHTML = '<option value="">Semua Periode</option>';

    allPeriods.forEach((period) => {
      const option = document.createElement("option");
      option.value = period;

      const hasCandidates = existingPeriods.includes(period);
      option.textContent = hasCandidates
        ? period
        : `${period} (Belum ada kandidat)`;

      if (!hasCandidates) {
        option.className = "no-candidates";
      }

      select.appendChild(option);
    });

    // Set default
    if (savedPeriod && allPeriods.includes(savedPeriod)) {
      select.value = savedPeriod;
    } else if (savedPeriod === "") {
      select.value = "";
    } else {
      const defaultPeriod = "2026/2027";
      select.value = defaultPeriod;
      saveSelectedPeriod("adminPeriodSelect", defaultPeriod);
    }

    // Event listener
    if (!select.hasAttribute("data-listener-added")) {
      select.setAttribute("data-listener-added", "true");

      select.addEventListener("change", (e) => {
        const selectedPeriod = e.target.value;
        saveSelectedPeriod("adminPeriodSelect", selectedPeriod);

        const periodToPass =
          selectedPeriod && selectedPeriod.trim() !== ""
            ? selectedPeriod
            : null;
        loadCandidatesAdmin(periodToPass);

        // Update header title
        const headerTitle = document.querySelector(".title-card h1 span");
        if (headerTitle) {
          const displayPeriod = selectedPeriod || "2026/2027";
          headerTitle.textContent = displayPeriod;
        }
      });
    }

    const initialPeriod =
      select.value && select.value.trim() !== "" ? select.value : null;
    loadCandidatesAdmin(initialPeriod);
  } catch (error) {
    populateEmptyPeriodSelector("adminPeriodSelect");
  }
}
// ======================= HELPER FUNCTION FOR EMPTY PERIOD SELECTOR =======================
/**
 * Populate period selector when no candidates exist yet
 * @param {string} selectId - ID of the select element
 */
// 6. Update populateEmptyPeriodSelector
function populateEmptyPeriodSelector(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const dynamicPeriods = generateDynamicPeriods();
  const savedPeriod = loadSelectedPeriod(selectId);

  select.innerHTML = '<option value="">Semua Periode</option>';

  dynamicPeriods.forEach((period) => {
    const option = document.createElement("option");
    option.value = period;
    option.textContent = `${period} (Belum ada kandidat)`;
    option.className = "no-candidates";
    select.appendChild(option);
  });

  // Set default
  if (savedPeriod && dynamicPeriods.includes(savedPeriod)) {
    select.value = savedPeriod;
  } else {
    select.value = "2026/2027"; // Default ke 2026/2027
    saveSelectedPeriod(selectId, "2026/2027");
  }

  // Event listener update
  if (!select.hasAttribute("data-listener-added")) {
    select.setAttribute("data-listener-added", "true");

    select.addEventListener("change", (e) => {
      const selectedPeriod = e.target.value;
      saveSelectedPeriod(selectId, selectedPeriod);

      const periodToPass =
        selectedPeriod && selectedPeriod.trim() !== "" ? selectedPeriod : null;

      if (selectId === "periodSelect") {
        loadCandidates(periodToPass);
        loadAdminCandidates(periodToPass);

        const headerTitle = document.querySelector(".header-title");
        if (headerTitle) {
          const baseTitleText = "Pemilihan HIMA TI";
          const displayPeriod = selectedPeriod || "2026/2027";
          headerTitle.innerHTML = `${baseTitleText} <span id="electionPeriod">${displayPeriod}</span>`;
        }
      } else if (selectId === "adminPeriodSelect") {
        loadCandidatesAdmin(periodToPass);

        const headerTitle = document.querySelector(".title-card h1 span");
        if (headerTitle) {
          const displayPeriod = selectedPeriod || "2026/2027";
          headerTitle.textContent = displayPeriod;
        }
      }
    });
  }
}
// ======================= UPDATED LOAD CANDIDATES ADMIN =======================
export async function loadCandidatesAdmin(period = null) {
  const container = document.getElementById("adminCandidateList");
  if (!container) return;

  try {
    // Ambil SEMUA data dulu, lalu filter di frontend
    const res = await getAllCandidates();

    if (!res.success || res.data == null) {
      container.innerHTML = `<div class='no-data'>
        <i class='bi bi-exclamation-circle'></i>
        <p>Gagal mengambil data kandidat</p>
      </div>`;
      showToast("Gagal mengambil data kandidat", "error");
      return;
    }

    let filteredData = res.data;

    // Filter berdasarkan period di frontend
    if (period && period.trim() !== "") {
      filteredData = res.data.filter((candidate) => {
        const candidateYear = new Date(candidate.created_at).getFullYear();
        const nextYear = candidateYear + 1;
        const candidatePeriod = `${nextYear}/${nextYear + 1}`;
        return candidatePeriod === period;
      });
    }
    container.innerHTML = "";

    if (filteredData.length === 0) {
      let noCandidateMsg;
      if (period && period.trim() !== "") {
        noCandidateMsg = `
          <div class='no-data'>
            <i class='bi bi-calendar-x'></i>
            <h3>Belum Ada Kandidat</h3>
            <p>Belum ada kandidat yang terdaftar untuk periode ${period}.</p>
            <small>Anda dapat menambah kandidat baru menggunakan form di atas Atau Bisa Menunggu Tahun Depan.</small>
          </div>`;
      } else {
        noCandidateMsg = `
          <div class='no-data'>
            <i class='bi bi-person-x'></i>
            <h3>Tidak Ada Kandidat</h3>
            <p>Belum ada kandidat yang terdaftar dalam sistem.</p>
            <small>Mulai dengan menambah kandidat baru menggunakan form di atas.</small>
          </div>`;
      }
      container.innerHTML = noCandidateMsg;
      return;
    }

    // Sort candidates by number before displaying
    const sortedCandidates = [...filteredData].sort(
      (a, b) => a.number - b.number
    );

    // Render table (kode table rendering tetap sama seperti sebelumnya)
    const table = document.createElement("table");
    table.className = "candidate-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>No</th>
          <th>Ketua</th>
          <th>Wakil</th>
          <th>Visi</th>
          <th>Misi</th>
          <th>Foto</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    sortedCandidates.forEach((candidate) => {
      let photoUrl;
      if (candidate.photo_url) {
        if (candidate.photo_url.startsWith("http")) {
          photoUrl = candidate.photo_url;
        } else {
          photoUrl = `${BASE_PUBLIC_FILE_URL}/${candidate.photo_url}`;
        }
      } else if (candidate.photo_key) {
        photoUrl = `${BASE_PUBLIC_FILE_URL}/${candidate.photo_key}`;
      } else {
        photoUrl = "/public/assets/placeholder-image.jpg";
      }

      const vision = candidate.vision ?? "";
      const row = document.createElement("tr");
      row.innerHTML = `
      <td class="number">${candidate.number ?? ""}</td>
      <td>${candidate.president ?? ""} (${candidate.president_nim ?? ""})<br>${
        candidate.president_study_program ?? ""
      }</td>
      <td>${candidate.vice ?? ""} (${candidate.vice_nim ?? ""})<br>${
        candidate.vice_study_program ?? ""
      }</td>
      <td title="${vision}">${vision.slice(0, 50)}${
        vision.length > 50 ? "..." : ""
      }</td>
      <td>
        <ol>
          ${(candidate.mission || [])
            .map((item) => `<li>${item}</li>`)
            .join("")}
        </ol>
      </td>
      <td><img src="${photoUrl}" alt="Foto" class="thumbnail" onerror="this.onerror=null; this.src='/public/assets/placeholder-image.jpg';"></td>
      <td>
        <button class="edit-btn btn btn-sm btn-primary" data-id="${
          candidate.id
        }"><i class="bi bi-pencil-square me-1"></i>Edit</button>
        <button class="delete-btn btn btn-sm btn-danger" data-id="${
          candidate.id
        }"><i class="bi bi-trash me-1"></i>Hapus</button>
      </td>
    `;
      tbody.appendChild(row);
    });

    container.appendChild(table);

    // Add event listeners (tetap sama seperti sebelumnya)
    container.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        handleEditCandidate(id);
      });
    });

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        handleDeleteCandidate(id);
      });
    });
  } catch (error) {
    container.innerHTML = `<div class='no-data'>
      <i class='bi bi-exclamation-triangle'></i>
      <p>Terjadi kesalahan saat memuat data</p>
      <small>${error.message}</small>
    </div>`;
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}

// ======================= HANDLE EDIT KANDIDAT =======================
async function handleEditCandidate(id) {
  try {
    const res = await getCandidateById(id);

    if (!res.success || !res.data) {
      showToast(res.message || "Gagal mendapatkan detail kandidat", "error");
      return;
    }

    const candidate = res.data;
    editingCandidateId = id;

    // Update form title and button
    document.getElementById("formTitle").innerHTML =
      '<i class="fas fa-user-edit"></i> Edit Kandidat';
    document.getElementById("submitBtn").innerHTML =
      '<i class="fas fa-edit"></i> Update';

    // Fill form with candidate data
    const form = document.getElementById("candidateForm");
    form.elements["number"].value = candidate.number || "";
    form.elements["president"].value = candidate.president || "";
    form.elements["vice"].value = candidate.vice || "";
    form.elements["vision"].value = candidate.vision || "";
    form.elements["mission"].value = (candidate.mission || []).join("\n");
    form.elements["president_study_program"].value =
      candidate.president_study_program || "";
    form.elements["vice_study_program"].value =
      candidate.vice_study_program || "";
    form.elements["president_nim"].value = candidate.president_nim || "";
    form.elements["vice_nim"].value = candidate.vice_nim || "";

    // Show current photo with proper URL handling
    const photoPreview = document.getElementById("photoPreview");
    if (photoPreview) {
      // Improved image URL handling
      let photoUrl;
      if (candidate.photo_url) {
        // If photo_url already contains the full URL
        if (candidate.photo_url.startsWith("http")) {
          photoUrl = candidate.photo_url;
        }
        // If photo_url is a key/path
        else {
          photoUrl = `${BASE_PUBLIC_FILE_URL}/${candidate.photo_url}`;
        }
      }
      // If photo_key exists use that
      else if (candidate.photo_key) {
        photoUrl = `${BASE_PUBLIC_FILE_URL}/${candidate.photo_key}`;
      }
      // Fallback to placeholder
      else {
        photoUrl = "/public/assets/placeholder-image.jpg";
      }

      photoPreview.src = photoUrl;
      photoPreview.style.display = "block";

      // Add error handler for image
      photoPreview.onerror = function () {
        this.onerror = null; // Prevent infinite loop
        this.src = "/public/assets/placeholder-image.jpg";
      };
    }

    // Scroll to form
    form.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}

// ======================= HANDLE DELETE KANDIDAT =======================
// ======================= UPDATE DELETE HANDLER (PERBAIKAN) =======================
async function handleDeleteCandidate(id) {
  const confirmed = await showConfirmToast(
    "Yakin ingin menghapus kandidat ini?"
  );
  if (!confirmed) return;

  try {
    showToast("Sedang menghapus kandidat...", "info");

    const res = await deleteCandidate(id);

    if (!res.success) {
      showToast(res.message || "Gagal menghapus kandidat", "error");
      return;
    }

    showToast("Kandidat berhasil dihapus!", "success");

    // PENTING: Update period selector setelah delete
    await populatePeriodSelector();
    await populateAdminPeriodSelector();

    // PENTING: Reload dengan period yang sedang dipilih
    const currentPeriod = document.getElementById("periodSelect")?.value;
    const currentAdminPeriod =
      document.getElementById("adminPeriodSelect")?.value;

    await loadCandidatesAdmin(currentAdminPeriod || null);
    await loadCandidates(currentPeriod || null);
    await loadAdminCandidates(currentPeriod || null);
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}
