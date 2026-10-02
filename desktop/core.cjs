const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
function inside(root, file, flavor = path) {
  const relative = flavor.relative(flavor.resolve(root), flavor.resolve(file));
  return relative === '' || (!relative.startsWith('..' + flavor.sep) && relative !== '..' && !flavor.isAbsolute(relative));
}
function terms(question) {
  const stop = new Set('a an the is are was were my me find show please what where when about does do say says of in on and or to this that these those all file files document documents summarize summary give tell it for with'.split(' '));
  return [...new Set((question.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []).filter(t => t.length > 1 && !stop.has(t)))].slice(0, 20);
}
function chunks(text, size = 1400, overlap = 180) {
  const out = []; text = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim();
  for (let i=0; i < text.length; i += size-overlap) out.push(text.slice(i, i+size));
  return out;
}
function idFor(file, location, i) { return crypto.createHash('sha256').update(`${file}\0${location}\0${i}`).digest('hex').slice(0,24); }
async function realAllowed(file, roots, directory = false) {
  const real = await fs.realpath(file);
  if (!roots.some(root => inside(root, real))) throw new Error('This location is outside your enabled roots.');
  const stat = await fs.stat(real);
  if (directory ? !stat.isDirectory() : !stat.isFile()) throw new Error('The selected path has the wrong type.');
  return { real, stat };
}
const safeOpenExtensions = new Set('.pdf .docx .pptx .xlsx .txt .md .csv .json .log .png .jpg .jpeg .gif .webp'.split(' '));
module.exports = { inside, terms, chunks, idFor, realAllowed, safeOpenExtensions };
