/**
 * Arc3DLab SDK 文档生成脚本
 * 此脚本使用 TypeDoc 生成 API 文档
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create docs directory if it doesn't exist
const docsDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

console.log('正在生成 API 文档...');

// Run typedoc command
exec('npx typedoc --options typedoc.json', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error generating documentation: ${error}`);
    return;
  }
  
  if (stderr) {
    console.warn(`Warnings: ${stderr}`);
  }
  
  console.log('文档生成成功！');
  console.log(stdout);
  
  // Create an index.html file to redirect to the API docs
  const indexPath = path.join(docsDir, 'index.html');
  const indexContent = `<!DOCTYPE html>
<html>
<head>
  <title>Arc3DLab SDK 中文文档</title>
  <meta http-equiv="refresh" content="0; url=./api/" />
</head>
<body>
  <p>正在跳转到 <a href="./api/">API 文档</a>...</p>
</body>
</html>`;
  
  fs.writeFileSync(indexPath, indexContent);
  console.log('Documentation index created.');
});