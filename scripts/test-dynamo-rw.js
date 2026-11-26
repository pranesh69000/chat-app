import { config } from '../src/config/env.js';
import { userRepository } from '../src/modules/auth/userRepositoryFactory.js';

console.log('--- TESTING DYNAMODB WRITE & READ ---');
const testPhone = '+919999988888';

try {
  console.log('1. Writing user to DynamoDB...');
  await userRepository.createUser({
    id: 'test-user-id-123',
    phoneNumber: testPhone,
    passwordHash: 'test-hash'
  });
  console.log('✓ Successfully wrote user to DynamoDB!');

  console.log('2. Reading user back from DynamoDB...');
  const user = await userRepository.findUserByPhone(testPhone);
  console.log('✓ Read back from DynamoDB:', user);
} catch (err) {
  console.error('DynamoDB Error:', err.message);
}
