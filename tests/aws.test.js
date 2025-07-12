
const AWS = require('aws-sdk')
const { loadSecrets, checkAWSHealth } = require('../src/aws')

jest.mock('../src/aws', () => {
  const originalModule = jest.requireActual('../src/aws');
  return {
    ...originalModule,
    // more mocks to add potentially
  };
});

describe('AWS Integration', () => {
  let mockDynamoClient
  
  beforeEach(() => {
    mockDynamoClient = {
      get: jest.fn().mockReturnValue({
        promise: jest.fn()
      })
    }
    AWS.DynamoDB.DocumentClient.mockImplementation(() => mockDynamoClient)
    mockDynamoClient.get.mockReturnValue(mockDynamoClient)
  })
  
  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.NODE_ENV
    delete process.env.USE_LOCALSTACK
  })
  
  describe('LocalStack Configuration', () => {
    test('should configure AWS client for LocalStack in development', () => {
      process.env.NODE_ENV = 'local'
      
      // Re-require the module to trigger LocalStack configuration
      delete require.cache[require.resolve('../src/aws')]
      require('../src/aws')
      
      expect(AWS.DynamoDB.DocumentClient).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'http://localhost:4566',
          region: 'us-east-1',
          accessKeyId: 'test',
          secretAccessKey: 'test'
        })
      )
    })
    
    test('should use default AWS configuration in production', () => {
      process.env.NODE_ENV = 'production'
      
      delete require.cache[require.resolve('../src/aws')]
      require('../aws')
      
      expect(AWS.DynamoDB.DocumentClient).toHaveBeenCalledWith({})
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
      
      mockDynamoClient.promise.mockResolvedValue({ Item: mockSecrets })
      
      await loadSecrets()
      
      expect(process.env.AVAX_RPC).toBe('https://api.avax.network/ext/bc/C/rpc')
      expect(process.env.ETHEREUM_RPC).toBe('https://rpc.ankr.com/eth')
      expect(process.env.IS_COOLIFY_TASK).toBe('true')
    })
    
    test('should handle missing secrets gracefully', async () => {
      mockDynamoClient.promise.mockResolvedValue({ Item: null })
      
      // Should not throw an error
      await expect(loadSecrets()).resolves.toBeUndefined()
    })
    
    test('should use fallback secrets when DynamoDB is unavailable in LocalStack', async () => {
      process.env.NODE_ENV = 'local'
      
      const resourceNotFoundError = new Error('Table not found')
      resourceNotFoundError.code = 'ResourceNotFoundException'
      mockDynamoClient.promise.mockRejectedValue(resourceNotFoundError)
      
      delete require.cache[require.resolve('../src/aws')]
      const { loadSecrets: localLoadSecrets } = require('../src/aws')
      
      await localLoadSecrets()
      
      // Should have fallback values
      expect(process.env.IS_COOLIFY_TASK).toBe('true')
    })
  })
  
  describe('Health Checks', () => {
    test('should report healthy when DynamoDB is accessible', async () => {
      mockDynamoClient.promise.mockResolvedValue({ Item: {} })
      
      const health = await checkAWSHealth()
      
      expect(health.healthy).toBe(true)
      expect(health.service).toBe('dynamodb')
    })
    
    test('should report unhealthy when DynamoDB is inaccessible', async () => {
      mockDynamoClient.promise.mockRejectedValue(new Error('Connection failed'))
      
      const health = await checkAWSHealth()
      
      expect(health.healthy).toBe(false)
      expect(health.service).toBe('dynamodb')
      expect(health.error).toBe('Connection failed')
    })
  })
})
