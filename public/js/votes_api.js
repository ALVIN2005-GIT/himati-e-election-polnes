// votes_api.js - Enhanced with better WebSocket integration

const BASE_URL = "https://api-hima-ti-e-election.sgp.dom.my.id";

/**
 * Get all votes data
 * @returns {Promise<Object>} Response with success status and votes data
 */
export async function getAllVotes() {
  try {
    const res = await fetch(`${BASE_URL}/api/votes`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data?.error?.message || "Gagal mengambil data vote",
      };
    }

    return {
      success: true,
      status: res.status,
      data: data.data,
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      message: "Gagal terhubung ke server.",
      details: err.message,
    };
  }
}

/**
 * Vote for a candidate
 * @param {string|number} candidateId - ID of the selected candidate
 * @returns {Promise<Object>} Response with success status and message
 */
export async function voteForCandidate(candidateId) {
  try {
    // Ensure candidateId is properly formatted
    const payload = {
      candidate_id: Number(candidateId),
    };

    const res = await fetch(`${BASE_URL}/api/votes`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Handle response
    if (!res.ok) {
      let errorMessage = "Gagal mengirim vote";
      let errorDetails = null;

      try {
        const errorData = await res.json();
        errorMessage = errorData?.error?.message || errorMessage;
        errorDetails = errorData?.error?.details || null;
      } catch (parseError) {
        throw new Error(`Error parsing response: ${parseError.message}`);
      }

      return {
        success: false,
        status: res.status,
        message: errorMessage,
        details: errorDetails,
      };
    }

    const data = await res.json();

    // Note: Don't send WebSocket message here as the server should handle broadcasting
    // The server should send the vote update to all connected clients

    return {
      success: true,
      status: res.status,
      message: data.message || "Vote berhasil dikirim",
      data: data.data || null,
    };
  } catch (err) {
    console.error("Voting error:", err);
    return {
      success: false,
      status: 0,
      message: "Gagal terhubung ke server.",
      details: err.message,
    };
  }
}

/**
 * Mengambil jumlah total suara berdasarkan ID kandidat
 * @param {string|number} candidateId - ID dari kandidat
 * @returns {Promise<{success: boolean, status: number, data?: {total_votes: number}, message?: string, details?: string}>}
 */
export async function getVotesByCandidate(candidateId) {
  try {
    const res = await fetch(`${BASE_URL}/api/votes/${candidateId}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data?.error?.message || "Gagal mengambil data vote kandidat",
        details: data?.error?.details || null,
      };
    }

    return {
      success: true,
      status: res.status,
      data: data.data,
    };
  } catch (err) {
    console.error("Error fetching votes by candidate:", err);
    return {
      success: false,
      status: 0,
      message: "Gagal terhubung ke server.",
      details: err.message,
    };
  }
}
