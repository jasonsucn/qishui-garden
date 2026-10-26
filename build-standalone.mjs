import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const stripModuleSyntax = source => source
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+default\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
  .replace(/^export\s+(?=(?:async\s+)?function\s|class\s|const\s|let\s|var\s)/gm, '');

const modules = [
  ['audio', 'js/audio.js', ['GardenAudio']],
  ['pond', 'js/pond.js', ['createPond', 'POND_CONTOUR', 'WATER_LEVEL']],
  ['architecture', 'js/architecture.js', ['createArchitecture']],
  ['nature', 'js/nature.js', ['createNature']],
  ['weather', 'js/weather.js', ['createWeather']]
];
let bundle = `import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 栖水园单文件版：以下为浏览器本地模块的无打包器封装。
const __gardenModules = {};
`;
for (const [name, path, exports] of modules) {
  bundle += `\n__gardenModules.${name} = (() => {\n${stripModuleSyntax(read(path))}\nreturn { ${exports.join(', ')} };\n})();\n`;
}
bundle += `\n(() => {
const { GardenAudio } = __gardenModules.audio;
const { createPond, POND_CONTOUR, WATER_LEVEL } = __gardenModules.pond;
const { createArchitecture } = __gardenModules.architecture;
const { createNature } = __gardenModules.nature;
const { createWeather } = __gardenModules.weather;
${stripModuleSyntax(read('js/main.js'))}
})();\n`;

let html = read('index.html');
html = html.replace(/\s*<link rel="stylesheet" href="style\.css"\s*\/>/, () => `\n  <style>\n${read('style.css')}\n  </style>`);
html = html.replace(/\s*<script type="module" src="js\/main\.js"[^>]*><\/script>/, () => `\n  <script type="module">\n${bundle}\n  </script>`);
html = html.replace('<html lang="zh-CN">', '<html lang="zh-CN">\n<!-- 栖水园单文件版 · 可直接双击打开；首次需联网加载 Three.js。 -->');
const output = new URL('栖水园.html', import.meta.url);
writeFileSync(output, html, 'utf8');
console.log(`已生成 栖水园.html（${(Buffer.byteLength(html) / 1024).toFixed(1)} KB）`);
