import { login, getCurrentUser, logoutUser } from "/public/js/users_api.js";

// Loading state management
let isInitializing = true;

function showLoadingState() {
  // Tambahkan loading spinner atau hide content
  document.body.style.visibility = "hidden";

  // Buat loading overlay jika belum ada
  if (!document.getElementById("auth-loading")) {
    const loadingDiv = document.createElement("div");
    loadingDiv.id = "auth-loading";
    loadingDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255,255,255,0.9);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      font-family: Arial, sans-serif;
    `;
    loadingDiv.innerHTML = `
      <div style="text-align: center;">
        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
        <p>Loading...</p>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loadingDiv);
  }
}

function hideLoadingState() {
  const loadingDiv = document.getElementById("auth-loading");
  if (loadingDiv) {
    loadingDiv.remove();
  }
  document.body.style.visibility = "visible";
  isInitializing = false;
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.className = `toast ${type} show`;
  toast.textContent = message;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function showConfirmToast(message) {
  return new Promise((resolve) => {
    const confirmToast = document.getElementById("confirm-toast");
    const confirmMessage = document.getElementById("confirm-message");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    if (!confirmToast || !confirmMessage || !yesBtn || !noBtn) {
      return resolve(false);
    }

    confirmMessage.textContent = message;
    confirmToast.classList.remove("hidden");

    setTimeout(() => {
      confirmToast.classList.add("show");
    }, 10);

    const cleanup = () => {
      confirmToast.classList.remove("show");
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
        resolve(false);
      }
    };

    setTimeout(() => {
      document.addEventListener("mousedown", onOutsideClick);
    }, 50);
  });
}

// Fungsi untuk redirect dengan loading state
function redirectWithLoading(url, delay = 1500) {
  showLoadingState();
  setTimeout(() => {
    window.location.href = url;
  }, delay);
}

// Handle page protection dengan error handling yang lebih baik
async function handlePageProtection() {
  try {
    const userRes = await getCurrentUser();
    const path = window.location.pathname;

    const protectedPaths = [
      "/views/admin/admin-dashboard.html",
      "/views/admin/admin-crud.html",
      "/views/admin/upload-file.html",
      "/views/admin/generate-send-password.html",
      "/views/admin/votes-result.html",
      "/views/admin/data-recap.html",
      "/views/admin/votes.html",
      "/views/students/votes.html",
      "/views/403.html",
      "/views/403_1.html",
      "/views/500.html",
    ];

    // Jika tidak berhasil get current user (belum login)
    if (!userRes.success) {
      if (protectedPaths.includes(path)) {
        // Langsung redirect tanpa delay yang lama
        redirectWithLoading("/views/403_1.html", 500);
        return false;
      }
      return true; // Allow access ke halaman publik
    }

    const { user } = userRes;

    // Check role-based access
    if (path.includes("/admin/") && user.role !== "admin") {
      redirectWithLoading("/views/403.html", 500);
      return false;
    }

    if (path.includes("/students/") && user.role !== "student") {
      redirectWithLoading("/views/403.html", 500);
      return false;
    }

    return true; // Access granted
  } catch (error) {
    console.error("Error in page protection:", error);
    // Pada error, redirect ke 500 page
    redirectWithLoading("/views/500.html", 500);
    return false;
  }
}

// Handle login form
async function handleLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Show loading state
    showLoadingState();

    try {
      const maxLength = 14;
      const nimInput = document.getElementById("nim");
      const passwordInput = document.getElementById("password");

      const nim = nimInput?.value.trim();
      const password = passwordInput?.value;

      // Validation
      if (nim.length > maxLength) {
        nimInput.value = nim.slice(0, maxLength);
        hideLoadingState();
        showToast("NIM tidak boleh lebih dari 14 karakter.", "warning");
        return;
      }

      if (!password) {
        hideLoadingState();
        showToast("Password wajib diisi.", "warning");
        return;
      }

      // Attempt login
      const response = await login(nim, password);

      if (!response.success) {
        hideLoadingState();
        showToast(response.message, "error");
        return;
      }

      // Get user info after login
      const userRes = await getCurrentUser();

      if (!userRes.success) {
        hideLoadingState();
        showToast("Gagal mendapatkan user setelah login.", "error");
        return;
      }

      const { user } = userRes;

      // Success - redirect based on role
      if (user.role === "admin") {
        showToast(`Selamat Datang ${user.full_name}!`, "success");
        setTimeout(() => {
          window.location.href = "/views/admin/admin-dashboard.html";
        }, 1500);
      } else if (user.role === "student") {
        showToast(`Selamat Datang ${user.full_name}`, "success");
        setTimeout(() => {
          window.location.href = "/views/students/votes.html";
        }, 1500);
      } else {
        hideLoadingState();
        showToast("Role user tidak dikenali", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      hideLoadingState();
      showToast("Terjadi kesalahan sistem. Silakan coba lagi.", "error");
    }
  });
}

// Handle logout
function handleLogout() {
  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "logout-btn") {
      const confirmLogout = await showConfirmToast(
        "Apakah kamu yakin ingin logout?"
      );
      if (!confirmLogout) return;

      showLoadingState();

      try {
        const result = await logoutUser();

        if (result.success) {
          showToast("Logout berhasil!", "success");
          setTimeout(() => {
            window.location.href = "/views/login.html";
          }, 1000);
        } else {
          hideLoadingState();
          showToast(`Logout gagal: ${result.message}`, "error");
        }
      } catch (error) {
        console.error("Logout error:", error);
        hideLoadingState();
        showToast("Terjadi kesalahan saat logout.", "error");
      }
    }
  });
}

// Handle password toggle
function handlePasswordToggle() {
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      togglePassword.classList.toggle("bi-eye");
      togglePassword.classList.toggle("bi-eye-slash");
    });
  }
}

// Main initialization
document.addEventListener("DOMContentLoaded", async () => {
  // Show loading immediately
  showLoadingState();

  try {
    // Check if this is login page
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
      // This is login page - just setup form handlers
      await handleLoginForm();
      handlePasswordToggle();
    } else {
      // This is protected page - check authentication
      const canAccess = await handlePageProtection();
      if (!canAccess) {
        return; // Will redirect, don't continue
      }
    }

    // Setup logout handler for all pages
    handleLogout();

    // Hide loading after everything is set up
    hideLoadingState();
  } catch (error) {
    console.error("Initialization error:", error);
    hideLoadingState();
    showToast("Terjadi kesalahan sistem.", "error");
  }
});

// Handle page visibility changes (when user comes back to tab)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !isInitializing) {
    // User came back to tab - recheck auth if needed
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) {
      // This is protected page, recheck auth
      handlePageProtection();
    }
  }
});

// Prevent back button issues
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    // Page was loaded from cache, reload to ensure fresh state
    location.reload();
  }
});
