import fetch from 'node-fetch';

const SECRET_SALT = "SERIES_APP_2024";
function decryptValue(encoded) {
  try {
    const text = atob(encoded);
    const key = SECRET_SALT;
    let result = "";
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch(e) {
    return e.toString();
  }
}

async function test() {
  const res = await fetch('http://localhost:3000/api/v1/config/firebase');
  const d = await res.json();
  const config = Object.fromEntries(
    Object.entries(d.data).map(([key, val]) => [key, decryptValue(val)])
  );
  console.log(config);
}
test();
