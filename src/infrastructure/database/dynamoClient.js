import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from '../../config/env.js';

let docClient = null;

export function getDynamoClient() {
  if (docClient) return docClient;

  const clientConfig = {
    region: config.AWS_REGION
  };

  if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY
    };
  }

  if (config.DYNAMODB_ENDPOINT) {
    clientConfig.endpoint = config.DYNAMODB_ENDPOINT;
  }

  const rawClient = new DynamoDBClient(clientConfig);
  docClient = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true }
  });

  return docClient;
}
