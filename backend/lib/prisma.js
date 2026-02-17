import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

console.log('🔗 Initializing Prisma client...');
console.log('📍 Database URL configured:', !!process.env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: 'pretty',
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.VITE_DATABASE_URL
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Add connection retry logic
let connectionRetries = 0;
const maxRetries = 3;

async function connectWithRetry() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test a simple query to ensure full connectivity
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database query test passed');
    
  } catch (error) {
    console.error(`❌ Database connection attempt ${connectionRetries + 1}/${maxRetries} failed:`, error.message);
    
    connectionRetries++;
    if (connectionRetries < maxRetries) {
      console.log(`🔄 Retrying database connection in 3 seconds...`);
      setTimeout(() => connectWithRetry(), 3000);
    } else {
      console.error('💥 Max database connection retries exceeded');
      console.warn('⚠️  Server will continue without database connection');
    }
  }
}

// Start connection attempt
connectWithRetry();

export default prisma;