import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const POST: APIRoute = async () => {
    const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
    
    const CATEGORIES = {
        'Резюме': ['cv', 'resume', 'резюме', 'соискатель'],
        'Книги': ['.epub', '.fb2', '.mobi'],
        'Изображения': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'],
        'Документы': ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.pptx']
    };

    let movedCount = 0;
    let totalSize = 0;

    try {
        const files = await fs.readdir(DOWNLOADS_DIR);

        for (const file of files) {
            const filePath = path.join(DOWNLOADS_DIR, file);
            const stats = await fs.stat(filePath);

            if (stats.isDirectory()) continue;

            const lowFile = file.toLowerCase();
            let targetFolder = '';

            // Проверка на резюме (по ключевым словам)
            if (CATEGORIES['Резюме'].some(key => lowFile.includes(key))) {
                targetFolder = 'Резюме';
            } else {
                // Проверка по расширениям
                for (const [category, extensions] of Object.entries(CATEGORIES)) {
                    if (category === 'Резюме') continue;
                    if (extensions.some(ext => lowFile.endsWith(ext))) {
                        targetFolder = category;
                        break;
                    }
                }
            }

            if (targetFolder) {
                const targetPath = path.join(DOWNLOADS_DIR, targetFolder);
                await fs.mkdir(targetPath, { recursive: true });
                
                try {
                    const fileSize = stats.size;
                    await fs.rename(filePath, path.join(targetPath, file));
                    movedCount++;
                    totalSize += fileSize;
                } catch (e) {
                    console.error(`Failed to move ${file}`, e);
                }
            }
        }

        return new Response(JSON.stringify({ moved: movedCount, size: totalSize }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
};
