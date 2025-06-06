// Base URL for the API - Update this to your actual API endpoint
const API_BASE_URL = "https://api-hima-ti-e-election.sgp.dom.my.id";
export const BASE_PUBLIC_FILE_URL =
  "https://956e5a2df17559aa074853a3ba0b309f.r2.cloudflarestorage.com";

/**
 * Get presigned URL for file upload
 * @param {string} filename - Name of the file to be uploaded
 * @returns {Promise<Object>} - Response object with url and key
 */
export async function getPresignedUrl(filename) {
  try {
    // Pastikan filename aman dengan menambahkan timestamp
    const safeFilename = `${Date.now()}-${filename}`;

    // Encode the filename properly, ensuring 2026/ prefix is included
    const encodedFilename = encodeURIComponent(`2026/${safeFilename}`);

    const response = await fetch(
      `${API_BASE_URL}/api/upload/candidates/presigned-url?filename=${encodedFilename}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        mode: "cors",
      }
    );

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = {
          error: {
            message: `Error ${response.status}: ${response.statusText}`,
          },
        };
      }

      return {
        success: false,
        message:
          errorData.error?.message ||
          `Error ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Format the response properly
    return {
      success: true,
      data: {
        url: data.data?.url || data.url,
        key: data.data?.key || `2026/${safeFilename}`,
        file_name: data.data?.file_name || `2026/${safeFilename}`,
      },
      message: data.message || "Successfully generated presigned URL",
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
/**
 * Upload file to S3 using presigned URL
 * @param {string} presignedUrl - The presigned URL for upload
 * @param {File} file - The file to upload
 * @returns {Promise<boolean>} - Success status
 */
export async function uploadFile(presignedUrl, file) {
  try {
    // Hard validation - ensure file exists
    if (!file) {
      return false;
    }

    // Directly using fetch with minimal headers like in your friend's example
    const response = await fetch(presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a new candidate
 * @param {Object} candidateData - The candidate data
 * @returns {Promise<Object>} - Response object
 */
export async function createCandidate(candidateData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/candidates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies in the request
      mode: "cors", // Explicitly set CORS mode
      body: JSON.stringify(candidateData),
    });

    if (!response.ok) {
      const errorData = await response.json();

      return {
        success: false,
        message:
          errorData.error?.message ||
          `Error ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Get all candidates
 * @param {string} [period] - Optional period filter
 * @returns {Promise<Object>} - Response object with candidates data
 */
export async function getAllCandidates(period = null) {
  try {
    const url = new URL(`${API_BASE_URL}/api/candidates`);
    if (period) url.searchParams.append("period", period);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies in the request
      mode: "cors", // Explicitly set CORS mode
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: { message: `Error ${response.status}: ${response.statusText}` },
      }));

      return {
        success: false,
        message:
          errorData.error?.message ||
          `Error ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Get candidate by ID
 * @param {string|number} id - Candidate ID
 * @returns {Promise<Object>} - Response object with candidate data
 */
export async function getCandidateById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/candidates/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies in the request
      mode: "cors", // Explicitly set CORS mode
    });

    if (!response.ok) {
      const errorData = await response.json();

      return {
        success: false,
        message:
          errorData.error?.message ||
          `Error ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Update candidate by ID
 * @param {string|number} id - Candidate ID
 * @param {Object} candidateData - The updated candidate data
 * @returns {Promise<Object>} - Response object
 */
export async function updateCandidate(id, candidateData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/candidates/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies in the request
      mode: "cors", // Explicitly set CORS mode
      body: JSON.stringify(candidateData),
    });

    if (!response.ok) {
      const errorData = await response.json();

      return {
        success: false,
        message:
          errorData.error?.message ||
          `Error ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Delete candidate by ID
 * @param {string|number} id - Candidate ID
 * @returns {Promise<Object>} - Response object
 */
export async function deleteCandidate(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/candidates/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies in the request
      mode: "cors", // Explicitly set CORS mode
    });

    if (!response.ok) {
      const errorData = await response.json();

      return {
        success: false,
        message:
          errorData.error?.message ||
          `Error ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
