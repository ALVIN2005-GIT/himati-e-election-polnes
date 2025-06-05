import { login, getCurrentUser, logoutUser } from "./users_api.js";

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
      console.error("Elemen toast konfirmasi tidak ditemukan!");
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

document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const maxLength = 14;

      const nimInput = document.getElementById("nim");
      const passwordInput = document.getElementById("password");

      const nim = nimInput?.value.trim();
      const password = passwordInput?.value;

      if (nim.length > maxLength) {
        nimInput.value = nim.slice(0, maxLength); // update input value
        showToast("NIM tidak boleh lebih dari 14 karakter.", "warning");
        return;
      }

      if (!password) {
        showToast("Password wajib diisi.", "warning");
        return;
      }

      const response = await login(nim, password);

      if (!response.success) {
        showToast(response.message, "error");
        console.error("Login gagal:", response.details);
        return;
      }

      const userRes = await getCurrentUser();

      if (!userRes.success) {
        showToast("Gagal mendapatkan user setelah login.", "error");
        return;
      }

      const { user } = userRes;

      if (user.role === "admin") {
        showToast(`Selamat Datang ${user.full_name}!` || "Admin!", "success");
        setTimeout(() => {
          window.location.href = "/views/admin/admin-dashboard.html";
        }, 2000);
      } else if (user.role === "student") {
        showToast(`Selamat Datang ${user.full_name}`, "success");
        setTimeout(() => {
          window.location.href = "/views/students/votes.html";
        }, 2000);
      } else {
        showToast("Salah User dan Tidak Ada", "error");
      }
    });
  } else {
    // Proteksi halaman selain login
    const userRes = await getCurrentUser();

    const { user } = userRes;
    const path = window.location.pathname;

    // Daftar halaman yang butuh proteksi login
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

    if (!userRes.success) {
      // Kalau belum login, redirect ke login
      window.location.href = "/views/403_1.html";
      if (protectedPaths.includes(path)) {
        setTimeout(() => {
          window.location.href = "/views/403_1.html";
        }, 3000); // 3 detik delay
      }
      return;
    }

    // Kalau user role-nya tidak cocok dengan halaman
    if (path.includes("/admin/") && user.role !== "admin") {
      window.location.href = "/views/403.html";
    }
  }

  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "logout-btn") {
      const confirmLogout = await showConfirmToast(
        "Apakah kamu yakin ingin logout?"
      );
      if (!confirmLogout) return;

      const result = await logoutUser();

      if (result.success) {
        showToast("Logout berhasil!", "success");
        window.location.href = "/frontend/views/login.html";
      } else {
        showToast(`Logout gagal: ${result.message}`, "error");
        console.error("Logout error detail:", result.details);
      }
    }
  });

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
});
