const fs = require('fs');
const content = fs.readFileSync('./src/App.tsx', 'utf8');
const words = ['railway', 'up.railway', 'hikaytna', 'my', 'الرسمي', 'الجديد', 'عنواننا', 'انتقلنا', 'الانتقال', 'الفوري'];
for (const word of words) {
  const index = content.indexOf(word);
  console.log(`Word "${word}": index = ${index}`);
  if (index !== -1) {
    console.log(`Context: ${JSON.stringify(content.substring(index - 50, index + 50))}`);
  }
}
