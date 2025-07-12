
class ConfigValidator {
  constructor() {
    this.validationRules = {
      schedule: {
        required: false, // Optional because of no_schedule
        type: 'string',
        validator: this.validateCronExpression
      },
      run_on_load: {
        required: false,
        type: 'boolean'
      },
      no_schedule: {
        required: false,
        type: 'boolean'
      },
      bash_script: {
        required: false, // Either bash_script OR npm_script
        type: ['string', 'array']
      },
      npm_script: {
        required: false,
        type: 'string'
      },
      script_location: {
        required: false, // Required when npm_script is used
        type: 'string'
      },
      // optional configuration fields
      timeout: {
        required: false,
        type: 'number',
        min: 1000 // Minimum 1 second
      },
      retry_on_failure: {
        required: false,
        type: 'boolean'
      },
      max_retries: {
        required: false,
        type: 'number',
        min: 0,
        max: 10
      },
      retry_delay: {
        required: false,
        type: 'number',
        min: 1000 // Minimum 1 second
      }
    }
  }

  validateTasks(tasks) {
    const errors = []
    let validTaskCount = 0
    
    for (const [taskId, taskConfig] of Object.entries(tasks)) {
      const taskErrors = this.validateTask(taskId, taskConfig)
      if (taskErrors.length > 0) {
        errors.push(...taskErrors)
      } else {
        validTaskCount++
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      validTaskCount,
      totalTaskCount: Object.keys(tasks).length
    }
  }

  validateTask(taskId, taskConfig) {
    const errors = []
    
    if (!taskConfig.bash_script && !taskConfig.npm_script) {
      errors.push(`Task '${taskId}': Must have either 'bash_script' or 'npm_script'`)
    }
    
    if (taskConfig.npm_script && !taskConfig.script_location) {
      errors.push(`Task '${taskId}': 'script_location' is required when using 'npm_script'`)
    }
    
    if (!taskConfig.no_schedule && !taskConfig.schedule) {
      errors.push(`Task '${taskId}': Must have 'schedule' or set 'no_schedule' to true`)
    }
    
    // Validate individual fields
    for (const [field, rules] of Object.entries(this.validationRules)) {
      if (taskConfig.hasOwnProperty(field)) {
        const fieldErrors = this.validateField(taskId, field, taskConfig[field], rules)
        errors.push(...fieldErrors)
      }
    }
    
    return errors
  }

  validateField(taskId, fieldName, value, rules) {
    const errors = []
    
    if (rules.type) {
      const expectedTypes = Array.isArray(rules.type) ? rules.type : [rules.type]
      const valueType = Array.isArray(value) ? 'array' : typeof value
      
      if (!expectedTypes.includes(valueType)) {
        errors.push(`Task '${taskId}': Field '${fieldName}' should be ${expectedTypes.join(' or ')}, got ${valueType}`)
      }
    }
    
    // Numeric range validation
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`Task '${taskId}': Field '${fieldName}' should be at least ${rules.min}`)
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`Task '${taskId}': Field '${fieldName}' should be at most ${rules.max}`)
      }
    }
    
    // Custom validator
    if (rules.validator && typeof rules.validator === 'function') {
      const validationResult = rules.validator(value)
      if (validationResult !== true) {
        errors.push(`Task '${taskId}': Field '${fieldName}' ${validationResult}`)
      }
    }
    
    return errors
  }

  validateCronExpression(cronExpression) {
    // Basic cron expression validation
    const parts = cronExpression.trim().split(/\s+/)
    if (parts.length !== 5 && parts.length !== 6) {
      return 'should be a valid cron expression (5 or 6 fields)'
    }
    
    const ranges = [
      { name: 'minute', min: 0, max: 59 },
      { name: 'hour', min: 0, max: 23 },
      { name: 'day', min: 1, max: 31 },
      { name: 'month', min: 1, max: 12 },
      { name: 'weekday', min: 0, max: 7 }
    ]
    
    // Skip detailed validation for now, just check basic format
    return true
  }

  isTaskValid(taskConfig) {
    const errors = this.validateTask('temp', taskConfig)
    return errors.length === 0
  }

  // Suggest improvements for task configurations
  suggestImprovements(taskId, taskConfig) {
    const suggestions = []
    
    // Suggest timeout for long-running tasks
    if (!taskConfig.timeout && taskConfig.bash_script) {
      if (Array.isArray(taskConfig.bash_script) && taskConfig.bash_script.length > 5) {
        suggestions.push('Consider adding a timeout for this multi-step task')
      }
    }
    
    // Suggest retry for critical tasks
    if (!taskConfig.retry_on_failure && taskConfig.schedule) {
      const criticalKeywords = ['init', 'pull', 'update', 'start', 'restart']
      const isCritical = criticalKeywords.some(keyword => 
        taskId.toLowerCase().includes(keyword)
      )
      if (isCritical) {
        suggestions.push('Consider enabling retry_on_failure for this critical task')
      }
    }
    
    return suggestions
  }
}

module.exports = { ConfigValidator }
