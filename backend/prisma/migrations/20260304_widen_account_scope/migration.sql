-- Widen scope column on account table to TEXT so Google OAuth scope strings fit
-- Tries both casings since Better Auth may have created the table as 'account' or 'Account'
ALTER TABLE `account` MODIFY COLUMN `scope` TEXT NULL;
