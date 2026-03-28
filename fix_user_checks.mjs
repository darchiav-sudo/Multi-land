import { readFileSync, writeFileSync } from 'fs';

// Read the file
const filePath = 'server/routes.ts';
let content = readFileSync(filePath, 'utf-8');

// Replace occurrences of req.user.id with safer versions
content = content.replace(/uploadDetails\.userId !== req\.user\.id/g, 
  '!req.user || uploadDetails.userId !== req.user.id');

// Write the file back
writeFileSync(filePath, content);
console.log('Updated user checks in server/routes.ts');
