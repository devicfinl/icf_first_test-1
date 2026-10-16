-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_name` VARCHAR(500) NOT NULL,
    `password` VARCHAR(500) NOT NULL,
    `name` VARCHAR(500) NOT NULL,
    `member_no` VARCHAR(100) NOT NULL,
    `org_id` INTEGER NOT NULL,
    `role` VARCHAR(100) NOT NULL,
    `default_role` INTEGER NULL,
    `active` INTEGER NOT NULL,
    `is_office_user` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_master` (
    `mid` INTEGER NOT NULL,
    `membership_no` VARCHAR(20) NOT NULL,
    `member_name` VARCHAR(50) NOT NULL,
    `father_name` VARCHAR(50) NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `mobile_country` VARCHAR(10) NOT NULL,
    `mobile` VARCHAR(20) NOT NULL,
    `whatsapp_no` VARCHAR(50) NOT NULL,
    `mobile_in` VARCHAR(20) NOT NULL,
    `address_gulf` TEXT NOT NULL,
    `housename_in` VARCHAR(50) NOT NULL,
    `place_in` VARCHAR(50) NOT NULL,
    `post_in` VARCHAR(50) NOT NULL,
    `district_in_id` INTEGER NOT NULL,
    `date_of_birth` VARCHAR(20) NOT NULL,
    `profession_id` INTEGER NOT NULL,
    `bloodgroup_id` INTEGER NULL,
    `education_id` INTEGER NULL,
    `islamic_education_id` INTEGER NULL,
    `unit_india` VARCHAR(50) NOT NULL,
    `zone_india` VARCHAR(50) NOT NULL,
    `image_url` TEXT NOT NULL,
    `cmt_designation` INTEGER NOT NULL,
    `isverified` VARCHAR(1) NOT NULL,
    `mem_type` CHAR(2) NOT NULL,
    `transferred` VARCHAR(50) NOT NULL,
    `active` INTEGER NOT NULL,

    PRIMARY KEY (`mid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_details` (
    `md_id` INTEGER NOT NULL,
    `master_mid` INTEGER NOT NULL,
    `emailId` VARCHAR(75) NULL,
    `WhatsAppNo` VARCHAR(25) NULL,
    `city` INTEGER NULL,
    `gender` VARCHAR(25) NULL,
    `MaritalStatus` CHAR(1) NULL,

    PRIMARY KEY (`md_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domain_items` (
    `did` INTEGER NOT NULL,
    `dname` VARCHAR(191) NULL,
    `dvalue` VARCHAR(191) NULL,

    PRIMARY KEY (`did`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `countries` (
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `phone_code` INTEGER NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `committee_designations` (
    `desid` INTEGER NOT NULL,
    `desig_name` VARCHAR(50) NOT NULL,
    `desig_level` INTEGER NOT NULL,
    `is_councilor` VARCHAR(1) NOT NULL,
    `councilor_filter` VARCHAR(2) NOT NULL,
    `orgtype` INTEGER NOT NULL,
    `directorate_id` VARCHAR(250) NULL,
    `level` INTEGER NULL,
    `multi_allowed` VARCHAR(1) NOT NULL,
    `department_id` INTEGER NOT NULL,
    `is_cabinet` VARCHAR(1) NULL,
    `is_senate` VARCHAR(1) NOT NULL,
    `desig_value` SMALLINT NULL,

    PRIMARY KEY (`desid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `committee_members` (
    `cmid` INTEGER NOT NULL,
    `cdesign_id` INTEGER NOT NULL,
    `cmem_id` INTEGER NOT NULL,
    `corg_id` INTEGER NOT NULL,
    `image_url` TEXT NULL,

    PRIMARY KEY (`cmid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cities` (
    `id` INTEGER NOT NULL,
    `country_code` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organisation_master` (
    `orgid` INTEGER NOT NULL,
    `orgname` VARCHAR(100) NULL,
    `reg_no` VARCHAR(20) NOT NULL,
    `loginname` VARCHAR(100) NULL,
    `ilal_username` VARCHAR(50) NULL,
    `delivery_username` VARCHAR(100) NULL,
    `masool_username` VARCHAR(100) NULL,
    `sirajdelivery_username` VARCHAR(100) NULL,
    `last_logged` TIMESTAMP(0) NOT NULL,
    `hpattern` INTEGER NULL,
    `hlevel` INTEGER NULL,
    `hparent` INTEGER NULL,
    `addedBy` INTEGER NULL,
    `remarks` VARCHAR(50) NULL,
    `country_code` VARCHAR(2) NOT NULL,
    `connect_status` VARCHAR(10) NOT NULL,
    `connect_auth` VARCHAR(100) NULL,

    PRIMARY KEY (`orgid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hierarchy_names` (
    `hnid` INTEGER NOT NULL,
    `hlevel` INTEGER NULL,
    `hlevelname` VARCHAR(191) NULL,

    PRIMARY KEY (`hnid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vayana_subscription` (
    `ID` INTEGER NOT NULL,
    `amount` DOUBLE NULL,
    `price_digital` DOUBLE NULL,
    `price_print_digital` DOUBLE NULL,
    `country` VARCHAR(2) NULL,
    `currency` VARCHAR(20) NULL,
    `year` VARCHAR(4) NULL,
    `campaign_status` VARCHAR(30) NULL,
    `closed_on` DATE NULL,

    PRIMARY KEY (`ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pv_subscription_master` (
    `subscriber_id` INTEGER NOT NULL AUTO_INCREMENT,
    `ledger_no` VARCHAR(100) NULL,
    `name` VARCHAR(500) NOT NULL,
    `mobile_country` VARCHAR(20) NULL,
    `mobile` VARCHAR(100) NULL,
    `whatsapp_country` VARCHAR(20) NULL,
    `whatsapp` VARCHAR(100) NULL,
    `tel` VARCHAR(100) NULL,
    `email` VARCHAR(320) NULL,
    `religion` VARCHAR(100) NULL,
    `is_icf_member` VARCHAR(191) NULL,
    `membership_id` VARCHAR(100) NULL,
    `status` VARCHAR(191) NOT NULL,
    `first_subscribed_at` DATETIME(3) NULL,

    PRIMARY KEY (`subscriber_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vayana_campaign` (
    `campaignId` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `startDate` DATE NULL,
    `endDate` DATE NULL,
    `status` ENUM('Draft', 'Active', 'Closed') NOT NULL DEFAULT 'Draft',
    `createdBy` INTEGER NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_vayana_campaign_name`(`name`),
    PRIMARY KEY (`campaignId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vayana_subscription_entity_new` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaignId` INTEGER NOT NULL,
    `setByOrg` INTEGER NOT NULL,
    `setByLevel` VARCHAR(100) NOT NULL,
    `setByName` VARCHAR(100) NOT NULL,
    `setToOrg` INTEGER NOT NULL,
    `setToLevel` VARCHAR(100) NOT NULL,
    `setToName` VARCHAR(100) NOT NULL,
    `targetPrint` INTEGER NOT NULL DEFAULT 0,
    `targetDigital` INTEGER NOT NULL DEFAULT 0,
    `campaign_status` VARCHAR(30) NOT NULL DEFAULT 'Active',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `createdBy` INTEGER NULL,
    `updatedBy` INTEGER NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_target_campaign`(`campaignId`),
    UNIQUE INDEX `uq_target_place_campaign`(`setToOrg`, `campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vayana_subscription_entity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setByOrg` INTEGER NOT NULL,
    `setByLevel` VARCHAR(100) NOT NULL,
    `setByName` VARCHAR(100) NOT NULL,
    `setToOrg` INTEGER NOT NULL,
    `setToLevel` VARCHAR(100) NOT NULL,
    `setToName` VARCHAR(100) NOT NULL,
    `target` INTEGER NOT NULL,
    `campaign_status` VARCHAR(30) NOT NULL DEFAULT 'Active',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vayana_subscription_entity_new` ADD CONSTRAINT `fk_target_campaign` FOREIGN KEY (`campaignId`) REFERENCES `vayana_campaign`(`campaignId`) ON DELETE RESTRICT ON UPDATE CASCADE;

