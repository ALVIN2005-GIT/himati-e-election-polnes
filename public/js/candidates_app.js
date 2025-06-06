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

import { voteForCandidate } from "./votes_api.js";

// ======================= GLOBAL VARIABLES =======================
let editingCandidateId = null; // To track which candidate is being edited

// ======================= BIND EVENT SAAT DOM SIAP =======================
document.addEventListener("DOMContentLoaded", () => {
  const currentYear = new Date().getFullYear();

  // Menentukan tahun periode (tahun depan)
  const electionYear = currentYear + 1;

  // Menampilkan tahun di elemen dengan id "electionPeriod"
  const electionPeriodElement = document.getElementById("electionPeriod");
  if (electionPeriodElement) {
    electionPeriodElement.textContent = electionYear;
  }

  // Update footer juga jika perlu
  const footerYearElement = document.querySelector("footer p");
  if (footerYearElement) {
    footerYearElement.innerHTML =
      footerYearElement.innerHTML.replace(currentYear);
    footerYearElement.innerHTML =
      footerYearElement.innerHTML.replace(electionYear);
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

// ======================= INITIALIZE APP =======================
function initializeApp() {
  // Load candidates for public view
  const publicContainer = document.getElementById("candidateList");
  if (publicContainer) {
    loadCandidates();
  }

  // Load candidates for admin view
  const adminContainer = document.getElementById("adminCandidateList");
  if (adminContainer) {
    loadCandidatesAdmin();
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

    // Reset form and update UI
    form.reset();
    editingCandidateId = null;
    document.getElementById("formTitle").textContent = "Tambah Kandidat Baru";
    document.getElementById("submitBtn").textContent = "Simpan";

    // Clear photo preview
    const photoPreview = document.getElementById("photoPreview");
    if (photoPreview) {
      photoPreview.style.display = "none";
      photoPreview.src = "";
    }

    // Reload candidate lists
    await loadCandidates();
    await loadCandidatesAdmin();
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}

// ======================= LOAD KANDIDAT (UNTUK PUBLIC VIEW) =======================
export async function loadCandidates() {
  const container = document.getElementById("candidateList");
  if (!container) return;

  try {
    const res = await getAllCandidates();

    if (!res.success || !res.data || res.data == null) {
      showToast("Gagal mengambil data kandidat", "error");
      return;
    }

    container.innerHTML = "";

    if (res.data.length === 0) {
      container.innerHTML =
        "<p class='no-data'>Tidak ada kandidat tersedia.</p>";
      return;
    }

    // Sort candidates by number before displaying
    const sortedCandidates = [...res.data].sort((a, b) => a.number - b.number);

    // Create candidate cards for public view
    const candidatesGrid = document.createElement("div");
    // candidatesGrid.className = "candidates-grid";
    candidatesGrid.className = "row g-4 justify-content-center";

    sortedCandidates.forEach((candidate) => {
      // Proper image URL handling
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

      const col = document.createElement("div");
      col.className = "col-12 col-sm-6 col-lg-4 d-flex justify-content-center";

      const card = document.createElement("div");
      card.className = "candidate-card";

      // card.innerHTML = `
      //   <div class="candidate-name">${candidate.id || ""}</div>

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

    // Add event listeners for candidate cards and vote buttons
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

    showToast("Data kandidat berhasil dimuat", "success");
  } catch (error) {
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
async function handleVoteClick(event) {
  event.preventDefault();

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
  const originalText = event.target.textContent;
  event.target.textContent = "Mencoblos...";

  try {
    // 🚀 Kirim vote ke API
    const response = await voteForCandidate(candidateId);

    if (response.success) {
      // ✅ Change the button appearance to show voted state
      showToast("Vote Telah berhasil", "success");
      event.target.textContent = "✓ Tercoblos";
      event.target.classList.add("voted");
    } else {
      showToast(`Vote gagal : ${response.message}`, "error");

      // Kembalikan tombol
      event.target.disabled = false;
      event.target.textContent = <i class="bi bi-crosshair me-1"></i>;
      event.target.textContent = originalText;
    }
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");

    // Kembalikan tombol
    event.target.disabled = false;
    event.target.textContent = originalText;
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

// ======================= LOAD KANDIDAT (UNTUK ADMIN) =======================
export async function loadCandidatesAdmin() {
  const container = document.getElementById("adminCandidateList");
  if (!container) return;

  try {
    showToast("Memuat data kandidat untuk admin...", "info");

    const res = await getAllCandidates();

    if (!res.success || res.data == null) {
      showToast("Gagal mengambil data kandidat", "error");
      return;
    }

    container.innerHTML = "";

    if (res.data.length === 0) {
      container.innerHTML =
        "<p class='no-data'>Tidak ada kandidat tersedia.</p>";
      return;
    }

    // Sort candidates by number before displaying
    const sortedCandidates = [...res.data].sort((a, b) => a.number - b.number);

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
      // Proper image URL handling
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

      const vision = candidate.vision ?? "";
      const mission = candidate.mission ?? "";
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

    // Add event listeners for edit and delete buttons
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

    showToast("Data kandidat admin berhasil dimuat", "success");
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}

// ======================= HANDLE EDIT KANDIDAT =======================
async function handleEditCandidate(id) {
  try {
    showToast("Memuat data kandidat untuk diedit...", "info");

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

    showToast("Data kandidat siap diedit", "success");
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}

// ======================= HANDLE DELETE KANDIDAT =======================
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
    await loadCandidatesAdmin();
    await loadCandidates();
  } catch (error) {
    showToast(`Terjadi kesalahan: ${error.message}`, "error");
  }
}
