const regex = /(https?:(?:\\?\/){2}[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?:(?:\\?\/)[^\s"']*)?\.(?:mp4|m3u8|webm)(?:\?[^\s"']*)?)/gi;
const test1 = 'http://example.com/video.mp4';
const test2 = 'https:\\/\\/example.com\\/video.m3u8';
const test3 = 'https://example.com/playlist.m3u8?token=123';
console.log(test1.match(regex));
console.log(test2.match(regex));
console.log(test3.match(regex));
