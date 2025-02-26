import fs from 'fs-extra';

async function copyPublicFolder() {
    try {
        await fs.copy('src/public', 'dist/public');
        console.log('📂 Carpeta public copiada correctamente a dist/');
    } catch (err) {
        console.error('❌ Error al copiar public:', err);
    }
}

copyPublicFolder();