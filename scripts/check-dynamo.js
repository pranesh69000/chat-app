import { config } from '../src/config/env.js';
import { getDynamoClient } from '../src/infrastructure/database/dynamoClient.js';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { userRepository } from '../src/modules/auth/userRepositoryFactory.js';

console.log('--- DIAGNOSTIC CHECK ---');
console.log('1. Configuration values:');
console.log('   USE_DYNAMODB:', config.USE_DYNAMODB);
console.log('   DYNAMODB_TABLE_NAME:', config.DYNAMODB_TABLE_NAME);
console.log('   AWS_REGION:', config.AWS_REGION);
console.log('   AWS_ACCESS_KEY_ID present:', Boolean(config.AWS_ACCESS_KEY_ID));
console.log('   AWS_SECRET_ACCESS_KEY present:', Boolean(config.AWS_SECRET_ACCESS_KEY));
console.log('   Active Repo Class:', userRepository.constructor.name);

console.log('\n2. Testing Connection to AWS DynamoDB Table...');
try {
  const client = getDynamoClient();
  const res = await client.send(new DescribeTableCommand({ TableName: config.DYNAMODB_TABLE_NAME }));
  console.log('   ✓ SUCCESS: Found AWS Table:', res.Table.TableName);
  console.log('   ✓ Status:', res.Table.TableStatus);
  console.log('   ✓ Items in table:', res.Table.ItemCount);

  console.log('\n3. Testing Write to DynamoDB...');
  const testPhone = '+919876543210';
  await userRepository.createUser({
    id: 'test-user-diag-1',
    phoneNumber: testPhone,
    passwordHash: 'hash-test-123'
  });
  console.log('   ✓ SUCCESS: User written to DynamoDB!');

  console.log('\n4. Testing Read from DynamoDB...');
  const readUser = await userRepository.findUserByPhone(testPhone);
  console.log('   ✓ SUCCESS: User read back:', readUser);

  console.log('\n=============================================');
  console.log('ALL AWS DYNAMODB CHECKS PASSED SUCCESSFULLY!');
  console.log('=============================================');
} catch (err) {
  console.error('\n❌ ERROR CONNECTING TO AWS DYNAMODB:');
  console.error('Error Code:', err.code || err.name);
  console.error('Error Message:', err.message);
  console.log('\nTroubleshooting tips:');
  console.log('1. Verify your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env are correct without extra spaces.');
  console.log('2. Verify the table name in .env matches the AWS Console (PrivateChatAppTable).');
  console.log('3. Verify AWS_REGION matches the region where you created the table (ap-south-1 for Mumbai).');
}
