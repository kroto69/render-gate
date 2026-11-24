// Restores the working logo and concise caption after demo:break.
// Repeated runs are safe and report whether any repair was needed.
import fs from 'node:fs';
const file = new URL('../src/video.js', import.meta.url);
const before = fs.readFileSync(file, 'utf8');
const after = before
  .replace("staticFile('brand/absent-logo.png')", "staticFile('logo.svg')")
  .replace("'The longest demo caption extends past the edges of this portrait video frame, making the complete message impossible to read at once.'", "'Turn a preview into a confident final render.'");
if (after !== before) fs.writeFileSync(file, after);
console.log(after === before ? 'demo:fix: already fixed' : 'demo:fix: restored logo path and caption');
