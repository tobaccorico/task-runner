
const AWS = require('aws-sdk')

const isLocalDevelopment = process.env.NODE_ENV === 'local' || 
                           process.env.USE_LOCALSTACK === 'true'
const clientConfig = {}
if (isLocalDevelopment) {
  clientConfig.endpoint = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566'
  clientConfig.region = 'us-east-1'
  clientConfig.accessKeyId = 'test'
  clientConfig.secretAccessKey = 'test'
  console.log('Using LocalStack for development:', clientConfig.endpoint)
}

const client = new AWS.DynamoDB.DocumentClient(clientConfig)


async function getDDBItem(table, id) {
  if (!table) table = process.env.SECRET_TABLE ?? 'secrets'
  if (!id) id = process.env.SECRET_TABLE_ID ?? 'lambda-secrets'
  
  try {
    return client.get({ TableName: table, Key: { PK: id } }).promise()
  } catch (error) {
    if (isLocalDevelopment && error.code === 'ResourceNotFoundException') {
      console.warn(`Table ${table} not found in LocalStack, using fallback configuration`)
      return { Item: getFallbackSecrets() }
    }
    throw error
  }
}

// for when DynamoDB isn't available
function getFallbackSecrets() {
  return {
    PK: 'lambda-secrets',
    // Add common development environment variables
    AVAX_RPC: process.env.AVAX_RPC || 'https://api.avax.network/ext/bc/C/rpc',
    IS_COOLIFY_TASK: 'true',
    // Add other common RPC endpoints for development
    ETHEREUM_RPC: process.env.ETHEREUM_RPC || 'https://rpc.ankr.com/eth',
    BSC_RPC: process.env.BSC_RPC || 'https://bsc-dataseed.binance.org/',
    POLYGON_RPC: process.env.POLYGON_RPC || 'https://polygon-rpc.com'
  }
}

async function loadSecrets() {
  try {
    const { Item: secrets } = await getDDBItem()
    
    if (!secrets) {
      console.warn('No secrets found, using environment variables only')
      return
    }
    
    Object.entries(secrets).forEach(([key, value]) => {
      if (key !== 'PK' && key !== 'SK') process.env[key] = value
    })
    
    console.log('[test env] AVAX_RPC:', process.env.AVAX_RPC)
    console.log('[test env] IS_COOLIFY_TASK:', process.env.IS_COOLIFY_TASK)
    
  } catch (error) {
    // Graceful degradation (sic) if secrets loading fails
    console.error('Failed to load secrets from DynamoDB:', error.message)
    console.log('Continuing with environment variables only')
  }
}

async function checkAWSHealth() {
  try {
    await getDDBItem()
    return { healthy: true, service: 'dynamodb' }
  } catch (error) {
    return { 
      healthy: false, 
      service: 'dynamodb', 
      error: error.message 
    }
  }
}

module.exports = {
  loadSecrets,
  checkAWSHealth,
}
