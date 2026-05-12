const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, 'front');
const API_URL = 'http://localhost:3000/api/v1';

let errorCount = 0;
let fileCount = 0;

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(path.join(dir, f));
        }
    });
}

function checkFrontend() {
    console.log('--- Frontend Strict Static Analysis Test ---');
    console.log(`Scanning directory: ${FRONTEND_DIR}`);

    walkDir(FRONTEND_DIR, (filePath) => {
        const ext = path.extname(filePath);
        if (['.html', '.js', '.css'].includes(ext)) {
            fileCount++;
            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.relative(__dirname, filePath);

            // 1. Check for API Base URL consistency in JS files
            if (ext === '.js') {
                if (content.includes('fetch(') || content.includes('API_BASE_URL')) {
                    if (!content.includes(API_URL)) {
                        console.error(`[ERROR] JS file ${relativePath} might be missing the correct API_BASE_URL: ${API_URL}`);
                        errorCount++;
                    }
                }
            }

            // 2. Check for missing asset references in HTML files
            if (ext === '.html') {
                const linkRegex = /href=["']([^http].*?\.css)["']/g;
                const scriptRegex = /src=["']([^http].*?\.js)["']/g;
                
                let match;
                while ((match = linkRegex.exec(content)) !== null) {
                    const assetPath = path.resolve(path.dirname(filePath), match[1]);
                    if (!fs.existsSync(assetPath)) {
                        console.error(`[ERROR] Broken CSS link in ${relativePath}: ${match[1]}`);
                        errorCount++;
                    }
                }

                while ((match = scriptRegex.exec(content)) !== null) {
                    const assetPath = path.resolve(path.dirname(filePath), match[1]);
                    if (!fs.existsSync(assetPath)) {
                        console.error(`[ERROR] Broken JS script source in ${relativePath}: ${match[1]}`);
                        errorCount++;
                    }
                }
            }
        }
    });

    console.log('--------------------------------------------');
    console.log(`Scanned ${fileCount} files.`);
    if (errorCount === 0) {
        console.log('✅ ALL TESTS PASSED: Frontend structure and API URLs are consistent.');
    } else {
        console.log(`❌ FAILED: Found ${errorCount} structural errors in frontend files.`);
    }
}

checkFrontend();