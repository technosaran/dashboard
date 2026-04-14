const fs = require('fs');

const path = "d:/dashboard/src/app/dashboard/DashboardClient.tsx";
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /return \(\s*\{\/\* 📱 MOBILE EXCLUSIVE: DATA ENTRY HUB \*\/\}/,
  'return (\n    <>\n      {/* 📱 MOBILE EXCLUSIVE: DATA ENTRY HUB */}'
);

content = content.replace(
  /      <\/div>\s*<\/div>\s*\);\s*\}/,
  '      </div>\n    </div>\n    </>\n  );\n}'
);

// We had some extra divs generated
content = content.replace(
  /<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\s*\}\s*$/,
    `      </div>
    </>
  );
}`
);

fs.writeFileSync(path, content, 'utf8');
