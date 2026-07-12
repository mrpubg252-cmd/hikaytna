const fs = require('fs');
let code = fs.readFileSync('src/screens/WatchScreen.tsx', 'utf8');

// 1. Remove manual progress UI
const manualStart = code.indexOf('{/* Watch Progress Assistant Card */}');
const nextSection = code.indexOf('{isAdmin && (');
if (manualStart !== -1 && nextSection !== -1) {
    code = code.substring(0, manualStart) + code.substring(nextSection);
}

// 2. Remove servers from bottom
const serversStart = code.indexOf('{/* Servers Section - Labeled cleanly as Server 1, Server 2... */}');
const afterServers = manualStart; // The manual card was right after
if (serversStart !== -1 && serversStart < nextSection) {
    // Need to find exactly where to cut.
    const serversEnd = code.indexOf('{/* Watch Progress Assistant Card */}', serversStart);
    // Actually since we already cut manual card, let's just do it sequentially.
}
