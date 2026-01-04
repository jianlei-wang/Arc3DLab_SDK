/**
 * 开发工作流程脚本
 * 自动构建 SDK 并启动 Vue3 demo 进行测试
 */

const { exec, spawn } = require('child_process');
const { resolve } = require('path');
const fs = require('fs');

const rootDir = resolve(__dirname, '..');
const demoVueDir = resolve(rootDir, 'demo-vue3');

console.log('开始开发工作流程...');

// 步骤1: 构建 SDK
console.log('步骤 1: 构建 SDK...');
exec('npm run build', { cwd: rootDir }, (error, stdout, stderr) => {
  if (error) {
    console.error(`构建 SDK 时出错: ${error}`);
    return;
  }
  
  console.log('SDK 构建成功！');
  console.log(stdout);
  
  // 步骤2: 在 demo-vue3 中安装本地 SDK（使用文件协议）
  console.log('步骤 2: 准备在 demo-vue3 中使用本地 SDK...');
  
  // 更新 demo-vue3 的 package.json，使用本地路径
  const packageJsonPath = resolve(demoVueDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // 修改 arc3dlab 依赖为本地文件路径
  const sdkDistPath = resolve(rootDir, 'dist');
  packageJson.dependencies.arc3dlab = `file:${sdkDistPath}`;
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('已更新 demo-vue3 的 package.json 指向本地 SDK');
  
  // 步骤3: 安装依赖并启动开发服务器
  console.log('步骤 3: 安装依赖并启动开发服务器...');
  
  // 安装更新后的依赖
  exec('npm install', { cwd: demoVueDir }, (installError, installStdout, installStderr) => {
    if (installError) {
      console.error(`安装依赖时出错: ${installError}`);
      return;
    }
    
    console.log('依赖安装成功！');
    
    // 启动开发服务器
    console.log('步骤 4: 启动开发服务器...');
    const devServer = spawn('npm', ['run', 'dev'], { 
      cwd: demoVueDir, 
      stdio: 'inherit',
      shell: true
    });
    
    devServer.on('error', (err) => {
      console.error('启动开发服务器时出错:', err);
    });
    
    console.log('开发服务器已启动，正在监听更改...');
  });
});