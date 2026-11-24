// Plants the missing-logo and overflowing-caption demo defects.
// Repeated runs leave source unchanged after first application.
import fs from 'node:fs';
const file = new URL('../src/video.js', import.meta.url);
const before = fs.readFileSync(file, 'utf8');
const next = before
  .replace("staticFile('logo.svg')", "staticFile('brand/absent-logo.png')")
  .replace("'Turn a preview into a confident final render.'", "'The longest demo caption extends past the edges of this portrait video frame, making the complete message impossible to read at once.'");
if (next !== before) fs.writeFileSync(file, next);
console.log(next === before ? 'demo:break: defects already planted' : 'demo:break: planted wrong logo path and overflowing caption');
