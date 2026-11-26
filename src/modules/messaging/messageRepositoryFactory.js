import { config } from '../../config/env.js';
import { InMemoryMessageRepository } from './messaging.repository.js';
import { DynamoMessageRepository } from './dynamo.repository.js';

export const messageRepository = (config.USE_DYNAMODB && config.NODE_ENV !== 'test')
  ? new DynamoMessageRepository()
  : new InMemoryMessageRepository();
