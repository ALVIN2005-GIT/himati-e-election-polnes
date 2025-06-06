/**
 * Main application logic for Data Recap functionality
 */

class DataRecapApp {
  constructor() {
    this.elements = {
      yearInput: null,
      generateButton: null,
      resultsList: null,
      toast: null,
      confirmToast: null,
    };

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    document.addEventListener("DOMContentLoaded", () => {
      this.initializeElements();
      this.attachEventListeners();
    });
  }

  /**
   * Initialize DOM elements
   */
  initializeElements() {
    this.elements.yearInput = document.getElementById("yearInput");
    this.elements.generateButton = document.getElementById("generateRecap");
    this.elements.resultsList = document.getElementById("generatedList");
    this.elements.toast = document.getElementById("toast");
    this.elements.confirmToast = document.getElementById("confirm-toast");
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Enter key support for year input
    if (this.elements.yearInput) {
      this.elements.yearInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.handleDownload();
        }
      });

      // Input validation on blur
      this.elements.yearInput.addEventListener("blur", () => {
        const validation = this.validateYearInput(
          this.elements.yearInput.value
        );
        if (
          !validation.isValid &&
          this.elements.yearInput.value.trim() !== ""
        ) {
          this.showToast(validation.errors[0], "warning", 3000);
        }
      });

      // Real-time input formatting
      this.elements.yearInput.addEventListener("input", (e) => {
        // Only allow numbers
        e.target.value = e.target.value.replace(/[^0-9]/g, "");
      });
    }

    // Global function for onclick handler
    window.handleDownload = () => this.handleDownload();
  }

  /**
   * Validate year input
   * @param {string} year - Year input value
   * @returns {Object} Validation result
   */
  validateYearInput(year) {
    const errors = [];

    if (!year || year.trim() === "") {
      errors.push("Tahun tidak boleh kosong");
    } else if (!/^\d{4}$/.test(year.trim())) {
      errors.push("Format tahun harus 4 digit angka (contoh: 2025)");
    } else {
      const yearNum = parseInt(year.trim());
      const currentYear = new Date().getFullYear();

      if (yearNum < 2020) {
        errors.push("Tahun tidak boleh kurang dari 2020");
      } else if (yearNum > currentYear + 1) {
        errors.push(`Tahun tidak boleh lebih dari ${currentYear + 1}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Display results with appropriate styling
   * @param {Array} messages - Array of message objects {text, type}
   */
  displayResults(messages) {
    if (!this.elements.resultsList) return;

    this.elements.resultsList.innerHTML = "";

    messages.forEach((message) => {
      const li = document.createElement("li");
      li.className = message.type || "info";
      li.innerHTML = message.text;
      this.elements.resultsList.appendChild(li);
    });
  }

  /**
   * Clear previous results
   */
  clearResults() {
    if (this.elements.resultsList) {
      this.elements.resultsList.innerHTML = "";
    }
  }

  /**
   * Normalize error messages for consistent user experience
   * @param {Error} error - Error object
   * @param {string} year - Year being processed
   * @returns {string} Normalized error message
   */
  normalizeErrorMessage(error, year) {
    const message = error.message.toLowerCase();

    // Convert backend "file not found" errors to consistent "no valid data" message
    if (
      message.includes("log file is not found") ||
      message.includes("file not found") ||
      message.includes("not found")
    ) {
      return `Tidak ada data voting yang valid untuk tahun ${year}`;
    }

    // Keep other error messages as they are
    return error.message;
  }

  /**
   * Handle download process
   */
  async handleDownload() {
    const year = this.elements.yearInput?.value?.trim();

    // Clear previous results
    this.clearResults();

    // Validate input
    const validation = this.validateYearInput(year);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map((error) => ({
        text: `❌ ${error}`,
        type: "error",
      }));

      this.displayResults(errorMessages);
      this.showToast(validation.errors[0], "error", 4000);
      this.elements.yearInput?.focus();
      return;
    }

    // Show confirmation
    const confirmed = await this.showConfirmToast(
      `Apakah Anda yakin ingin mengunduh data recap untuk tahun ${year}?`,
      { yesText: "Download", noText: "Batal" }
    );

    if (!confirmed) {
      this.showToast("Download dibatalkan", "info");
      return;
    }

    // Show loading state
    this.displayResults([
      {
        text: "⏳ Sedang memproses download...",
        type: "info",
      },
    ]);
    this.showToast("Memulai download...", "info");

    try {
      // Step 1: Get presigned URL
      const urlData = await window.dataRecapAPI.getVoteLogURL(year);
      const logUrl = urlData.data.url;

      // Step 2: Download log content
      const logContent = await window.dataRecapAPI.downloadLogContent(logUrl);

      // Step 3: Process log content
      const processedData = window.dataRecapAPI.processLogContent(logContent);

      if (processedData.data.length === 0) {
        throw new Error(`Tidak ada data voting yang valid untuk tahun ${year}`);
      }

      // Step 4: Generate Excel file
      const filename = window.dataRecapAPI.generateExcelFile(
        processedData.data,
        year
      );

      // Step 5: Show success results
      const successMessages = [
        {
          text: `✅ Berhasil mengunduh file: ${filename}`,
          type: "success",
        },
        {
          text: `📊 ${processedData.statistics.processed} data berhasil diproses`,
          type: "info",
        },
      ];

      if (processedData.statistics.skipped > 0) {
        successMessages.push({
          text: `⚠️ ${processedData.statistics.skipped} data dilewati (format tidak valid)`,
          type: "warning",
        });
      }

      this.displayResults(successMessages);
      this.showToast(
        `Download berhasil! ${processedData.statistics.processed} data diproses`,
        "success",
        5000
      );
    } catch (error) {
      // Normalize error message for consistency
      const normalizedMessage = this.normalizeErrorMessage(error, year);

      // Show error results
      this.displayResults([
        {
          text: `❌ ${normalizedMessage}`,
          type: "error",
        },
      ]);

      this.showToast(`Error: ${normalizedMessage}`, "error", 5000);
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds
   */
  showToast(message, type = "success", duration = 3000) {
    // Prevent multiple toasts if locked
    if (window._toastLocked) return;

    const toast = this.elements.toast;
    if (!toast) {
      return;
    }

    // Clear existing timeout
    if (window._toastTimeout) {
      clearTimeout(window._toastTimeout);
    }

    // Set toast content and styling
    toast.className = `toast ${type} show`;
    toast.textContent = message;

    // Auto-hide after duration
    window._toastTimeout = setTimeout(() => {
      if (toast.classList.contains("show")) {
        toast.classList.remove("show");
      }
    }, duration);
  }

  /**
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Object} options - Options object with button texts
   * @returns {Promise<boolean>} User's choice
   */
  showConfirmToast(message, options = {}) {
    return new Promise((resolve) => {
      const confirmToast = this.elements.confirmToast;
      const confirmMessage = document.getElementById("confirm-message");
      const yesBtn = document.getElementById("confirm-yes");
      const noBtn = document.getElementById("confirm-no");

      if (!confirmToast || !confirmMessage || !yesBtn || !noBtn) {
        return resolve(false);
      }

      // Prevent multiple confirms
      if (confirmToast.classList.contains("show")) {
        return resolve(false);
      }

      // Set custom button texts
      if (options.yesText) yesBtn.textContent = options.yesText;
      if (options.noText) noBtn.textContent = options.noText;

      // Show confirmation
      confirmMessage.textContent = message;
      confirmToast.classList.remove("hidden");

      requestAnimationFrame(() => {
        confirmToast.classList.add("show");
      });

      const cleanup = (result) => {
        confirmToast.classList.remove("show");

        setTimeout(() => {
          confirmToast.classList.add("hidden");
          yesBtn.textContent = "Ya";
          noBtn.textContent = "Tidak";
        }, 300);

        // Remove event listeners
        yesBtn.removeEventListener("click", onYes);
        noBtn.removeEventListener("click", onNo);
        document.removeEventListener("mousedown", onOutsideClick);
        document.removeEventListener("keydown", onEscapeKey);

        resolve(result);
      };

      const onYes = (e) => {
        e.preventDefault();
        cleanup(true);
      };

      const onNo = (e) => {
        e.preventDefault();
        cleanup(false);
      };

      const onOutsideClick = (event) => {
        if (!confirmToast.contains(event.target)) {
          cleanup(false);
        }
      };

      const onEscapeKey = (event) => {
        if (event.key === "Escape") {
          cleanup(false);
        }
      };

      // Add event listeners
      yesBtn.addEventListener("click", onYes);
      noBtn.addEventListener("click", onNo);

      setTimeout(() => {
        document.addEventListener("mousedown", onOutsideClick);
        document.addEventListener("keydown", onEscapeKey);
      }, 100);
    });
  }
}

// Initialize the application
const dataRecapApp = new DataRecapApp();
