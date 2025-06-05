/**
 * API functions for Data Recap functionality
 */

class DataRecapAPI {
  constructor() {
    this.baseURL = "https://api-hima-ti-e-election.sgp.dom.my.id";
  }

  /**
   * Get presigned URL for vote log download
   * @param {string} year - Year for the log file
   * @returns {Promise<Object>} Response with download URL
   */
  async getVoteLogURL(year) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/download/logs/vote?filename=${year}`,
        {
          credentials: "include",
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting vote log URL:", error);
      throw new Error(
        error.message || "Gagal mengambil URL log. Periksa koneksi internet."
      );
    }
  }

  /**
   * Download log file content from URL
   * @param {string} url - Presigned URL for log file
   * @returns {Promise<string>} Log file content
   */
  async downloadLogContent(url) {
    try {
      const response = await fetch(url, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Gagal mengunduh file log: HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error("Error downloading log content:", error);
      throw new Error(error.message || "Gagal mengunduh konten file log");
    }
  }

  /**
   * Process log content into structured data
   * @param {string} logContent - Raw log content
   * @returns {Object} Processed data with statistics
   */
  processLogContent(logContent) {
    const lines = logContent.trim().split("\n");
    const rowsArray = [];
    let processedCount = 0;
    let skippedCount = 0;
    const skippedLines = [];

    for (const line of lines) {
      try {
        const log = JSON.parse(line);
        const time = log.time;
        const msg = log.msg;

        // Extract information using regex patterns
        const nameMatch = msg.match(/^(.+?) with NIM/);
        const nimMatch = msg.match(/NIM (\d+)/);
        const majorMatch = msg.match(/from (.+?) has voted/);

        const name = nameMatch ? nameMatch[1].trim() : "";
        const nim = nimMatch ? nimMatch[1] : "";
        const major = majorMatch ? majorMatch[1].trim() : "";

        if (name && nim && major) {
          rowsArray.push([time, name, nim, major]);
          processedCount++;
        } else {
          skippedCount++;
          skippedLines.push({
            line,
            reason: "Missing required fields (name, NIM, or major)",
          });
        }
      } catch (parseError) {
        skippedCount++;
        skippedLines.push({
          line,
          reason: "Invalid JSON format",
        });
        console.warn("Skipping invalid JSON line:", line, parseError);
      }
    }

    return {
      data: rowsArray,
      statistics: {
        total: lines.length,
        processed: processedCount,
        skipped: skippedCount,
        skippedLines,
      },
    };
  }

  /**
   * Generate Excel file from processed data
   * @param {Array} data - Processed vote data
   * @param {string} year - Year for filename
   * @returns {void} Downloads the Excel file
   */
  generateExcelFile(data, year) {
    try {
      if (!window.XLSX) {
        throw new Error("SheetJS library tidak tersedia");
      }

      // Add header row
      const sheetData = [["Waktu", "Nama", "NIM", "Program Studi"], ...data];

      // Create workbook and worksheet
      const worksheet = window.XLSX.utils.aoa_to_sheet(sheetData);
      const workbook = window.XLSX.utils.book_new();

      // Add worksheet to workbook
      window.XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        `Vote Log ${year}`
      );

      // Auto-size columns (basic implementation)
      const columnWidths = [
        { wch: 20 }, // Waktu
        { wch: 25 }, // Nama
        { wch: 15 }, // NIM
        { wch: 30 }, // Program Studi
      ];
      worksheet["!cols"] = columnWidths;

      // Generate and download file
      const filename = `vote_log_${year}.xlsx`;
      window.XLSX.writeFile(workbook, filename);

      return filename;
    } catch (error) {
      console.error("Error generating Excel file:", error);
      throw new Error(error.message || "Gagal membuat file Excel");
    }
  }
}

// Export for use in other modules
window.DataRecapAPI = DataRecapAPI;

// Create global instance
window.dataRecapAPI = new DataRecapAPI();
