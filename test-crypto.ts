function decryptValue(str: string): string {
  try {
    const rawMatch = str.match(/([a-zA-Z0-9+/=]+)/);
    if (!rawMatch) return str;
    const dec = atob(rawMatch[1]);
    let out = "";
    for (let i = 0; i < dec.length; i++) {
        out += String.fromCharCode(dec.charCodeAt(i) ^ 13);
    }
    return out;
  } catch(e) { return str; }
}
const url1 = 'OzEmOTZpcG5hYmwEBgQCfSQ1OnFlZnlofihdQllRITZ8LSAlcDIkIjpTXRxZYDBq';
const url2 = 'OzEmOTZpcG4mOTsGHkhCNyB/LTY9cnFlfixbRFcbFQwUCGhhb3Nmf28DHl9EZw==';
console.log(decryptValue(url1));
console.log(decryptValue(url2));
