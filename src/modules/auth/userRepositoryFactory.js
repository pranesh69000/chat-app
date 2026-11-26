import { config } from '../../config/env.js';
import { InMemoryUserRepository } from './auth.repository.js';
import { DynamoUserRepository } from './dynamo.repository.js';

// When running "npm test", process.env.NODE_ENV is set or we default to in-memory for zero network dependency
export const userRepository = (config.USE_DYNAMODB && process.env.NODE_ENV !== 'test')
  ? new DynamoUserRepository()
  : new InMemoryUserRepository();
