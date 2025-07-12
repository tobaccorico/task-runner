
const { checkAWSHealth } = require('./aws')
const fs = require('fs').promises
const path = require('path')

async function performHealthCheck() {
  console.log('🏥 DefiLlama Task Runner Health Check')
  console.log('=====================================')
  
  const health = {
    overall: true,
    timestamp: new Date().toISOString(),
    checks: {}
  }
  
  try {
    const awsHealth = await checkAWSHealth()
    health.checks.aws = awsHealth
    console.log(`✅ AWS/DynamoDB: ${awsHealth.healthy ? 'Healthy' : 'Unhealthy'}`)
    
    if (!awsHealth.healthy) {
      console.log(`❌ Error: ${awsHealth.error}`)
      health.overall = false
    }
  } catch (error) {
    health.checks.aws = { healthy: false, error: error.message }
    health.overall = false
    console.log('❌ AWS/DynamoDB: Failed to check')
  }
  
  try {
    const taskFile = process.env.TASK_FILE || 'api2.json'
    const taskPath = path.join(__dirname, '..', taskFile)
    await fs.access(taskPath)
    
    const taskContent = JSON.parse(await fs.readFile(taskPath, 'utf8'))
    const taskCount = Object.keys(taskContent.tasks || {}).length
    
    health.checks.taskConfig = {
      healthy: true,
      taskFile,
      taskCount
    }
    console.log(`✅ Task Configuration: ${taskCount} tasks configured`)
  } 
  catch (error) {
    health.checks.taskConfig = { healthy: false, error: error.message }
    health.overall = false
    console.log('❌ Task Configuration: Failed to read')
  }
 
  try {
    const logsDir = path.join(__dirname, '../logs')
    await fs.mkdir(logsDir, { recursive: true })
    
    const monitorLog = path.join(logsDir, 'task-monitor.log')
    const logExists = await fs.access(monitorLog).then(() => true).catch(() => false)
    
    health.checks.monitoring = {
      healthy: true,
      logsDirectory: logsDir,
      monitorLogExists: logExists
    }
    console.log(`✅ Monitoring: Logs directory accessible`)
  } 
  catch (error) {
    health.checks.monitoring = { healthy: false, error: error.message }
    console.log('⚠️ Monitoring: Issues with logs directory')
  }
  
  const requiredRepos = ['repo', 'runner']
  for (const repo of requiredRepos) {
    try {
      const repoPath = path.join(__dirname, '..', repo)
      await fs.access(repoPath)
      
      health.checks[`repo_${repo}`] = { healthy: true, path: repoPath }
      console.log(`✅ Repository ${repo}: Found`)
    }
    catch (error) {
      health.checks[`repo_${repo}`] = { healthy: false, error: 'Not found' }
      console.log(`⚠️ Repository ${repo}: Not found (will be cloned on first run)`)
    }
  }
  
  console.log('=====================================')
  console.log(`🏥 Overall Health: ${health.overall ? 'HEALTHY' : 'UNHEALTHY'}`)
  
  try {
    const healthFile = path.join(__dirname, '../logs/health-report.json')
    await fs.writeFile(healthFile, JSON.stringify(health, null, 2))
    console.log(`📊 Health report saved to: ${healthFile}`)
  } 
  catch (error) {
    console.log('⚠️ Could not save health report:', error.message)
  }
  return health
}

if (require.main === module) {
  performHealthCheck().then(health => {
    process.exit(health.overall ? 0 : 1)
  }).catch(error => {
    console.error('Health check failed:', error)
    process.exit(1)
  })
}

module.exports = { performHealthCheck }
