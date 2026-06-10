const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    if (fs.statSync(file).isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;
  content = content.replace(/<button(?![^>]*\btype=)([^>]*)>/g, '<button type="button"$1>');
  if (content !== original) {
    fs.writeFileSync(f, content);
    console.log('Fixed buttons in ' + f);
  }
});
