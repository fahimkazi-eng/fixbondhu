const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of ['index.html', 'styles.css', 'client.js']) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}
for (const folder of ['pro', 'admin']) {
  fs.cpSync(path.join(root, folder), path.join(out, folder), { recursive: true });
}
