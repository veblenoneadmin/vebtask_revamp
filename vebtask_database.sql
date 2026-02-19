-- ============================================================
-- VebTask - MySQL 8.0+ Database Setup
-- Generated from Prisma schema (schema.prisma)
-- ============================================================
--
-- TEST ACCOUNT CREDENTIALS
--   Email   : admin@vebtask.com
--   Password : Test@1234
--   Role    : OWNER
-- ============================================================

CREATE DATABASE IF NOT EXISTS `vebtask`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `vebtask`;

-- ============================================================
-- User
-- (Better Auth manages this table)
-- ============================================================
CREATE TABLE IF NOT EXISTS `User` (
  `id`               VARCHAR(36)   NOT NULL,
  `email`            VARCHAR(255)  NOT NULL,
  `emailVerified`    TINYINT(1)    DEFAULT 0,
  `name`             VARCHAR(255)  DEFAULT NULL,
  `image`            VARCHAR(255)  DEFAULT NULL,
  `createdAt`        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completedWizards` TEXT          DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Organization
-- ============================================================
CREATE TABLE IF NOT EXISTS `organizations` (
  `id`          VARCHAR(191)  NOT NULL,
  `name`        VARCHAR(255)  NOT NULL,
  `slug`        VARCHAR(100)  NOT NULL,
  `createdById` VARCHAR(191)  NOT NULL,
  `createdAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizations_slug_key` (`slug`),
  KEY `organizations_createdById_idx` (`createdById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Account
-- (Better Auth OAuth provider accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS `Account` (
  `id`                   VARCHAR(191)  NOT NULL,
  `accountId`            VARCHAR(191)  NOT NULL,
  `userId`               VARCHAR(36)   DEFAULT NULL,
  `providerId`           VARCHAR(191)  NOT NULL,
  `providerAccountId`    VARCHAR(191)  DEFAULT NULL,
  `type`                 VARCHAR(191)  NOT NULL DEFAULT 'oauth',
  `expires_at`           INT           DEFAULT NULL,
  `token_type`           VARCHAR(191)  DEFAULT NULL,
  `scope`                VARCHAR(191)  DEFAULT NULL,
  `session_state`        VARCHAR(191)  DEFAULT NULL,
  `password`             TEXT          DEFAULT NULL,
  `createdAt`            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `accessToken`          TEXT          DEFAULT NULL,
  `accessTokenExpiresAt` DATETIME(3)   DEFAULT NULL,
  `idToken`              TEXT          DEFAULT NULL,
  `refreshToken`         TEXT          DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Account_providerId_providerAccountId_key` (`providerId`, `providerAccountId`),
  KEY `Account_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Session
-- (Better Auth sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS `Session` (
  `id`        VARCHAR(191)  NOT NULL,
  `token`     VARCHAR(191)  NOT NULL,
  `userId`    VARCHAR(36)   DEFAULT NULL,
  `expiresAt` DATETIME(3)   NOT NULL,
  `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `ipAddress` VARCHAR(191)  DEFAULT NULL,
  `userAgent` VARCHAR(191)  DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Session_token_key` (`token`),
  KEY `Session_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Verification
-- (Better Auth email verification tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS `verification` (
  `id`         VARCHAR(191)  NOT NULL,
  `identifier` VARCHAR(255)  NOT NULL,
  `value`      TEXT          NOT NULL,
  `expiresAt`  DATETIME(3)   NOT NULL,
  `createdAt`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Membership
-- (User ↔ Organization roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS `memberships` (
  `id`        VARCHAR(191)  NOT NULL,
  `userId`    VARCHAR(191)  NOT NULL,
  `orgId`     VARCHAR(191)  NOT NULL,
  `role`      ENUM('OWNER','ADMIN','STAFF','CLIENT') NOT NULL,
  `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `memberships_userId_orgId_key` (`userId`, `orgId`),
  KEY `memberships_orgId_idx` (`orgId`),
  KEY `memberships_userId_idx` (`userId`),
  CONSTRAINT `memberships_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE,
  CONSTRAINT `memberships_orgId_fkey`
    FOREIGN KEY (`orgId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Invite
-- ============================================================
CREATE TABLE IF NOT EXISTS `invites` (
  `id`           VARCHAR(191)  NOT NULL,
  `orgId`        VARCHAR(191)  NOT NULL,
  `email`        VARCHAR(255)  NOT NULL,
  `role`         ENUM('OWNER','ADMIN','STAFF','CLIENT') NOT NULL,
  `token`        VARCHAR(64)   NOT NULL,
  `expiresAt`    DATETIME(3)   NOT NULL,
  `status`       ENUM('PENDING','ACCEPTED','EXPIRED','REVOKED') NOT NULL DEFAULT 'PENDING',
  `invitedById`  VARCHAR(191)  NOT NULL,
  `acceptedById` VARCHAR(191)  DEFAULT NULL,
  `createdAt`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `invites_token_key` (`token`),
  KEY `invites_orgId_idx` (`orgId`),
  KEY `invites_token_idx` (`token`),
  KEY `invites_email_idx` (`email`),
  KEY `invites_acceptedById_fkey` (`acceptedById`),
  KEY `invites_invitedById_fkey` (`invitedById`),
  CONSTRAINT `invites_orgId_fkey`
    FOREIGN KEY (`orgId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Client
-- ============================================================
CREATE TABLE IF NOT EXISTS `clients` (
  `id`        VARCHAR(191)  NOT NULL,
  `name`      VARCHAR(255)  NOT NULL,
  `email`     VARCHAR(255)  DEFAULT NULL,
  `phone`     VARCHAR(50)   DEFAULT NULL,
  `address`   TEXT          DEFAULT NULL,
  `orgId`     VARCHAR(191)  NOT NULL,
  `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `clients_orgId_idx` (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Project
-- ============================================================
CREATE TABLE IF NOT EXISTS `projects` (
  `id`             VARCHAR(191)   NOT NULL,
  `name`           VARCHAR(255)   NOT NULL,
  `description`    TEXT           DEFAULT NULL,
  `status`         VARCHAR(20)    NOT NULL DEFAULT 'planning',
  `priority`       VARCHAR(10)    NOT NULL DEFAULT 'medium',
  `color`          VARCHAR(20)    NOT NULL DEFAULT '#646cff',
  `budget`         DECIMAL(10,2)  DEFAULT NULL,
  `spent`          DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  `progress`       INT            NOT NULL DEFAULT 0,
  `estimatedHours` INT            NOT NULL DEFAULT 0,
  `hoursLogged`    INT            NOT NULL DEFAULT 0,
  `startDate`      DATETIME(3)    DEFAULT NULL,
  `endDate`        DATETIME(3)    DEFAULT NULL,
  `clientId`       VARCHAR(191)   DEFAULT NULL,
  `clientName`     VARCHAR(255)   DEFAULT NULL,
  `orgId`          VARCHAR(191)   NOT NULL,
  `createdAt`      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `projects_orgId_idx` (`orgId`),
  KEY `projects_status_idx` (`status`),
  KEY `projects_priority_idx` (`priority`),
  KEY `projects_clientId_idx` (`clientId`),
  CONSTRAINT `projects_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MacroTask
-- ============================================================
CREATE TABLE IF NOT EXISTS `macro_tasks` (
  `id`             VARCHAR(50)   NOT NULL,
  `title`          VARCHAR(500)  NOT NULL,
  `description`    TEXT          DEFAULT NULL,
  `userId`         VARCHAR(36)   NOT NULL,
  `orgId`          VARCHAR(191)  NOT NULL,
  `projectId`      VARCHAR(191)  DEFAULT NULL,
  `createdBy`      VARCHAR(36)   NOT NULL,
  `priority`       VARCHAR(10)   NOT NULL DEFAULT 'Medium',
  `estimatedHours` DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `actualHours`    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `status`         VARCHAR(20)   NOT NULL DEFAULT 'not_started',
  `category`       VARCHAR(100)  NOT NULL DEFAULT 'General',
  `tags`           JSON          DEFAULT NULL,
  `dueDate`        DATETIME(3)   DEFAULT NULL,
  `completedAt`    DATETIME(3)   DEFAULT NULL,
  `createdAt`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `macro_tasks_userId_status_idx` (`userId`, `status`),
  KEY `macro_tasks_orgId_idx` (`orgId`),
  KEY `macro_tasks_projectId_idx` (`projectId`),
  KEY `macro_tasks_priority_idx` (`priority`),
  KEY `macro_tasks_dueDate_idx` (`dueDate`),
  FULLTEXT KEY `title` (`title`, `description`),
  CONSTRAINT `macro_tasks_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE,
  CONSTRAINT `macro_tasks_orgId_fkey`
    FOREIGN KEY (`orgId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `macro_tasks_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TimeLog
-- (Task-based time tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS `time_logs` (
  `id`          VARCHAR(50)    NOT NULL,
  `taskId`      VARCHAR(50)    DEFAULT NULL,
  `userId`      VARCHAR(36)    NOT NULL,
  `orgId`       VARCHAR(191)   NOT NULL,
  `begin`       DATETIME(3)    NOT NULL,
  `end`         DATETIME(3)    DEFAULT NULL,
  `duration`    INT            NOT NULL DEFAULT 0,
  `timezone`    VARCHAR(64)    NOT NULL DEFAULT 'UTC',
  `category`    VARCHAR(20)    NOT NULL DEFAULT 'work',
  `description` TEXT           DEFAULT NULL,
  `isBillable`  TINYINT(1)     NOT NULL DEFAULT 0,
  `hourlyRate`  DECIMAL(10,2)  DEFAULT NULL,
  `earnings`    DECIMAL(10,2)  DEFAULT NULL,
  `isExported`  TINYINT(1)     NOT NULL DEFAULT 0,
  `exportedAt`  DATETIME(3)    DEFAULT NULL,
  `createdAt`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `time_logs_userId_begin_idx` (`userId`, `begin`),
  KEY `time_logs_begin_end_idx` (`begin`, `end`),
  KEY `time_logs_orgId_idx` (`orgId`),
  KEY `time_logs_taskId_idx` (`taskId`),
  CONSTRAINT `time_logs_taskId_fkey`
    FOREIGN KEY (`taskId`) REFERENCES `macro_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Report
-- ============================================================
CREATE TABLE IF NOT EXISTS `reports` (
  `id`          VARCHAR(191)  NOT NULL,
  `title`       VARCHAR(255)  DEFAULT NULL,
  `description` TEXT          NOT NULL,
  `userName`    VARCHAR(255)  NOT NULL,
  `image`       LONGTEXT      DEFAULT NULL,
  `projectId`   VARCHAR(191)  DEFAULT NULL,
  `userId`      VARCHAR(36)   NOT NULL,
  `orgId`       VARCHAR(191)  NOT NULL,
  `createdAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `reports_orgId_idx` (`orgId`),
  KEY `reports_userId_idx` (`userId`),
  KEY `reports_projectId_idx` (`projectId`),
  KEY `reports_createdAt_idx` (`createdAt`),
  CONSTRAINT `reports_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reports_orgId_fkey`
    FOREIGN KEY (`orgId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reports_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- AttendanceLog
-- (Time In / Time Out punch clock)
-- ============================================================
CREATE TABLE IF NOT EXISTS `attendance_logs` (
  `id`        VARCHAR(50)   NOT NULL,
  `userId`    VARCHAR(36)   NOT NULL,
  `orgId`     VARCHAR(191)  NOT NULL,
  `timeIn`    DATETIME(3)   NOT NULL,
  `timeOut`   DATETIME(3)   DEFAULT NULL,
  `duration`  INT           NOT NULL DEFAULT 0,
  `notes`     TEXT          DEFAULT NULL,
  `date`      VARCHAR(10)   NOT NULL,
  `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `attendance_logs_userId_date_idx` (`userId`, `date`),
  KEY `attendance_logs_orgId_idx` (`orgId`),
  KEY `attendance_logs_userId_timeOut_idx` (`userId`, `timeOut`),
  CONSTRAINT `attendance_logs_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_logs_orgId_fkey`
    FOREIGN KEY (`orgId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- SEED DATA — Test Account
-- ============================================================
-- Email   : admin@vebtask.com
-- Password: Test@1234
-- Role    : OWNER
-- ============================================================

-- 1. User
INSERT INTO `User`
  (`id`, `email`, `emailVerified`, `name`, `createdAt`, `updatedAt`)
VALUES
  (
    'test_user_001',
    'admin@vebtask.com',
    1,
    'Admin User',
    NOW(),
    NOW()
  )
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- 2. Organization
INSERT INTO `organizations`
  (`id`, `name`, `slug`, `createdById`, `createdAt`, `updatedAt`)
VALUES
  (
    'test_org_001',
    'VebTask Demo Org',
    'vebtask-demo',
    'test_user_001',
    NOW(),
    NOW()
  )
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Account (Better Auth email/password)
--    providerId = 'credential' is how Better Auth stores email+password accounts
--    password   = bcrypt hash of "Test@1234" (cost 10)
INSERT INTO `Account`
  (`id`, `accountId`, `userId`, `providerId`, `type`, `password`, `createdAt`, `updatedAt`)
VALUES
  (
    'test_account_001',
    'test_user_001',
    'test_user_001',
    'credential',
    'email',
    '$2b$10$A4WhXtPS9uMpe3WNkIS99O56v3BntTkTEcn0prekLWnkCzH/kVIF2',
    NOW(),
    NOW()
  )
ON DUPLICATE KEY UPDATE `password` = VALUES(`password`);

-- 4. Membership (link User → Organization as OWNER)
INSERT INTO `memberships`
  (`id`, `userId`, `orgId`, `role`, `createdAt`, `updatedAt`)
VALUES
  (
    'test_membership_001',
    'test_user_001',
    'test_org_001',
    'OWNER',
    NOW(),
    NOW()
  )
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`);
