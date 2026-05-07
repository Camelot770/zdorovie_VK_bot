/**
 * VK Bridge integration.
 *
 * VK passes launch params in URL: ?vk_user_id=...&vk_app_id=...&sign=...
 * We extract vk_user_id and use it as our user identifier.
 *
 * Optionally we send launch params to backend for HMAC verification (not required for MVP).
 */
import bridge from "@vkontakte/vk-bridge";

export type VkLaunchParams = {
  vk_user_id?: string;
  vk_app_id?: string;
  vk_platform?: string;
  vk_language?: string;
  vk_ref?: string;
  sign?: string;
  [key: string]: string | undefined;
};

/** Parse all VK launch params from window.location.search */
export function getLaunchParams(): VkLaunchParams {
  const params: VkLaunchParams = {};
  const sp = new URLSearchParams(window.location.search);
  sp.forEach((value, key) => {
    if (key.startsWith("vk_") || key === "sign") {
      params[key] = value;
    }
  });
  return params;
}

/** Get the current VK user ID from launch params (or fall back to localStorage / URL `userId`). */
export function getVkUserId(): string | null {
  const lp = getLaunchParams();
  if (lp.vk_user_id) {
    localStorage.setItem("vk_user_id", lp.vk_user_id);
    return lp.vk_user_id;
  }
  // URL fallback (for dev / direct browser open)
  const sp = new URLSearchParams(window.location.search);
  const fromUrl = sp.get("userId") || sp.get("vk_user_id");
  if (fromUrl) {
    localStorage.setItem("vk_user_id", fromUrl);
    return fromUrl;
  }
  return localStorage.getItem("vk_user_id");
}

/** Initialise VK Bridge — call once on app startup. */
export async function initVkBridge(): Promise<void> {
  try {
    await bridge.send("VKWebAppInit");
  } catch {
    // Running outside VK (e.g. browser dev) — ignore
  }
}

/** Get user info via VK Bridge (requires app to be opened in VK). */
export async function getVkUserInfo(): Promise<{
  id: number;
  first_name: string;
  last_name: string;
  photo_100?: string;
} | null> {
  try {
    const data = await bridge.send("VKWebAppGetUserInfo");
    return {
      id: data.id,
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      photo_100: data.photo_100,
    };
  } catch {
    return null;
  }
}

/**
 * Request the user's phone number through VK Bridge.
 * Requires the mini-app to have `phone` scope (granted via VK moderation).
 *
 * Returns digits-only phone string or null if user declines / scope missing.
 */
export async function requestPhoneNumber(): Promise<string | null> {
  try {
    const data = await bridge.send("VKWebAppGetPhoneNumber");
    if (data && data.phone_number) {
      return String(data.phone_number).replace(/\D/g, "");
    }
    return null;
  } catch {
    return null;
  }
}

/** Show VK system alert. */
export async function showAlert(message: string): Promise<void> {
  try {
    // VK Bridge doesn't have a native alert — fall back to browser alert
    window.alert(message);
  } catch {
    /* noop */
  }
}

/** Open VK community page. */
export async function openCommunity(groupId: number): Promise<void> {
  try {
    window.open(`https://vk.com/club${groupId}`, "_blank");
  } catch {
    /* noop */
  }
}

export default bridge;
