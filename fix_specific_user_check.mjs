import { readFileSync, writeFileSync } from 'fs';

// Read the file
const filePath = 'server/routes.ts';
let content = readFileSync(filePath, 'utf-8');

// Replace the specific occurrence at line 2974
content = content.replace(/userId: req\.user\.id,/, 'userId: req.user?.id || 0,');

// Write the file back
writeFileSync(filePath, content);
console.log('Updated user check in server/routes.ts');
