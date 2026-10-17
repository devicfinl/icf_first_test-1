-- =====================================================================================
-- Migrate vayana_master_single -> pv_subscription_master + pv_subscription_details
-- MySQL 8. Spec: docs/Migrate.md
--
-- How to run (mysql CLI, against the target database):
--   mysql ... < backend/sql/migrate-pv-subscriptions.sql
--
-- By default this is a DRY RUN: every step and check runs, the report is printed, and then
-- everything is rolled back. To keep the data, change the last line to CALL pv_migrate(1).
-- The script is re-runnable: each run clears both target tables before loading them again.
-- WARNING: it DELETES everything currently in pv_subscription_master and pv_subscription_details.
--
-- subscription_id links each subscription to the price table (docs: backend/src/modules/pv/task.md
-- section 3.1), and currency comes from countries. Both are found through the unit's country:
--   unit_id -> organisation_master.country_code -> price table (country + year) / countries.code
-- =====================================================================================

DELIMITER $$

-- -------------------------------------------------------------------------------------
-- Step 0: create the two target tables if they don't exist yet, and drop the two
-- legacy columns an earlier version added.
-- MySQL commits table changes on its own, so this happens before, and outside, the
-- migration transaction. An existing table is never dropped or re-created.
-- -------------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS pv_create_tables $$
CREATE PROCEDURE pv_create_tables()
BEGIN
  DECLARE v_n           INT;
  DECLARE v_price_table VARCHAR(64);
  DECLARE v_id_type     VARCHAR(100);
  DECLARE v_msg         VARCHAR(255);

  CREATE TABLE IF NOT EXISTS pv_subscription_master (
    subscriber_id       INT NOT NULL AUTO_INCREMENT,
    ledger_no           VARCHAR(100)  NULL,
    name                VARCHAR(500) NOT NULL,
    mobile_country      VARCHAR(20)  NULL,
    mobile              VARCHAR(100)  NULL,
    whatsapp_country    VARCHAR(20)  NULL,
    whatsapp            VARCHAR(100)  NULL,
    tel                 VARCHAR(100)  NULL,
    email               VARCHAR(320) NULL,
    religion            VARCHAR(100)  NULL,
    is_icf_member       ENUM('Yes','No') NULL,
    membership_id       VARCHAR(100)  NULL,
    status              ENUM('PENDING','ACTIVE','REJECTED') NOT NULL DEFAULT 'PENDING',
    first_subscribed_at DATETIME NULL,
    updated_at          DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (subscriber_id),
    KEY idx_pv_master_mobile (mobile_country, mobile),
    KEY idx_pv_master_ledger (ledger_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS pv_subscription_details (
    subscriber_id            INT NOT NULL,
    unit_id                  INT NOT NULL,
    registration_type        ENUM('NEW','RENEW') NOT NULL DEFAULT 'NEW',
    registration_method      ENUM('DIRECT','PUBLIC') NOT NULL DEFAULT 'DIRECT',
    approval_status          ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    approved_by              INT NULL,
    approved_at              DATETIME NULL,
    reject_reason            VARCHAR(500) NULL,
    previous_year_user       ENUM('Yes','No') NULL,
    subscription_year        INT NULL,
    subscription_from        VARCHAR(50) NULL,
    subscription_to          VARCHAR(50) NULL,
    subscription_mode        ENUM('Print','Digital','Print&Digital') NOT NULL,
    quantity                 INT NULL,
    currency                 VARCHAR(10) NULL,
    amount                   DECIMAL(10,2) NULL,
    cash_received            ENUM('Y','N') NULL,
    p_status                 VARCHAR(100)  NULL,
    c_status                 VARCHAR(100)  NULL,
    shop_name                VARCHAR(500) NULL,
    floor_no                 VARCHAR(500)  NULL,
    building_name            VARCHAR(500) NULL,
    landmark                 VARCHAR(500) NULL,
    street                   VARCHAR(500) NULL,
    area                     VARCHAR(500) NULL,
    province                 VARCHAR(500) NULL,
    address_change           ENUM('Yes','No') NULL,
    distributor_area         VARCHAR(500) NULL,
    delivery_responsibility  VARCHAR(500) NULL,
    contact_person_name      VARCHAR(500) NULL,
    organiser_name           VARCHAR(500) NULL,
    organiser_mobile         VARCHAR(100)  NULL,
    organiser_country        VARCHAR(20)  NULL,
    ledger_no                VARCHAR(100)  NULL,
    added_by                 INT NULL,
    created_at               DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_pv_details_unit (unit_id),
    KEY idx_pv_details_year (subscription_year),
    CONSTRAINT fk_pv_details_subscriber
      FOREIGN KEY (subscriber_id) REFERENCES pv_subscription_master (subscriber_id),
    CONSTRAINT chk_pv_public_is_new
      CHECK (registration_method <> 'PUBLIC' OR registration_type = 'NEW')
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  -- An earlier version of this script added two legacy columns. They are no longer used,
  -- so drop them from a table that still has them.
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pv_subscription_details'
      AND COLUMN_NAME = 'legacy_previous_pvid'
  ) THEN
    ALTER TABLE pv_subscription_details DROP COLUMN legacy_previous_pvid;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pv_subscription_details'
      AND COLUMN_NAME = 'legacy_added_by_name'
  ) THEN
    ALTER TABLE pv_subscription_details DROP COLUMN legacy_added_by_name;
  END IF;

  -- The price table: one row per country per year (task.md 3.1). Its name isn't confirmed, so
  -- it is found by its columns. Exactly one table must match, or nothing runs.
  SELECT COUNT(*), MIN(TABLE_NAME) INTO v_n, v_price_table
  FROM (
    SELECT TABLE_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(COLUMN_NAME) IN ('id', 'country', 'year', 'price_digital')
    GROUP BY TABLE_NAME
    HAVING COUNT(*) = 4
  ) t;

  IF v_n <> 1 THEN
    SET v_msg = CONCAT('Expected exactly 1 price table (columns ID, country, year, price_digital), found ', v_n);
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'countries' AND LOWER(COLUMN_NAME) = 'currency'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'countries has no currency column';
  END IF;

  -- An old auto-increment subscription_id (the row key) can't take price table IDs.
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pv_subscription_details'
      AND COLUMN_NAME = 'subscription_id' AND EXTRA LIKE '%auto_increment%'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'pv_subscription_details.subscription_id is still the old auto-increment key; drop it before running';
  END IF;

  -- subscription_id: the price table row this subscription was sold under. Same type as the
  -- price table's ID, which a foreign key requires.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pv_subscription_details' AND COLUMN_NAME = 'subscription_id'
  ) THEN
    SELECT COLUMN_TYPE INTO v_id_type
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = v_price_table AND LOWER(COLUMN_NAME) = 'id';

    SET @pv_sql = CONCAT('ALTER TABLE pv_subscription_details ADD COLUMN subscription_id ', v_id_type,
                         ' NULL AFTER subscriber_id, ADD KEY idx_pv_details_subscription (subscription_id)');
    PREPARE pv_stmt FROM @pv_sql;
    EXECUTE pv_stmt;
    DEALLOCATE PREPARE pv_stmt;
  END IF;

  -- The foreign key, when both tables are InnoDB (MySQL has no foreign keys on other engines,
  -- and some legacy tables are MyISAM). Otherwise the link is by value only, and the report says so.
  SET @pv_fk_note = NULL;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pv_subscription_details'
      AND CONSTRAINT_NAME = 'fk_pv_details_subscription'
  ) THEN
    IF (SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (v_price_table, 'pv_subscription_details')
          AND ENGINE = 'InnoDB') = 2 THEN
      SET @pv_sql = CONCAT('ALTER TABLE pv_subscription_details ADD CONSTRAINT fk_pv_details_subscription ',
                           'FOREIGN KEY (subscription_id) REFERENCES `', v_price_table, '` (ID)');
      PREPARE pv_stmt FROM @pv_sql;
      EXECUTE pv_stmt;
      DEALLOCATE PREPARE pv_stmt;
    ELSE
      SET @pv_fk_note = CONCAT('no foreign key: `', v_price_table, '` is not InnoDB');
    END IF;
  END IF;

  -- Read by pv_migrate.
  SET @pv_price_table = v_price_table;
END $$

-- -------------------------------------------------------------------------------------
-- The migration itself. p_commit = 0: dry run (always roll back). 1: commit if all checks pass.
-- -------------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS pv_migrate $$
CREATE PROCEDURE pv_migrate(IN p_commit TINYINT)
main: BEGIN
  DECLARE v_failures INT DEFAULT 0;

  -- Any SQL error (bad value for a column, FK violation, ...) undoes everything and says why.
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1 @pv_err_no = MYSQL_ERRNO, @pv_err_msg = MESSAGE_TEXT;
    ROLLBACK;
    SELECT 'MIGRATION FAILED - ROLLED BACK' AS result, @pv_err_no AS mysql_error, @pv_err_msg AS message;
  END;

  -- "Latest value per subscriber" is built with GROUP_CONCAT, which is cut at 1 KB by default.
  SET SESSION group_concat_max_len = 1024 * 1024;

  -- Leftovers from an earlier run in this same session.
  DROP TEMPORARY TABLE IF EXISTS tmp_src, tmp_subscriber, tmp_members, tmp_map, tmp_users, tmp_checks,
                                 tmp_unit_country, tmp_currency, tmp_price;

  CREATE TEMPORARY TABLE tmp_checks (
    seq        INT AUTO_INCREMENT PRIMARY KEY,
    check_name VARCHAR(200),
    expected   VARCHAR(100),
    actual     VARCHAR(100),
    passed     TINYINT
  );

  START TRANSACTION;

  -- ===================================================================================
  -- Stage the source: one cleaned row per legacy row.
  -- Every text value is trimmed and '' becomes NULL. Placeholder values become NULL
  -- (LedgerNo 'PV100000'), and 'Janaury' is fixed. The old membership_id
  -- is not read: it is looked up in membership_master instead (see below).
  -- ===================================================================================
  CREATE TEMPORARY TABLE tmp_src (PRIMARY KEY (id), INDEX (grp_hash), INDEX (added_by_hash)) AS
  SELECT
    c.*,

    -- Enum columns, mapped to the target's allowed values. Anything unrecognised stays NULL
    -- here and is caught by the "unmapped value" checks below, so nothing is guessed silently.
    CASE WHEN LOWER(c.is_icf_member_raw) IN ('yes', 'y', '1', 'true') THEN 'Yes'
         WHEN LOWER(c.is_icf_member_raw) IN ('no', 'n', '0', 'false') THEN 'No' END AS is_icf_member,
    CASE WHEN LOWER(c.previous_year_user_raw) IN ('yes', 'y', '1', 'true') THEN 'Yes'
         WHEN LOWER(c.previous_year_user_raw) IN ('no', 'n', '0', 'false') THEN 'No' END AS previous_year_user,
    CASE WHEN LOWER(c.cash_received_raw) IN ('y', 'yes', '1', 'true') THEN 'Y'
         WHEN LOWER(c.cash_received_raw) IN ('n', 'no', '0', 'false') THEN 'N' END AS cash_received,
    CASE REGEXP_REPLACE(LOWER(c.subscription_mode_raw), '[^a-z&]', '')
         WHEN 'print' THEN 'Print'
         WHEN 'digital' THEN 'Digital'
         WHEN 'print&digital' THEN 'Print&Digital'
         WHEN 'printanddigital' THEN 'Print&Digital'
         WHEN 'printdigital' THEN 'Print&Digital' END AS subscription_mode,
    CASE WHEN LOWER(c.is_renew_raw) = 'renew' THEN 'RENEW' ELSE 'NEW' END AS registration_type,
    CASE WHEN c.address_change_raw IS NOT NULL THEN 'Yes' ELSE 'No' END AS address_change,

    -- amount must be a number; anything else is reported and blocks the run.
    CASE WHEN c.amount_raw REGEXP '^-?[0-9]+([.][0-9]+)?$' THEN CAST(c.amount_raw AS DECIMAL(10, 2)) END AS amount,

    -- Subscriber identity. With a usable mobile (7+ digits): same mobile country, mobile and
    -- name letters. Without one, the row is a subscriber of its own. Hashed so it can be indexed.
    SHA2(
      CASE WHEN c.mobile IS NOT NULL AND CHAR_LENGTH(REGEXP_REPLACE(c.mobile, '[^0-9]', '')) >= 7
           THEN CONCAT_WS('|', 'm', IFNULL(c.mobile_country, ''), c.mobile,
                          IFNULL(REGEXP_REPLACE(LOWER(c.name), '[^a-z]', ''), ''))
           ELSE CONCAT('row|', c.id) END,
      256) AS grp_hash,

    SHA2(c.added_by_name, 256) AS added_by_hash
  FROM (
    SELECT
      s.ID AS id,
      CASE WHEN TRIM(s.LedgerNo) = 'PV100000' THEN NULL ELSE NULLIF(TRIM(s.LedgerNo), '') END AS ledger_no,
      NULLIF(TRIM(s.Name), '')                   AS name,
      NULLIF(TRIM(s.ShopName), '')               AS shop_name,
      NULLIF(TRIM(s.FloorNo), '')                AS floor_no,
      NULLIF(TRIM(s.BuildingName), '')           AS building_name,
      NULLIF(TRIM(s.Landmark), '')               AS landmark,
      NULLIF(TRIM(s.Street), '')                 AS street,
      NULLIF(TRIM(s.Area), '')                   AS area,
      NULLIF(TRIM(s.Province), '')               AS province,
      NULLIF(TRIM(s.Mobile), '')                 AS mobile,
      NULLIF(TRIM(s.Mobile_Country), '')         AS mobile_country,
      NULLIF(TRIM(s.WhatsApp), '')               AS whatsapp,
      NULLIF(TRIM(s.Whatsapp_Country), '')       AS whatsapp_country,
      NULLIF(TRIM(s.Tel), '')                    AS tel,
      NULLIF(TRIM(s.DistributorArea), '')        AS distributor_area,
      NULLIF(TRIM(s.ContactPersonName), '')      AS contact_person_name,
      NULLIF(TRIM(s.Oranaisor), '')              AS organiser_name,
      NULLIF(TRIM(s.OrganaisorMobile), '')       AS organiser_mobile,
      NULLIF(TRIM(s.Organiser_Country), '')      AS organiser_country,
      NULLIF(TRIM(s.Amount), '')                 AS amount_raw,
      NULLIF(TRIM(s.PStatus), '')                AS p_status,
      NULLIF(TRIM(s.CStatus), '')                AS c_status,
      NULLIF(TRIM(s.UnitID), '')                 AS unit_id,
      NULLIF(TRIM(s.AdressChnage), '')           AS address_change_raw,
      NULLIF(TRIM(s.subscription_year), '')      AS subscription_year,
      REPLACE(NULLIF(TRIM(s.subscription_from), ''), 'Janaury', 'January') AS subscription_from,
      NULLIF(TRIM(s.subscription_to), '')        AS subscription_to,
      NULLIF(TRIM(s.quantity), '')               AS quantity,
      NULLIF(TRIM(s.addedBy), '')                AS added_by_name,
      NULLIF(TRIM(s.is_icf_member), '')          AS is_icf_member_raw,
      NULLIF(TRIM(s.previous_year_user), '')     AS previous_year_user_raw,
      NULLIF(TRIM(s.is_renew), '')               AS is_renew_raw,
      NULLIF(TRIM(s.relegion), '')               AS religion,
      NULLIF(TRIM(s.cash_received_from_cust), '') AS cash_received_raw,
      NULLIF(TRIM(s.email), '')                  AS email,
      NULLIF(TRIM(s.subscription_mode), '')      AS subscription_mode_raw,
      s.created_at                               AS created_at
      -- Not migrated: created_at_j (copy of created_at), Year (always 2025), membership_id
      -- (looked up in membership_master instead) and previous_pvid (last year's system's IDs).
    FROM vayana_master_single s
  ) c;

  -- ===================================================================================
  -- Checks that must pass before anything is loaded. Each unmapped value would otherwise
  -- be lost or rejected by the target column.
  -- ===================================================================================
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: unmapped is_icf_member values', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE is_icf_member_raw IS NOT NULL AND is_icf_member IS NULL;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: unmapped previous_year_user values', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE previous_year_user_raw IS NOT NULL AND previous_year_user IS NULL;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: unmapped cash_received_from_cust values', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE cash_received_raw IS NOT NULL AND cash_received IS NULL;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: unmapped subscription_mode values', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE subscription_mode_raw IS NOT NULL AND subscription_mode IS NULL;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: non-numeric Amount values', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE amount_raw IS NOT NULL AND amount IS NULL;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: rows with no UnitID (unit_id is NOT NULL)', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE unit_id IS NULL;

  -- Every text value must fit its target column. Only columns that do NOT fit are listed,
  -- with the column size (expected) and the longest value found (actual).
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.ledger_no', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(ledger_no)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'ledger_no'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.name', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(name)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'name'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.mobile_country', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(mobile_country)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'mobile_country'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.mobile', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(mobile)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'mobile'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.whatsapp_country', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(whatsapp_country)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'whatsapp_country'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.whatsapp', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(whatsapp)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'whatsapp'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.tel', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(tel)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'tel'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.email', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(email)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'email'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_master.religion', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(religion)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_master' AND c.COLUMN_NAME = 'religion'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.subscription_from', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(subscription_from)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'subscription_from'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.subscription_to', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(subscription_to)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'subscription_to'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.p_status', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(p_status)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'p_status'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.c_status', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(c_status)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'c_status'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.shop_name', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(shop_name)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'shop_name'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.floor_no', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(floor_no)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'floor_no'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.building_name', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(building_name)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'building_name'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.landmark', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(landmark)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'landmark'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.street', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(street)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'street'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.area', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(area)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'area'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.province', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(province)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'province'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.distributor_area', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(distributor_area)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'distributor_area'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.contact_person_name', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(contact_person_name)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'contact_person_name'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.organiser_name', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(organiser_name)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'organiser_name'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.organiser_mobile', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(organiser_mobile)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'organiser_mobile'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.organiser_country', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(organiser_country)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'organiser_country'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: too long for pv_subscription_details.ledger_no', c.CHARACTER_MAXIMUM_LENGTH, t.mx, 0
    FROM (SELECT MAX(CHAR_LENGTH(ledger_no)) AS mx FROM tmp_src) t
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'pv_subscription_details' AND c.COLUMN_NAME = 'ledger_no'
   WHERE t.mx > c.CHARACTER_MAXIMUM_LENGTH;

  -- Whole-number columns must hold whole numbers.
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: non-integer unit_id values', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE unit_id IS NOT NULL AND unit_id NOT REGEXP '^[0-9]+$';
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: non-integer subscription_year values', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE subscription_year IS NOT NULL AND subscription_year NOT REGEXP '^[0-9]+$';
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'pre: non-integer quantity values', '0', COUNT(*), COUNT(*) = 0
    FROM tmp_src WHERE quantity IS NOT NULL AND quantity NOT REGEXP '^[0-9]+$';

  SELECT COUNT(*) INTO v_failures FROM tmp_checks WHERE passed = 0;
  IF v_failures > 0 THEN
    -- Report first: the temporary tables are transactional, so ROLLBACK empties them too.
    SELECT check_name, expected, actual, IF(passed, 'PASS', 'FAIL') AS status FROM tmp_checks ORDER BY seq;
    -- The distinct raw values behind any unmapped-value failure, to decide how to map them.
    SELECT 'is_icf_member' AS source_column, is_icf_member_raw AS raw_value, COUNT(*) AS n_rows
      FROM tmp_src WHERE is_icf_member_raw IS NOT NULL AND is_icf_member IS NULL GROUP BY is_icf_member_raw;
    SELECT 'subscription_mode' AS source_column, subscription_mode_raw AS raw_value, COUNT(*) AS n_rows
      FROM tmp_src WHERE subscription_mode_raw IS NOT NULL AND subscription_mode IS NULL GROUP BY subscription_mode_raw;
    SELECT 'previous_year_user' AS source_column, previous_year_user_raw AS raw_value, COUNT(*) AS n_rows
      FROM tmp_src WHERE previous_year_user_raw IS NOT NULL AND previous_year_user IS NULL GROUP BY previous_year_user_raw;
    SELECT 'cash_received_from_cust' AS source_column, cash_received_raw AS raw_value, COUNT(*) AS n_rows
      FROM tmp_src WHERE cash_received_raw IS NOT NULL AND cash_received IS NULL GROUP BY cash_received_raw;
    SELECT id AS legacy_id, unit_id, subscription_year, quantity
      FROM tmp_src
     WHERE unit_id NOT REGEXP '^[0-9]+$' OR subscription_year NOT REGEXP '^[0-9]+$' OR quantity NOT REGEXP '^[0-9]+$'
     ORDER BY id LIMIT 50;
    ROLLBACK;
    SELECT 'PRE-CHECKS FAILED - NOTHING LOADED, ROLLED BACK' AS result;
    LEAVE main;
  END IF;

  -- ===================================================================================
  -- Step 1: one row per subscriber. For each field, the latest non-NULL value by created_at
  -- (GROUP_CONCAT skips NULLs; the first item in newest-first order is the latest).
  -- subscriber_id is numbered in order of first subscription.
  -- ===================================================================================
  CREATE TEMPORARY TABLE tmp_subscriber (PRIMARY KEY (subscriber_id), UNIQUE KEY (grp_hash)) AS
  SELECT
    ROW_NUMBER() OVER (ORDER BY MIN(created_at) IS NULL, MIN(created_at), MIN(id)) AS subscriber_id,
    grp_hash,
    SUBSTRING_INDEX(GROUP_CONCAT(ledger_no        ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS ledger_no,
    SUBSTRING_INDEX(GROUP_CONCAT(name             ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS name,
    SUBSTRING_INDEX(GROUP_CONCAT(mobile_country   ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS mobile_country,
    SUBSTRING_INDEX(GROUP_CONCAT(mobile           ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS mobile,
    SUBSTRING_INDEX(GROUP_CONCAT(whatsapp_country ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS whatsapp_country,
    SUBSTRING_INDEX(GROUP_CONCAT(whatsapp         ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS whatsapp,
    SUBSTRING_INDEX(GROUP_CONCAT(tel              ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS tel,
    SUBSTRING_INDEX(GROUP_CONCAT(email            ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS email,
    SUBSTRING_INDEX(GROUP_CONCAT(religion         ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS religion,
    SUBSTRING_INDEX(GROUP_CONCAT(is_icf_member    ORDER BY created_at DESC, id DESC SEPARATOR '|#|'), '|#|', 1) AS is_icf_member,
    -- Filled only by the membership_master lookup below.
    CAST(NULL AS CHAR(100)) AS membership_id,
    MIN(created_at) AS first_subscribed_at,
    -- Name + mobile key, normalised (name = letters only, lower case; mobile and country =
    -- digits only). NULL without a usable mobile (7+ digits): such a subscriber can't be matched.
    CASE WHEN CHAR_LENGTH(REGEXP_REPLACE(MIN(mobile), '[^0-9]', '')) >= 7
         THEN UNHEX(SHA2(CONCAT_WS('|',
                REGEXP_REPLACE(IFNULL(MIN(mobile_country), ''), '[^0-9]', ''),
                REGEXP_REPLACE(MIN(mobile), '[^0-9]', ''),
                REGEXP_REPLACE(LOWER(MIN(name)), '[^a-z]', '')), 256)) END AS member_key,
    -- 0 no member found, 1 found by name + mobile, 2 several members match.
    0 AS member_matched
  FROM tmp_src
  GROUP BY grp_hash;

  -- ===================================================================================
  -- membership_id comes only from membership_master.membership_no, found by name + mobile
  -- (same normalised key on both sides), and only for ICF members. Everyone else: NULL.
  -- ===================================================================================

  -- Each name + mobile key in membership_master, and how many members have it.
  CREATE TEMPORARY TABLE tmp_members (PRIMARY KEY (member_key)) AS
  SELECT
    UNHEX(SHA2(CONCAT_WS('|',
      REGEXP_REPLACE(IFNULL(mm.mobile_country, ''), '[^0-9]', ''),
      REGEXP_REPLACE(mm.mobile, '[^0-9]', ''),
      REGEXP_REPLACE(LOWER(mm.member_name), '[^a-z]', '')), 256)) AS member_key,
    MIN(TRIM(mm.membership_no)) AS membership_no,
    COUNT(*) AS n_members
  FROM membership_master mm
  WHERE NULLIF(TRIM(mm.membership_no), '') IS NOT NULL
    AND REGEXP_REPLACE(LOWER(mm.member_name), '[^a-z]', '') <> ''
    AND CHAR_LENGTH(REGEXP_REPLACE(mm.mobile, '[^0-9]', '')) >= 7
  GROUP BY member_key;

  -- Exactly one member with the same name + mobile: take their membership_no.
  -- Several matching members can't be told apart: left NULL.
  UPDATE tmp_subscriber sub
  JOIN tmp_members m ON m.member_key = sub.member_key
  SET sub.membership_id = IF(m.n_members = 1, m.membership_no, NULL),
      sub.member_matched = IF(m.n_members = 1, 1, 2)
  WHERE sub.is_icf_member = 'Yes';

  -- Legacy row id -> subscriber_id, for every source row.
  CREATE TEMPORARY TABLE tmp_map (PRIMARY KEY (legacy_id)) AS
  SELECT s.id AS legacy_id, sub.subscriber_id
  FROM tmp_src s
  JOIN tmp_subscriber sub ON sub.grp_hash = s.grp_hash;

  -- Users whose name is unique, for the exact-name match on addedBy. A name shared by two
  -- users is left out, so a row is never credited to the wrong person.
  CREATE TEMPORARY TABLE tmp_users (PRIMARY KEY (name_hash)) AS
  SELECT SHA2(TRIM(u.name), 256) AS name_hash, MIN(u.id) AS user_id
  FROM users u
  WHERE NULLIF(TRIM(u.name), '') IS NOT NULL
  GROUP BY SHA2(TRIM(u.name), 256)
  HAVING COUNT(*) = 1;

  -- ===================================================================================
  -- Country lookups. Codes are trimmed, upper-cased and converted to one character set, so
  -- tables with different collations can be joined.
  -- ===================================================================================

  -- Each unit's 2-letter country code (organisation_master.country_code, e.g. AE).
  CREATE TEMPORARY TABLE tmp_unit_country (PRIMARY KEY (unit_id)) AS
  SELECT o.orgid AS unit_id,
         CONVERT(NULLIF(UPPER(TRIM(o.country_code)), '') USING utf8mb4) AS country_code
  FROM organisation_master o
  WHERE o.orgid IN (SELECT DISTINCT CAST(unit_id AS UNSIGNED) FROM tmp_src);

  -- countries: code -> currency.
  CREATE TEMPORARY TABLE tmp_currency (PRIMARY KEY (country_code)) AS
  SELECT CONVERT(UPPER(TRIM(c.code)) USING utf8mb4) AS country_code,
         MIN(NULLIF(TRIM(c.currency), '')) AS currency
  FROM countries c
  WHERE NULLIF(TRIM(c.code), '') IS NOT NULL
  GROUP BY CONVERT(UPPER(TRIM(c.code)) USING utf8mb4);

  -- Price table: country + year -> ID. Should be one row each; if a pair has several,
  -- n_rows > 1 and no ID is assigned for it (reported below) rather than picking one.
  SET @pv_sql = CONCAT(
    'CREATE TEMPORARY TABLE tmp_price AS ',
    'SELECT CONVERT(UPPER(TRIM(p.country)) USING utf8mb4) AS country_code, ',
    '       CASE WHEN TRIM(p.`year`) REGEXP ''^[0-9]+$'' THEN CAST(TRIM(p.`year`) AS UNSIGNED) END AS price_year, ',
    '       MIN(p.ID) AS price_id, COUNT(*) AS n_rows ',
    'FROM `', @pv_price_table, '` p ',
    'GROUP BY CONVERT(UPPER(TRIM(p.country)) USING utf8mb4), ',
    '         CASE WHEN TRIM(p.`year`) REGEXP ''^[0-9]+$'' THEN CAST(TRIM(p.`year`) AS UNSIGNED) END');
  PREPARE pv_stmt FROM @pv_sql;
  EXECUTE pv_stmt;
  DEALLOCATE PREPARE pv_stmt;

  -- ===================================================================================
  -- Clear the targets so the script can be re-run. Child table first. DELETE rather than
  -- TRUNCATE, because TRUNCATE commits on its own and could not be rolled back.
  -- ===================================================================================
  DELETE FROM pv_subscription_details;
  DELETE FROM pv_subscription_master;

  -- ===================================================================================
  -- Load subscribers (parent table first, for the foreign key).
  -- ===================================================================================
  INSERT INTO pv_subscription_master (
    subscriber_id, ledger_no, name, mobile_country, mobile, whatsapp_country, whatsapp, tel, email,
    religion, is_icf_member, membership_id, status, first_subscribed_at
  )
  SELECT
    subscriber_id, ledger_no, IFNULL(name, 'UNKNOWN'), mobile_country, mobile, whatsapp_country, whatsapp,
    tel, email, religion, is_icf_member, membership_id, 'ACTIVE', first_subscribed_at
  FROM tmp_subscriber
  ORDER BY subscriber_id;

  -- ===================================================================================
  -- Step 2: load one subscription per source row, in legacy ID order. Nothing is dropped.
  -- added_by is a users.id, only when addedBy exactly matches one user's name.
  -- subscription_id and currency come from the unit's country (see the lookups above).
  -- ===================================================================================
  INSERT INTO pv_subscription_details (
    subscriber_id, subscription_id, unit_id,
    registration_type, registration_method, approval_status, approved_by, approved_at, reject_reason,
    previous_year_user,
    subscription_year, subscription_from, subscription_to, subscription_mode, quantity,
    currency, amount, cash_received, p_status, c_status,
    shop_name, floor_no, building_name, landmark, street, area, province,
    address_change, distributor_area, contact_person_name,
    organiser_name, organiser_mobile, organiser_country,
    ledger_no, added_by, created_at
  )
  SELECT
    m.subscriber_id, pr.price_id, s.unit_id,
    s.registration_type, 'DIRECT', 'APPROVED', NULL, s.created_at, NULL,
    s.previous_year_user,
    s.subscription_year, s.subscription_from, s.subscription_to, IFNULL(s.subscription_mode, 'Print'), s.quantity,
    cur.currency, s.amount, s.cash_received, s.p_status, s.c_status,
    s.shop_name, s.floor_no, s.building_name, s.landmark, s.street, s.area, s.province,
    s.address_change, s.distributor_area, s.contact_person_name,
    s.organiser_name, s.organiser_mobile, s.organiser_country,
    s.ledger_no, u.user_id, s.created_at
  FROM tmp_src s
  JOIN tmp_map m ON m.legacy_id = s.id
  LEFT JOIN tmp_users u ON u.name_hash = s.added_by_hash
  LEFT JOIN tmp_unit_country uc ON uc.unit_id = CAST(s.unit_id AS UNSIGNED)
  LEFT JOIN tmp_currency cur ON cur.country_code = uc.country_code
  LEFT JOIN tmp_price pr
         ON pr.country_code = uc.country_code
        AND pr.price_year = CAST(s.subscription_year AS UNSIGNED)
        AND pr.n_rows = 1
  ORDER BY s.id;

  -- ===================================================================================
  -- Checks after loading. Any failure means ROLLBACK.
  -- ===================================================================================
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'row count: source = pv_subscription_details',
         (SELECT COUNT(*) FROM vayana_master_single),
         (SELECT COUNT(*) FROM pv_subscription_details),
         (SELECT COUNT(*) FROM vayana_master_single) = (SELECT COUNT(*) FROM pv_subscription_details);

  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'details with no matching subscriber (orphans)', '0', COUNT(*), COUNT(*) = 0
  FROM pv_subscription_details d
  LEFT JOIN pv_subscription_master sm ON sm.subscriber_id = d.subscriber_id
  WHERE sm.subscriber_id IS NULL;

  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'SUM(amount): source = details',
         (SELECT IFNULL(ROUND(SUM(CAST(NULLIF(TRIM(Amount), '') AS DECIMAL(14, 2))), 2), 0) FROM vayana_master_single),
         (SELECT IFNULL(ROUND(SUM(amount), 2), 0) FROM pv_subscription_details),
         (SELECT IFNULL(ROUND(SUM(CAST(NULLIF(TRIM(Amount), '') AS DECIMAL(14, 2))), 2), 0) FROM vayana_master_single)
           = (SELECT IFNULL(ROUND(SUM(amount), 2), 0) FROM pv_subscription_details);

  -- Informational, not pass/fail: the spec expects about 29,300.
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'subscribers created (info, expected ~29,300)', '~29300', COUNT(*), 1 FROM pv_subscription_master;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'rows with added_by matched to a user (info)', '-', COUNT(added_by), 1 FROM pv_subscription_details;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'price table used (info)', '-', @pv_price_table, 1;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'rows with subscription_id (info)', '-', COUNT(subscription_id), 1 FROM pv_subscription_details;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'rows with currency (info)', '-', COUNT(currency), 1 FROM pv_subscription_details;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'foreign key to price table (info)', '-', IFNULL(@pv_fk_note, 'yes'), 1;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT 'ICF-member subscribers (info)', '-', COUNT(*), 1 FROM tmp_subscriber WHERE is_icf_member = 'Yes';
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT '  - membership_no found by name + mobile (info)', '-', COUNT(*), 1
    FROM tmp_subscriber WHERE member_matched = 1;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT '  - several members match, left NULL (info)', '-', COUNT(*), 1
    FROM tmp_subscriber WHERE member_matched = 2;
  INSERT INTO tmp_checks (check_name, expected, actual, passed)
  SELECT '  - no member found, left NULL (info)', '-', COUNT(*), 1
    FROM tmp_subscriber WHERE is_icf_member = 'Yes' AND member_matched = 0;

  -- ===================================================================================
  -- Report
  -- ===================================================================================
  SELECT check_name, expected, actual, IF(passed, 'PASS', 'FAIL') AS status FROM tmp_checks ORDER BY seq;

  SELECT registration_type, COUNT(*) AS n_rows
  FROM pv_subscription_details GROUP BY registration_type ORDER BY registration_type;

  SELECT subscription_mode, COUNT(*) AS n_rows
  FROM pv_subscription_details GROUP BY subscription_mode ORDER BY subscription_mode;

  -- Rows left without subscription_id or currency, grouped by why.
  SELECT CASE WHEN uc.unit_id IS NULL THEN 'unit not in organisation_master'
              WHEN uc.country_code IS NULL THEN 'unit has no country_code'
              ELSE 'no single price row for this country + year' END AS no_subscription_id_because,
         uc.country_code, d.subscription_year, COUNT(*) AS n_rows
  FROM pv_subscription_details d
  LEFT JOIN tmp_unit_country uc ON uc.unit_id = d.unit_id
  WHERE d.subscription_id IS NULL
  GROUP BY 1, uc.country_code, d.subscription_year
  ORDER BY n_rows DESC;

  SELECT CASE WHEN uc.unit_id IS NULL THEN 'unit not in organisation_master'
              WHEN uc.country_code IS NULL THEN 'unit has no country_code'
              ELSE 'country code not in countries, or no currency there' END AS no_currency_because,
         uc.country_code, COUNT(*) AS n_rows
  FROM pv_subscription_details d
  LEFT JOIN tmp_unit_country uc ON uc.unit_id = d.unit_id
  WHERE d.currency IS NULL
  GROUP BY 1, uc.country_code
  ORDER BY n_rows DESC;

  -- Rows where a default was applied.
  SELECT 'subscription_mode was NULL -> Print' AS default_applied, id AS legacy_id
  FROM tmp_src WHERE subscription_mode_raw IS NULL
  ORDER BY id;

  SELECT 'name was NULL -> UNKNOWN' AS default_applied, m.legacy_id, m.subscriber_id
  FROM tmp_map m
  JOIN tmp_subscriber sub ON sub.subscriber_id = m.subscriber_id
  WHERE sub.name IS NULL
  ORDER BY m.legacy_id;

  -- ===================================================================================
  -- Commit only if every check passed and this is not a dry run.
  -- ===================================================================================
  SELECT COUNT(*) INTO v_failures FROM tmp_checks WHERE passed = 0;

  IF v_failures > 0 THEN
    ROLLBACK;
    SELECT CONCAT(v_failures, ' CHECK(S) FAILED - ROLLED BACK. See the FAIL rows above.') AS result;
  ELSEIF p_commit = 1 THEN
    COMMIT;
    SELECT 'ALL CHECKS PASSED - COMMITTED' AS result;
  ELSE
    ROLLBACK;
    SELECT 'ALL CHECKS PASSED - DRY RUN, ROLLED BACK. Run CALL pv_migrate(1) to keep the data.' AS result;
  END IF;
END $$

DELIMITER ;

-- Run Step 0, then the migration. 0 = dry run; change to 1 to commit.
CALL pv_create_tables();
CALL pv_migrate(1);

-- Remove the helper procedures.
DROP PROCEDURE IF EXISTS pv_create_tables;
DROP PROCEDURE IF EXISTS pv_migrate;
