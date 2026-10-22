/**
 * Seed script: creates a test user in MongoDB for local development.
 * Run with: npx ts-node scripts/seed-test-user.ts
 * (from the RepoIntel root, after MongoDB is running)
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/repointel';

const TEST_USER = {
  email: 'test@repointel.dev',
  password: 'Test1234!',
  displayName: 'Test User',
};

async function seed() {
  console.log(`🔌 Connecting to MongoDB: ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected');

  const db = mongoose.connection.db!;
  const users = db.collection('users');

  const existing = await users.findOne({ email: TEST_USER.email });
  if (existing) {
    console.log(`⚠️  User "${TEST_USER.email}" already exists — skipping.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(TEST_USER.password, 12);
  await users.insertOne({
    email: TEST_USER.email,
    passwordHash,
    displayName: TEST_USER.displayName,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('🎉 Test user created!');
  console.log(`   Email   : ${TEST_USER.email}`);
  console.log(`   Password: ${TEST_USER.password}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
