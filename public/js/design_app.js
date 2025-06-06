document.addEventListener("DOMContentLoaded", function () {
  // 🔹 Load Navbar & Footer jika di landing page (index.html & admin-home.html)
  // Cek apakah halaman yang dibuka adalah index.html & admin-home.html (landing page)
  if (
    window.location.pathname.endsWith("/") ||
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname.endsWith("admin-home.html") ||
    window.location.pathname === "/"
  ) {
    // Load navbar
    fetch("/public/components/navbar.html")
      .then((response) => response.text())
      .then((data) => document.body.insertAdjacentHTML("afterbegin", data));

    // Load footer
    fetch("/public/components/footer.html")
      .then((response) => response.text())
      .then((data) => document.body.insertAdjacentHTML("beforeend", data));
  } else if (
    window.location.pathname.endsWith("/") ||
    window.location.pathname.endsWith("admin-crud.html") ||
    window.location.pathname.endsWith("admin-dashboard.html") ||
    window.location.pathname.endsWith("generate-send-password.html") ||
    window.location.pathname.endsWith("data-recap.html") ||
    window.location.pathname.endsWith("upload-file.html") ||
    window.location.pathname.endsWith("votes-result.html") ||
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname === "/"
  ) {
    // Load navbar
    fetch("/public/components/admin-navbar.html")
      .then((response) => response.text())
      .then((data) => document.body.insertAdjacentHTML("afterbegin", data));
  }
  // 🔹 Navbar scroll effect
  window.addEventListener("scroll", function () {
    const navbar = document.querySelector(".navbar");
    if (navbar) {
      navbar.classList.toggle("shadow", window.scrollY > 50);
    }
  });

  // 🔹 Smooth scroll untuk anchor link
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // 🔹 Vote button click handler
  const voteButton = document.getElementById("voteButton");
  if (voteButton) {
    voteButton.addEventListener("click", function () {
      const isLoggedIn = false; // Ganti dengan logika login yang benar
      window.location.href = isLoggedIn
        ? "views/students/vote.html"
        : "views/login.html";
    });
  }

  // 🔹 Close navbar menu jika klik di luar
  document.addEventListener("click", function (event) {
    const navbarToggler = document.querySelector(".navbar-toggler");
    const navbarMenu = document.querySelector(".navbar-collapse");

    if (
      navbarToggler &&
      navbarMenu &&
      navbarMenu.classList.contains("show") &&
      !event.target.closest(".navbar-toggler, .navbar-collapse")
    ) {
      navbarToggler.click(); // Menutup menu
    }
  });
});
