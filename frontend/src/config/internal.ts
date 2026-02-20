// Frontend-only internal configuration
// This should contain only client-side configurations and utilities

export const INTERNAL_CONFIG = {
  // Frontend-specific internal configuration
  ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
  FEATURE_FLAGS: {
    BRAIN_DUMP: true,
    CALENDAR: true,
    ADVANCED_REPORTING: true,
  }
};