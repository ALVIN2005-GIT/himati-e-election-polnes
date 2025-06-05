const BASE_URL = "https://api-hima-ti-e-election.sgp.dom.my.id";

export async function login(nimOrPassword, passwordOnly = null) {
  const body = passwordOnly
    ? { nim: nimOrPassword, password: passwordOnly } // student
    : { password: nimOrPassword }; // admin

  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get("content-type");
    const data = contentType?.includes("application/json")
      ? await res.json()
      : {};

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message:
          data?.error?.message || "Gagal login | NIM atau Password salah",
        details: data?.error?.details || null,
      };
    }

    return {
      success: true,
      status: res.status,
      message: data.message,
      user: data.data,
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      message: "Gagal terhubung ke server.",
      details: err.message || "Unknown error",
    };
  }
}

/**
 * Ambil user yang sedang login dari session (cookie)
 */
export async function getCurrentUser() {
  try {
    const res = await fetch(`${BASE_URL}/api/users/current`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data?.error?.message || "Gagal mengambil data user",
        details: data?.error?.details || null,
      };
    }

    return {
      success: true,
      status: res.status,
      user: data.data,
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      message: "Gagal terhubung ke server.",
      details: err.message || "Unknown error",
    };
  }
}

export async function logoutUser() {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include", // penting kalau pakai cookie session
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        message: data.message,
      };
    } else {
      return {
        success: false,
        message: data.error?.message,
        details: data.error?.details,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Terjadi kesalahan saat logout",
      details: error.message,
    };
  }
}
