/**
 * Seed script: creates a test user in MongoDB for local development.
 * Run with: node scripts/seed-test-user.cjs
 */
const path = require('path');
const dotenv = require(path.resolve(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
const bcrypt = require(path.resolve(__dirname, '../backend/node_modules/bcryptjs'));

const MONGODB_URI = process.env.MONGODB_URI;

const TEST_USER = {
  email: 'test@repointel.dev',
  password: 'Test1234!',
  displayName: 'Test User',
};

async function seed() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }

  console.log(`🔌 Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || 'repointel' });
  console.log('✅ Connected');

  const db = mongoose.connection.db;
  const users = db.collection('users');

  const existing = await users.findOne({ email: TEST_USER.email });
  if (existing) {
    console.log(`⚠️  User "${TEST_USER.email}" already exists.`);
  } else {
    const passwordHash = await bcrypt.hash(TEST_USER.password, 12);
    await users.insertOne({
      email: TEST_USER.email,
      passwordHash,
      displayName: TEST_USER.displayName,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('🎉 Test user created successfully!');
  }

  console.log(`\n========================================`);
  console.log(`Test Credentials:`);
  console.log(`   Email   : ${TEST_USER.email}`);
  console.log(`   Password: ${TEST_USER.password}`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
