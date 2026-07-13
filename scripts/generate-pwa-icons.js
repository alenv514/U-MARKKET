const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Un PNG base64 súper básico (1x1 pixel azul transparente) para que no rompa la compilación
const placeholderPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const files = [
  'icon-192.png',
  'icon-512.png',
  'icon-192-maskable.png',
  'icon-512-maskable.png'
];

files.forEach(file => {
  fs.writeFileSync(path.join(dir, file), placeholderPng);
  console.log(`[OK] Ícono temporal creado: ${file}`);
});

console.log('\n--- ATENCIÓN ---');
console.log('Estos íconos son temporales para que la PWA pase las validaciones base.');
console.log('Debes reemplazarlos por tu logo oficial (en las resoluciones indicadas) antes del lanzamiento en producción.');
