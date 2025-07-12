
const AWS = require('aws-sdk');
const { loadSecrets, checkAWSHealth } = require('../src/aws');


var mockDocumentClient;

jest.mock('aws-sdk', () => {
  mockDocumentClient = {
    get: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    }
  };
});

describe('AWS Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentClient.promise.mockReset();
  })

  afterEach(() => {
    delete process.env.NODE_ENV
    delete process.env.USE_LOCALSTACK
  })

  describe('LocalStack Configuration', () => {
    test('should configure AWS client for LocalStack in development', () => {
      process.env.NODE_ENV = 'local'
      
      jest.isolateModules(() => {
        // This ensures the mock is used within this isolated module scope
        const AWS = require('aws-sdk');
        require('../src/aws');
        
        expect(AWS.DynamoDB.DocumentClient).toHaveBeenCalledWith(
          expect.objectContaining({
            endpoint: 'http://localhost:4566',
            region: 'us-east-1',
            accessKeyId: 'test',
            secretAccessKey: 'test'
          })
        );
      });
    })

    test('should use default AWS configuration in production', () => {
      process.env.NODE_ENV = 'production'
      
      jest.isolateModules(() => {
        const AWS = require('aws-sdk');
        require('../src/aws');
        
        expect(AWS.DynamoDB.DocumentClient).toHaveBeenCalledWith({});
      });
    })
  })

  describe('Secret Loading', () => {
    test('should load secrets from DynamoDB successfully', async () => {
      const mockSecrets = {
        PK: 'lambda-secrets',
        AVAX_RPC: 'https://api.avax.network/ext/bc/C/rpc',
        ETHEREUM_RPC: 'https://rpc.ankr.com/eth',
        IS_COOLIFY_TASK: 'true'
      }
      
      mockDocumentClient.promise.mockResolvedValue({ Item: mockSecrets }) 
      
      await loadSecrets()
      
      expect(process.env.AVAX_RPC).toBe('https://api.avax.network/ext/bc/C/rpc')
      expect(process.env.ETHEREUM_RPC).toBe('https://rpc.ankr.com/eth')
      expect(process.env.IS_COOLIFY_TASK).toBe('true')
    })

    test('should handle missing secrets gracefully', async () => {
      mockDocumentClient.promise.mockResolvedValue({ Item: null }) 
      
      // Should not throw an error
      await expect(loadSecrets()).resolves.toBeUndefined()
    })

    test('should use fallback secrets when DynamoDB is unavailable in LocalStack', async () => {
      process.env.NODE_ENV = 'local'
      
      const resourceNotFoundError = new Error('Table not found')
      resourceNotFoundError.code = 'ResourceNotFoundException'
      mockDocumentClient.promise.mockRejectedValue(resourceNotFoundError)  
      
      delete require.cache[require.resolve('../src/aws')]
      const { loadSecrets: localLoadSecrets } = require('../src/aws')
      
      await localLoadSecrets()
      
      // Should have fallback values
      expect(process.env.IS_COOLIFY_TASK).toBe('true')
    })
  })

  describe('Health Checks', () => {
    test('should report healthy when DynamoDB is accessible', async () => {
      mockDocumentClient.promise.mockResolvedValue({ Item: {} }) 
      
      const health = await checkAWSHealth()
      
      expect(health.healthy).toBe(true)
      expect(health.service).toBe('dynamodb')
    })

    test('should report unhealthy when DynamoDB is inaccessible', async () => {
      mockDocumentClient.promise.mockRejectedValue(new Error('Connection failed')) 
      
      const health = await checkAWSHealth()
      
      expect(health.healthy).toBe(false)
      expect(health.service).toBe('dynamodb')
      expect(health.error).toBe('Connection failed')
    })
  })
})
