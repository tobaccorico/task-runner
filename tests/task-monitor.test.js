
const { TaskMonitor } = require('../src/task-monitor')
const fs = require('fs').promises

describe('TaskMonitor', () => {
  let monitor
  
  beforeEach(async () => {
    monitor = new TaskMonitor()
    await monitor.initialize()
  })
  
  afterEach(async () => {
    await monitor.shutdown()
  })
  
  describe('Event Recording', () => {
    test('should record task events', () => {
      monitor.recordTaskEvent(
        'test-task', 'execution_started', 
        { executionId: 'test-123' })
      
      const events = monitor.getRecentEvents(1)
      expect(events).toHaveLength(1)
      expect(events[0].taskId).toBe('test-task')
      expect(events[0].eventType).toBe('execution_started')
      expect(events[0].metadata.executionId).toBe('test-123')
    })
    
    test('should update task statistics', () => {
      monitor.recordTaskEvent('test-task', 'execution_started')
      monitor.recordTaskEvent('test-task', 'execution_completed', { duration: 5000 })
      
      const stats = monitor.getTaskStats('test-task')
      expect(stats.totalExecutions).toBe(1)
      expect(stats.successfulExecutions).toBe(1)
      expect(stats.failedExecutions).toBe(0)
      expect(stats.averageDuration).toBe(5000)
    })
    
    test('should track failed executions', () => {
      monitor.recordTaskEvent('test-task', 'execution_started')
      monitor.recordTaskEvent('test-task', 'execution_failed', { duration: 2000 })
      
      const stats = monitor.getTaskStats('test-task')
      expect(stats.totalExecutions).toBe(1)
      expect(stats.successfulExecutions).toBe(0)
      expect(stats.failedExecutions).toBe(1)
    })
  })
  
  describe('Health Status', () => {
    test('should calculate health status correctly', () => {
      // Add some successful tasks
      monitor.recordTaskEvent('healthy-task-1', 'execution_started')
      monitor.recordTaskEvent('healthy-task-1', 'execution_completed')
      monitor.recordTaskEvent('healthy-task-2', 'execution_started')
      monitor.recordTaskEvent('healthy-task-2', 'execution_completed')
      
      // Add a failing task
      monitor.recordTaskEvent('failing-task', 'execution_started')
      monitor.recordTaskEvent('failing-task', 'execution_failed')
      
      const health = monitor.getHealthStatus()
      expect(health.totalTasks).toBe(3)
      expect(health.healthyTasks).toBe(2)
      expect(health.unhealthyTasks).toBe(1)
    })
  })
})
