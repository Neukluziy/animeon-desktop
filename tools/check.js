const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', '.vscode', 'coverage', 'dist', 'node_modules']);
const failures = [];

function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectJavaScriptFiles(path.join(directory, entry.name)));
      }
    } else if (entry.isFile() && /\.js$/i.test(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function checkJavaScriptSyntax() {
  const files = collectJavaScriptFiles(projectRoot);
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: projectRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0) {
      failures.push(
        `JavaScript syntax error in ${path.relative(projectRoot, file)}:\n${result.stderr || result.stdout}`,
      );
    }
  }
  console.log(`Checked JavaScript syntax in ${files.length} files.`);
}

function checkBuildFiles() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const patterns = packageJson.build?.files;
  if (!Array.isArray(patterns)) {
    failures.push('package.json must define build.files as an array.');
    return;
  }

  for (const rawPattern of patterns) {
    const pattern = String(rawPattern).replace(/\\/g, '/');
    const wildcardIndex = pattern.search(/[?*[{]/);
    const concretePath = (wildcardIndex === -1 ? pattern : pattern.slice(0, wildcardIndex)).replace(/\/+$/, '');
    const resolvedPath = path.resolve(projectRoot, ...concretePath.split('/').filter(Boolean));
    if (!concretePath || !fs.existsSync(resolvedPath)) {
      failures.push(`Missing build.files path: ${rawPattern}`);
      continue;
    }

    if (wildcardIndex !== -1 && fs.statSync(resolvedPath).isDirectory()) {
      const hasFile = (directory) =>
        fs.readdirSync(directory, { withFileTypes: true }).some((entry) => {
          if (entry.isFile()) return true;
          return entry.isDirectory() && hasFile(path.join(directory, entry.name));
        });
      if (!hasFile(resolvedPath)) failures.push(`build.files pattern has no files: ${rawPattern}`);
    }
  }
  console.log(`Checked ${patterns.length} build.files entries.`);
}

function checkLocalHtmlAssets() {
  const htmlPath = path.join(projectRoot, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const references = /\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi;
  let match;
  let checked = 0;

  while ((match = references.exec(html)) !== null) {
    const reference = match[2].split(/[?#]/, 1)[0];
    if (!/\.(?:css|js)$/i.test(reference) || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) continue;
    checked += 1;
    const assetPath = path.resolve(projectRoot, ...decodeURIComponent(reference).replace(/\\/g, '/').split('/'));
    if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
      failures.push(`Missing local CSS/JS reference in index.html: ${reference}`);
    }
  }
  console.log(`Checked ${checked} local CSS/JS references in index.html.`);
}

checkJavaScriptSyntax();
checkBuildFiles();
checkLocalHtmlAssets();

if (failures.length > 0) {
  console.error(`\n${failures.length} project check(s) failed:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('All project checks passed.');
}
