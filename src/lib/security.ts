/**
 * Simple obfuscation utility to make links and IDs less obvious in the source code.
 * Note: This is NOT true encryption, but makes it harder for casual scrapers.
 */

const SECRET_SALT = "SERIES_APP_2024";

export function obfuscate(text: string): string {
  if (!text) return "";
  const salted = text + "::" + SECRET_SALT;
  return btoa(unescape(encodeURIComponent(salted)));
}

export function deobfuscate(encoded: string): string {
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    return decoded.split("::")[0];
  } catch (e) {
    return "";
  }
}

/**
 * More "advanced" obfuscation using a simple XOR cipher
 */
export function encryptValue(text: string): string {
  const key = SECRET_SALT;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  try {
    return btoa(unescape(encodeURIComponent(result)));
  } catch (e) {
    return btoa(result.replace(/[^\x00-\xFF]/g, ""));
  }
}

export function decryptValue(encoded: string): string {
  try {
    const text = decodeURIComponent(escape(atob(encoded)));
    const key = SECRET_SALT;
    let result = "";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    try {
      const text = atob(encoded);
      const key = SECRET_SALT;
      let result = "";
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch (err) {
      return "";
    }
  }
}
