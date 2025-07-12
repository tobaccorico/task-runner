
const { spawn } = require('child_process')

async function setupLocalStack() {
  console.log('🚀 Setting up LocalStack for development...')
  
  try {
    const response = await fetch('http://localhost:4566/health')
    if (response.ok) {
      console.log('✅ LocalStack is already running')
    }
  } catch (error) {
    console.log('❌ LocalStack is not running')
    console.log('Please start LocalStack with: localstack start')
    return false
  }
  
  try {
    const AWS = require('aws-sdk')
    const dynamodb = new AWS.DynamoDB({
      endpoint: 'http://localhost:4566',
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test'
    })
    
    const tableParams = {
      TableName: 'secrets',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }
    
    await dynamodb.createTable(tableParams).promise()
    console.log('✅ Created DynamoDB table: secrets')
  
    const docClient = new AWS.DynamoDB.DocumentClient({
      endpoint: 'http://localhost:4566',
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test'
    })
    
    await docClient.put({
      TableName: 'secrets',
      Item: {
        PK: 'lambda-secrets',
        AVAX_RPC: 'https://api.avax.network/ext/bc/C/rpc',
        ETHEREUM_RPC: 'https://rpc.ankr.com/eth',
        BSC_RPC: 'https://bsc-dataseed.binance.org/',
        IS_COOLIFY_TASK: 'true'
      }
    }).promise()
    
    console.log('✅ Added sample secrets to DynamoDB')
    
  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log('✅ DynamoDB table already exists')
    } else {
      console.log('❌ Failed to setup DynamoDB:', error.message)
      return false
    }
  }
  
  console.log('🎉 LocalStack setup complete!')
  console.log('You can now run: npm run local')
  return true
}

if (require.main === module) {
  setupLocalStack().catch(error => {
    console.error('Setup failed:', error)
    process.exit(1)
  })
}

module.exports = { setupLocalStack }
