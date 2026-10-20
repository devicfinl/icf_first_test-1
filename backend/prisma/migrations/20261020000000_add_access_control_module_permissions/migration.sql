-- CreateTable
CREATE TABLE IF NOT EXISTS `system_modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'General',
    `description` VARCHAR(255) NULL,
    `parent_code` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `system_modules_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `module_role_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `module_id` INTEGER NOT NULL,
    `role` VARCHAR(100) NOT NULL,
    `hierarchy_level` INTEGER NOT NULL DEFAULT 0,
    `org_id` INTEGER NOT NULL DEFAULT 0,
    `can_read` BOOLEAN NOT NULL DEFAULT false,
    `can_create` BOOLEAN NOT NULL DEFAULT false,
    `can_update` BOOLEAN NOT NULL DEFAULT false,
    `can_delete` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_role`(`role`),
    INDEX `idx_hierarchy_level`(`hierarchy_level`),
    INDEX `idx_org_id`(`org_id`),
    UNIQUE INDEX `uq_module_role_scope`(`module_id`, `role`, `hierarchy_level`, `org_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `module_role_permissions` ADD CONSTRAINT `module_role_permissions_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `system_modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default system modules
INSERT INTO `system_modules` (`code`, `name`, `category`, `parent_code`, `sort_order`) VALUES
    ('DASHBOARD', 'Dashboard', 'Core', NULL, 1),
    ('PV', 'Pravasi Vayana', 'Core', NULL, 2),
    ('PV_ANALYTICS', 'Pravasi Vayana Analytics', 'Pravasi Vayana', 'PV', 3),
    ('PV_SUBSCRIBERS', 'Pravasi Vayana Subscribers', 'Pravasi Vayana', 'PV', 4),
    ('PV_RENEWALS', 'Pravasi Vayana Renewals', 'Pravasi Vayana', 'PV', 5),
    ('PV_PUBLIC', 'Pravasi Vayana Public Subscriptions', 'Pravasi Vayana', 'PV', 6),
    ('COMMITTEE', 'Committee', 'Organization', NULL, 7),
    ('ICF_CARE', 'ICF Care', 'Services', NULL, 8),
    ('MEETINGS', 'Meetings', 'Activities', NULL, 9),
    ('SIRAJ', 'Siraj Subscriptions', 'Services', NULL, 10),
    ('AYYUHANANAS', 'Ayyuhananas', 'Activities', NULL, 11),
    ('PERFORMANCE_REVIEW', 'Performance Review', 'Reports', NULL, 12),
    ('INBOX', 'Inbox', 'Communication', NULL, 13),
    ('ORGANIZATION', 'Organization', 'Organization', NULL, 14),
    ('FORMS', 'Forms', 'Activities', NULL, 15),
    ('MEMBERS', 'Members', 'Directory', NULL, 16)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `category` = VALUES(`category`), `sort_order` = VALUES(`sort_order`);
