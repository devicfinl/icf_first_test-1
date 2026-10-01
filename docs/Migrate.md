You are a MySQL 8 data-migration engineer. Write a complete, re-runnable SQL migration
script that moves data from the legacy table `vayana_subcription_master_single` into two
new tables: `pv_subscription_master` and `pv_subscription_details`.

## Source table: vayana_subcription_master_single  (~29,767 rows, one row per subscription)
Columns: ID, LedgerNo, Name, ShopName, FloorNo, BuildingName, Landmark, Street, Area,
Province, Mobile, Mobile_Country, WhatsApp, Whatsapp_Country, Tel, DistributorArea,
ContactPersonName, Oranaisor, OrganaisorMobile, Amount, PStatus, CStatus, UnitID,
AdressChnage, subscription_year, subscription_from, subscription_to, quantity, addedBy,
is_icf_member, membership_id, previous_year_user, is_renew, previous_pvid, relegion,
Organiser_Country, cash_received_from_cust, email, subscription_mode, created_at,
created_at_j, Year

## Target tables (already created)
pv_subscription_master: subscriber_id (PK, auto), ledger_no, name (NOT NULL),
mobile_country, mobile, whatsapp_country, whatsapp, tel, email, religion,
is_icf_member ENUM('Yes','No'), membership_id, status ENUM('PENDING','ACTIVE','REJECTED'),
first_subscribed_at, updated_at

pv_subscription_details: subscription_id (PK), subscriber_id (FK -> master), unit_id (NOT NULL),
registration_type ENUM('NEW','RENEW'), registration_method ENUM('DIRECT','PUBLIC'),
approval_status ENUM('PENDING','APPROVED','REJECTED'), approved_by, approved_at, reject_reason,
previous_year_user ENUM('Yes','No'), previous_subscription_id (self-FK), subscription_year,
subscription_from, subscription_to, subscription_mode ENUM('Print','Digital','Print&Digital') NOT NULL,
quantity, currency, amount DECIMAL(10,2), cash_received ENUM('Y','N'), p_status, c_status,
shop_name, floor_no, building_name, landmark, street, area, province,
address_change ENUM('Yes','No'), distributor_area, delivery_responsibility,
contact_person_name, organiser_name, organiser_mobile, organiser_country, ledger_no,
added_by (INT, user id), created_at, updated_at
CHECK: registration_method <> 'PUBLIC' OR registration_type = 'NEW'

## Step 0 - add legacy columns to pv_subscription_details before loading
  legacy_previous_pvid  INT NULL          -- old previous_pvid (refers to LAST YEAR's system IDs)
  legacy_added_by_name  VARCHAR(150) NULL -- old addedBy text (a person's name, not a user id)

## Cleaning rules (apply to every text column)
- TRIM all values; convert empty strings '' to NULL.
- LedgerNo 'PV100000' is a placeholder -> NULL.
- membership_id '0' -> NULL.  previous_pvid '0' -> NULL.
- subscription_from 'Janaury' -> 'January'.
- A Mobile is "usable" only if it is NOT NULL and has at least 7 digits.

## Step 1 - identify subscribers (build pv_subscription_master)
- One subscriber = same (Mobile_Country, Mobile, normalized Name).
  normalized Name = LOWER(Name) with everything except a-z removed.
  (Do NOT group by Mobile alone - one mobile is often shared by many different people,
   e.g. an organiser registering others. Do NOT use LedgerNo - it is not unique.)
- Rows without a usable Mobile: each row becomes its own subscriber.
- For each subscriber, take the LATEST non-NULL value (ordered by created_at) for:
  ledger_no, name, mobile_country, mobile, whatsapp_country, whatsapp, tel, email,
  religion (from relegion), is_icf_member, membership_id.
- first_subscribed_at = MIN(created_at) of that subscriber's rows; status = 'ACTIVE'.
- If name is NULL use 'UNKNOWN'.
- Assign subscriber_id in order of first_subscribed_at.
- Build a temporary mapping table legacy_id -> subscriber_id for every source row.
  Expected result: about 29,300 subscribers.

## Step 2 - load pv_subscription_details (one row per source row, NOTHING dropped)
- subscription_id        = ID (keep the original ID)
- subscriber_id          = from the mapping table
- unit_id                = UnitID
- registration_type      = 'RENEW' if is_renew = 'Renew' else 'NEW'
- registration_method    = 'DIRECT' (all legacy rows were staff-entered)
- approval_status        = 'APPROVED'; approved_at = created_at; approved_by = NULL
- previous_year_user     = previous_year_user
- previous_subscription_id = NULL for all legacy rows (see warning below)
- legacy_previous_pvid   = previous_pvid
- subscription_year, subscription_from, subscription_to, quantity = same-named columns
- subscription_mode      = subscription_mode; if NULL use 'Print' and list those IDs in the report
- amount = Amount; cash_received = cash_received_from_cust; p_status = PStatus; c_status = CStatus
- currency               = NULL (not in legacy data)
- shop_name=ShopName, floor_no=FloorNo, building_name=BuildingName, landmark=Landmark,
  street=Street, area=Area, province=Province
- address_change         = 'Yes' if AdressChnage has a value, else 'No'
- distributor_area=DistributorArea, contact_person_name=ContactPersonName,
  organiser_name=Oranaisor, organiser_mobile=OrganaisorMobile, organiser_country=Organiser_Country
- ledger_no              = LedgerNo (after the PV100000 -> NULL rule)
- legacy_added_by_name   = addedBy
- added_by               = users.user_id only when addedBy exactly matches a user's full name, else NULL
- created_at             = created_at
- DROP (do not migrate): created_at_j (exact copy of created_at), Year (always 2025, derivable)

## WARNING - previous_pvid
previous_pvid refers to IDs from LAST YEAR's system, not to IDs in this table. About 13,000
of those numbers happen to equal an ID in this table but belong to a DIFFERENT person.
Never copy previous_pvid into previous_subscription_id. Keep it only in legacy_previous_pvid.

## Requirements for the script
1. Wrap everything in a transaction; stage into temp tables first, then INSERT into targets.
2. Make it re-runnable: clear the target tables at the start (child table first).
3. Insert pv_subscription_master before pv_subscription_details (FK order).
4. After loading, run and print these checks:
   - COUNT(*) source = COUNT(*) pv_subscription_details (must match exactly)
   - every details.subscriber_id exists in master (0 orphans)
   - no duplicate subscription_id
   - count of rows by registration_type, and by subscription_mode
   - SUM(amount) source = SUM(amount) details
   - list of IDs where a default was applied (NULL subscription_mode, NULL name)
5. COMMIT only if all checks pass; otherwise ROLLBACK and print what failed.
6. Comment each section of the script in plain English.