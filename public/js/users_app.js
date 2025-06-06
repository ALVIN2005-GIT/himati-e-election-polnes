import { login, getCurrentUser, logoutUser } from "/public/js/users_api.js";

// Global state
let authCheckComplete = false;
let isRedirecting = false;

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

// Fungsi untuk cek apakah halaman ini adalah halaman error
function isErrorPage() {
  const path = window.location.pathname;
  return path.includes("403") || path.includes("500") || path.includes("error");
}

// Fungsi untuk cek apakah halaman ini adalah halaman login
function isLoginPage() {
  const path = window.location.pathname;
  return path.includes("login") || path === "/";
}

// Fungsi redirect yang aman
function safeRedirect(url) {
  if (isRedirecting) return; // Prevent multiple redirects

  isRedirecting = true;
  console.log(`Redirecting to: ${url}`);

  // Use replace instead of href to prevent back button issues
  window.location.replace(url);
}

// Check authentication status
async function checkAuth() {
  if (authCheckComplete) return true;

  try {
    const userRes = await getCurrentUser();
    authCheckComplete = true;
    return userRes;
  } catch (error) {
    console.error("Auth check failed:", error);
    authCheckComplete = true;
    return { success: false, message: "Network error" };
  }
}

// Handle page protection
async function handlePageProtection() {
  const path = window.location.pathname;

  // Skip protection for error pages and login page
  if (isErrorPage() || isLoginPage()) {
    return;
  }

  const protectedPaths = [
    "/views/admin/admin-dashboard.html",
    "/views/admin/admin-crud.html",
    "/views/admin/upload-file.html",
    "/views/admin/generate-send-password.html",
    "/views/admin/votes-result.html",
    "/views/admin/data-recap.html",
    "/views/admin/votes.html",
    "/views/students/votes.html",
  ];

  // Only check auth if this is a protected path
  if (!protectedPaths.includes(path)) {
    return;
  }

  const userRes = await checkAuth();

  if (!userRes.success) {
    // User not authenticated
    safeRedirect("/views/403_1.html");
    return;
  }

  const { user } = userRes;

  // Check role-based access
  if (path.includes("/admin/") && user.role !== "admin") {
    safeRedirect("/views/403.html");
    return;
  }

  if (path.includes("/students/") && user.role !== "student") {
    safeRedirect("/views/403.html");
    return;
  }

  // Access granted - show the page
  document.body.style.visibility = "visible";
}

// Handle login form
function handleLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const maxLength = 14;
      const nimInput = document.getElementById("nim");
      const passwordInput = document.getElementById("password");

      const nim = nimInput?.value.trim();
      const password = passwordInput?.value;

      // Validation
      if (nim.length > maxLength) {
        nimInput.value = nim.slice(0, maxLength);
        showToast("NIM tidak boleh lebih dari 14 karakter.", "warning");
        return;
      }

      if (!password) {
        showToast("Password wajib diisi.", "warning");
        return;
      }

      // Disable form during submission
      loginForm.style.pointerEvents = "none";
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = "Loading...";
        submitBtn.disabled = true;
      }

      // Attempt login
      const response = await login(nim, password);

      if (!response.success) {
        showToast(response.message, "error");
        return;
      }

      // Get user info after login
      const userRes = await getCurrentUser();

      if (!userRes.success) {
        showToast("Gagal mendapatkan user setelah login.", "error");
        return;
      }

      const { user } = userRes;

      // Success - redirect based on role
      if (user.role === "admin") {
        showToast(`Selamat Datang ${user.full_name}!`, "success");
        setTimeout(() => {
          safeRedirect("/views/admin/admin-dashboard.html");
        }, 1500);
      } else if (user.role === "student") {
        showToast(`Selamat Datang ${user.full_name}`, "success");
        setTimeout(() => {
          safeRedirect("/views/students/votes.html");
        }, 1500);
      } else {
        showToast("Role user tidak dikenali", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      showToast("Terjadi kesalahan sistem. Silakan coba lagi.", "error");
    } finally {
      // Re-enable form
      loginForm.style.pointerEvents = "auto";
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = "Login";
        submitBtn.disabled = false;
      }
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

      try {
        const result = await logoutUser();

        if (result.success) {
          showToast("Logout berhasil!", "success");
          setTimeout(() => {
            safeRedirect("/views/login.html");
          }, 1000);
        } else {
          showToast(`Logout gagal: ${result.message}`, "error");
        }
      } catch (error) {
        console.error("Logout error:", error);
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

// Initialize everything
async function initialize() {
  try {
    // Setup basic handlers first
    handleLogout();
    handlePasswordToggle();

    // Check if this is login page
    if (isLoginPage()) {
      handleLoginForm();
      document.body.style.visibility = "visible";
      return;
    }

    // Check if this is error page
    if (isErrorPage()) {
      document.body.style.visibility = "visible";
      return;
    }

    // For protected pages, check auth
    await handlePageProtection();
  } catch (error) {
    console.error("Initialization error:", error);
    document.body.style.visibility = "visible";
  }
}

// DOM ready event
document.addEventListener("DOMContentLoaded", () => {
  // Hide body initially to prevent flash
  document.body.style.visibility = "hidden";

  // Initialize after a small delay
  setTimeout(initialize, 100);
});

// Prevent back button cache issues
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    // Reset state and reload if page was cached
    authCheckComplete = false;
    isRedirecting = false;
    location.reload();
  }
});
