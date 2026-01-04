/**
 * 开发设置脚本
 * 用于简化 SDK 开发和测试流程
 */

const { exec, spawn } = require('child_process');
const { resolve } = require('path');
const fs = require('fs');

const rootDir = resolve(__dirname, '..');
const demoVueDir = resolve(rootDir, 'demo-vue3');

function buildAndTest() {
  console.log('🔄 开始构建 SDK 并准备测试...');

  // 构建 SDK
  exec('npm run build', { cwd: rootDir }, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ 构建 SDK 时出错: ${error}`);
      return;
    }
    
    console.log('✅ SDK 构建成功！');
    
    // 提供手动测试说明
    console.log('\n📝 现在您可以进行测试:');
    console.log('1. 确保 Vite 配置已正确设置别名指向本地构建文件');
    console.log('2. 在另一个终端中运行: cd demo-vue3 && npm run dev');
    console.log('3. 访问 http://localhost:5173 查看效果');
    
    // 检查 Vite 配置是否已正确设置
    const viteConfigPath = resolve(demoVueDir, 'vite.config.ts');
    if (fs.existsSync(viteConfigPath)) {
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
      if (viteConfig.includes('arc3dlab')) {
        console.log('✅ 检测到 Vite 别名配置已设置');
      } else {
        console.log('⚠️  Vite 配置中未检测到 arc3dlab 别名，请确认已配置');
      }
    }
  });
}

function watchAndTest() {
  console.log('👀 启动开发模式 - 监听文件更改...');

  // 启动 rollup 监听模式
  const buildProcess = spawn('npm', ['run', 'build:watch'], {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit'
  });

  buildProcess.on('error', (err) => {
    console.error('启动构建监听时出错:', err);
  });

  buildProcess.on('close', (code) => {
    console.log(`构建监听进程已退出，退出码 ${code}`);
  });

  console.log('SDK 构建监听已启动。文件更改时会自动重新构建。');
}

// 解析命令行参数
const args = process.argv.slice(2);
if (args.includes('--watch') || args.includes('-w')) {
  watchAndTest();
} else {
  buildAndTest();
}

console.log('\n💡 使用方法:');
console.log('  node scripts/dev-setup.js              # 构建 SDK 并显示测试说明');
console.log('  node scripts/dev-setup.js --watch     # 启动监听模式');