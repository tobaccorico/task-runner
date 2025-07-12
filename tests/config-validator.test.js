
const { ConfigValidator } = require('../src/config-validator')

describe('ConfigValidator', () => {
  let validator
  
  beforeEach(() => {
    validator = new ConfigValidator()
  })
  
  describe('Task Validation', () => {
    test('should validate correct bash script task', () => {
      const task = {
        schedule: '*/5 * * * *',
        bash_script: ['echo "test"'],
        run_on_load: true
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors).toHaveLength(0)
    })
    
    test('should validate correct npm script task', () => {
      const task = {
        schedule: '*/10 * * * *',
        npm_script: 'test',
        script_location: 'defi'
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors).toHaveLength(0)
    })
    
    test('should require script_location for npm_script tasks', () => {
      const task = {
        schedule: '*/10 * * * *',
        npm_script: 'test'
        // Missing script_location
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors).toContain("Task 'test-task': 'script_location' is required when using 'npm_script'")
    })
    
    test('should require either bash_script or npm_script', () => {
      const task = {
        schedule: '*/10 * * * *'
        // Missing both bash_script and npm_script
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors).toContain("Task 'test-task': Must have either 'bash_script' or 'npm_script'")
    })
    
    test('should allow no_schedule tasks without schedule', () => {
      const task = {
        no_schedule: true,
        bash_script: 'echo "test"'
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors).toHaveLength(0)
    })
    
    test('should require schedule if no_schedule is not set', () => {
      const task = {
        bash_script: 'echo "test"'
        // Missing schedule and no_schedule not set
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors).toContain("Task 'test-task': Must have 'schedule' or set 'no_schedule' to true")
    })
  })
  
  describe('Enhanced Field Validation', () => {
    test('should validate timeout field', () => {
      const task = {
        schedule: '*/5 * * * *',
        bash_script: 'echo "test"',
        timeout: 30000
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors).toHaveLength(0)
    })
    
    test('should reject invalid timeout values', () => {
      const task = {
        schedule: '*/5 * * * *',
        bash_script: 'echo "test"',
        timeout: 500 // Too small
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors.some(e => e.includes('should be at least 1000'))).toBe(true)
    })
    
    test('should validate retry configuration', () => {
      const task = {
        schedule: '*/5 * * * *',
        bash_script: 'echo "test"',
        retry_on_failure: true,
        max_retries: 3,
        retry_delay: 5000
      }
      
      const errors = validator.validateTask('test-task', task)
      expect(errors).toHaveLength(0)
    })
  })
  
  describe('Configuration Suggestions', () => {
    test('should suggest timeout for complex tasks', () => {
      const task = {
        schedule: '*/5 * * * *',
        bash_script: [
          'git pull',
          'npm install',
          'npm run build',
          'npm run test',
          'npm run deploy',
          'npm run cleanup'
        ]
      }
      
      const suggestions = validator.suggestImprovements('complex-task', task)
      expect(suggestions.some(s => s.includes('timeout'))).toBe(true)
    })
    
    test('should suggest retry for critical tasks', () => {
      const suggestions = validator.suggestImprovements('init-server', {
        schedule: '*/30 * * * *',
        bash_script: 'start-server.sh'
      })
      
      expect(suggestions.some(s => s.includes('retry_on_failure'))).toBe(true)
    })
  })
})
