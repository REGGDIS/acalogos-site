import fs from 'fs-extra';
import path from 'path';

const srcPath = path.resolve('src/public');
const destPath = path.resolve('dist/public');

async function copyPublicFolder() {
    try {
        await fs.copy(srcPath, destPath);
        console.log('📂 Carpeta public copiada correctamente a dist/');
    } catch (err) {
        console.error('❌ Error al copiar public:', err);
    }
}

copyPublicFolder();