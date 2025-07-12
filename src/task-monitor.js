// @dev Adds comprehensive monitoring
// (preserves existing task execution behavior)

const fs = require('fs').promises
const path = require('path')

class TaskMonitor {
  constructor() {
    this.events = []
    this.taskStats = new Map()
    this.logFile = path.join(__dirname, '../logs/task-monitor.log')
    this.isInitialized = false
  }

  async initialize() {
    if (this.isInitialized) return
    
    // Ensure logs directory exists
    await fs.mkdir(path.dirname(this.logFile), { recursive: true }).catch(() => {})
    
    // Start periodic cleanup of old events (keep last 1000 events)
    setInterval(() => {
      if (this.events.length > 1000) {
        this.events = this.events.slice(-1000)
      }
    }, 60000) // Every minute
    
    this.isInitialized = true
    console.log('Task monitor initialized')
  }

  recordTaskEvent(taskId, eventType, metadata = {}) {
    const event = {
      taskId,
      eventType,
      timestamp: new Date().toISOString(),
      metadata
    }
    
    this.events.push(event)
    this.updateTaskStats(taskId, eventType, metadata)
    this.logEvent(event)
  }

  updateTaskStats(taskId, eventType, metadata) {
    if (!this.taskStats.has(taskId)) {
      this.taskStats.set(taskId, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalDuration: 0,
        averageDuration: 0,
        lastExecution: null,
        lastSuccess: null,
        lastFailure: null
      })
    }
    
    const stats = this.taskStats.get(taskId)
    
    switch (eventType) {
      case 'execution_started':
        stats.totalExecutions++
        stats.lastExecution = metadata.timestamp || new Date().toISOString()
        break
        
      case 'execution_completed':
        stats.successfulExecutions++
        stats.lastSuccess = metadata.timestamp || new Date().toISOString()
        if (metadata.duration) {
          stats.totalDuration += metadata.duration
          stats.averageDuration = stats.totalDuration / stats.successfulExecutions
        }
        break
        
      case 'execution_failed':
        stats.failedExecutions++
        stats.lastFailure = metadata.timestamp || new Date().toISOString()
        if (metadata.duration) {
          stats.totalDuration += metadata.duration
          stats.averageDuration = stats.totalDuration / (stats.successfulExecutions + stats.failedExecutions)
        }
        break
    }
  }

  async logEvent(event) {
    try {
      const logLine = JSON.stringify(event) + '\n'
      await fs.appendFile(this.logFile, logLine)
    } catch (error) {
      console.error('Failed to write to task monitor log:', error.message)
    }
  }

  getTaskStats(taskId) {
    return this.taskStats.get(taskId) || null
  }

  getAllTaskStats() {
    return Object.fromEntries(this.taskStats)
  }

  getRecentEvents(limit = 100) {
    return this.events.slice(-limit)
  }

  getHealthStatus() {
    const totalTasks = this.taskStats.size
    const healthyTasks = Array.from(this.taskStats.values()).filter(stats => {
      const successRate = stats.totalExecutions > 0 ? 
        stats.successfulExecutions / stats.totalExecutions : 0
      return successRate >= 0.8 // 80% success rate threshold
    }).length

    return {
      totalTasks,
      healthyTasks,
      unhealthyTasks: totalTasks - healthyTasks,
      overallHealth: totalTasks > 0 ? healthyTasks / totalTasks : 1
    }
  }

  async shutdown() {
    // Save final stats before shutdown
    try {
      const statsFile = path.join(__dirname, '../logs/task-stats-final.json')
      await fs.writeFile(statsFile, JSON.stringify(this.getAllTaskStats(), null, 2))
      console.log('Task stats saved to:', statsFile)
    } catch (error) {
      console.error('Failed to save final task stats:', error.message)
    }
  }
}

module.exports = { TaskMonitor }
