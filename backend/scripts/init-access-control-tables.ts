import { prisma } from "../src/db/index.js";

async function main() {
  console.log("Creating system_modules and module_role_permissions tables...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`system_modules\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`code\` VARCHAR(50) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`category\` VARCHAR(50) NOT NULL DEFAULT 'General',
      \`description\` VARCHAR(255) NULL,
      \`parent_code\` VARCHAR(50) NULL,
      \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`sort_order\` INT NOT NULL DEFAULT 0,
      \`created_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
      \`updated_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`uq_system_modules_code\` (\`code\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`module_role_permissions\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`module_id\` INT NOT NULL,
      \`role\` VARCHAR(100) NOT NULL,
      \`hierarchy_level\` INT NOT NULL DEFAULT 0,
      \`org_id\` INT NOT NULL DEFAULT 0,
      \`can_read\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`can_create\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`can_update\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`can_delete\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`created_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
      \`updated_at\` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`uq_module_role_scope\` (\`module_id\`, \`role\`, \`hierarchy_level\`, \`org_id\`),
      INDEX \`idx_role\` (\`role\`),
      INDEX \`idx_hierarchy_level\` (\`hierarchy_level\`),
      INDEX \`idx_org_id\` (\`org_id\`),
      CONSTRAINT \`fk_module_role_module\` FOREIGN KEY (\`module_id\`) REFERENCES \`system_modules\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  console.log("Tables created successfully.");

  // Seed default modules if not present
  const defaultModules = [
    { code: "DASHBOARD", name: "Dashboard", category: "Core", sortOrder: 1 },
    { code: "PV", name: "Pravasi Vayana", category: "Core", sortOrder: 2 },
    { code: "PV_ANALYTICS", name: "Pravasi Vayana Analytics", category: "Pravasi Vayana", parentCode: "PV", sortOrder: 3 },
    { code: "PV_SUBSCRIBERS", name: "Pravasi Vayana Subscribers", category: "Pravasi Vayana", parentCode: "PV", sortOrder: 4 },
    { code: "PV_RENEWALS", name: "Pravasi Vayana Renewals", category: "Pravasi Vayana", parentCode: "PV", sortOrder: 5 },
    { code: "PV_PUBLIC", name: "Pravasi Vayana Public Subscriptions", category: "Pravasi Vayana", parentCode: "PV", sortOrder: 6 },
    { code: "COMMITTEE", name: "Committee", category: "Organization", sortOrder: 7 },
    { code: "ICF_CARE", name: "ICF Care", category: "Services", sortOrder: 8 },
    { code: "MEETINGS", name: "Meetings", category: "Activities", sortOrder: 9 },
    { code: "SIRAJ", name: "Siraj Subscriptions", category: "Services", sortOrder: 10 },
    { code: "AYYUHANANAS", name: "Ayyuhananas", category: "Activities", sortOrder: 11 },
    { code: "PERFORMANCE_REVIEW", name: "Performance Review", category: "Reports", sortOrder: 12 },
    { code: "INBOX", name: "Inbox", category: "Communication", sortOrder: 13 },
    { code: "ORGANIZATION", name: "Organization", category: "Organization", sortOrder: 14 },
    { code: "FORMS", name: "Forms", category: "Activities", sortOrder: 15 },
    { code: "MEMBERS", name: "Members", category: "Directory", sortOrder: 16 },
  ];

  for (const mod of defaultModules) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`system_modules\` (\`code\`, \`name\`, \`category\`, \`parent_code\`, \`sort_order\`)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`category\` = VALUES(\`category\`), \`sort_order\` = VALUES(\`sort_order\`)`,
      mod.code,
      mod.name,
      mod.category,
      mod.parentCode ?? null,
      mod.sortOrder
    );
  }

  console.log("Default modules seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
