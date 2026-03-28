const fs = require('fs');

// Read the file
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace occurrences of req.user.id with safer versions
content = content.replace(/uploadDetails\.userId !== req\.user\.id/g, 
  '!req.user || uploadDetails.userId !== req.user.id');

// Write the file back
fs.writeFileSync(filePath, content);
console.log('Updated user checks in server/routes.ts');
