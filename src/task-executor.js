
const { spawn } = require('child_process')

class TaskExecutor {
  constructor() {
    this.activeExecutions = new Map()
  }

  async runNpmCommandWithEnhancements({ npm_script, name, script_location, timeout }, executionId) {
    const bashScript = `
      cd repo/${script_location}
      npm run ${npm_script}
    `
    
    return this.spawnPromiseWithEnhancements({
      name, bash_script: bashScript,
      timeout
    }, executionId)
  }

  async spawnPromiseWithEnhancements({ bash_script, name, timeout }, executionId) {
    const start = +new Date()

    if (Array.isArray(bash_script)) bash_script = bash_script.join('\n')
    
    console.log('[Start]', name)
    
    return new Promise((resolve, reject) => {
      const childProcess = spawn('bash', ['-c', bash_script], { stdio: 'inherit' })
      
      // Track active execution
      this.activeExecutions.set(executionId, {
        process: childProcess,
        name,
        startTime: start
      })
      
      // Optional timeout handling
      let timeoutId
      if (timeout && timeout > 0) {
        timeoutId = setTimeout(() => {
          console.log(`[Timeout] ${name} exceeded ${timeout}ms, killing process`)
          childProcess.kill('SIGTERM')
          
          // Give it 5 seconds to terminate gracefully, then force kill
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL')
            }
          }, 5000)
          
          reject(new Error(`Task ${name} timed out after ${timeout}ms`))
        }, timeout)
      }
      
      childProcess.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId)
        this.activeExecutions.delete(executionId)
        
        const runTime = ((+(new Date) - start) / 1e3).toFixed(1)
        console.log(`[Done] ${name} | runtime: ${runTime}s`)
        
        if (code === 0) {
          resolve({
            success: true,
            exitCode: code,
            duration: +(new Date) - start,
            runtime: runTime
          })
        } else {
          reject(new Error(`Child process exited with code ${code}`))
        }
      })
      
      childProcess.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId)
        this.activeExecutions.delete(executionId)
        console.error(`[Error] ${name}:`, error.message)
        reject(error)
      })
    })
  }

  getActiveExecutions() {
    const active = []
    for (const [executionId, execution] of this.activeExecutions) {
      active.push({
        executionId,
        name: execution.name,
        startTime: execution.startTime,
        duration: Date.now() - execution.startTime
      })
    }
    return active
  }

  // for graceful shutdown
  async killAllActiveExecutions() {
    const promises = []
    
    for (const [executionId, execution] of this.activeExecutions) {
      promises.push(new Promise((resolve) => {
        console.log(`Terminating execution: ${execution.name}`)
        execution.process.kill('SIGTERM')
        
        execution.process.on('close', () => {
          this.activeExecutions.delete(executionId)
          resolve()
        })
        
        // Force kill after 10 seconds
        setTimeout(() => {
          if (this.activeExecutions.has(executionId)) {
            execution.process.kill('SIGKILL')
            this.activeExecutions.delete(executionId)
            resolve()
          }
        }, 10000)
      }))
    }
    
    await Promise.all(promises)
    console.log('All active executions terminated')
  }
}

module.exports = { TaskExecutor }
