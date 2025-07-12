
const { spawn } = require('child_process');
const cron = require('node-cron');
const fs = require('fs')
const path = require('path')
const { loadSecrets } = require('./aws')

const { TaskMonitor } = require('./task-monitor')
const { TaskExecutor } = require('./task-executor')
const { ConfigValidator } = require('./config-validator')

cron.schedule('1 * * * *', hotloadTasks)

const scheduledTasks = {}
process.env.IS_COOLIFY_TASK = 'true'

const taskMonitor = new TaskMonitor()
const taskExecutor = new TaskExecutor()
const configValidator = new ConfigValidator()

async function load() {
  console.log('Starting the enhanced app...')
  
  await taskMonitor.initialize()
  console.log('Task monitoring initialized')
  
  await hotloadTasks(true)
}

load()

async function hotloadTasks(isFirstRun) {
  console.log('Running Tasks: ', Object.keys(scheduledTasks))
  
  await loadSecrets()
  
  // configuration validation before processing tasks
  const { tasks, isValid, errors } = readAndValidateTasks()
  if (!isValid) {
    console.error('Configuration validation failed:', errors)
    // Continue with valid tasks, skip invalid ones and
    // never crash the entire system due to config issues
  }
  
  removeDelistedTasks()
  await scheduleNewTasks()

  function readAndValidateTasks() {
    const rootFolder = isFirstRun === true ? __dirname : 'runner/src'
    const file = path.join(rootFolder, process.env.TASK_FILE)
    const rawTasks = JSON.parse(fs.readFileSync(file))
    
    // Validate task configuration
    const validation = configValidator.validateTasks(rawTasks.tasks)
    return {
      tasks: rawTasks.tasks,
      isValid: validation.isValid,
      errors: validation.errors
    }
  }

  function removeDelistedTasks() {
    for (const id of Object.keys(scheduledTasks)) {
      if (tasks[id]) continue;
      console.log('Stop scheduled task', id)
      
      // Record task stopping in monitor
      taskMonitor.recordTaskEvent(id, 'stopped', { reason: 'delisted' })
      
      scheduledTasks[id].stop()
      delete scheduledTasks[id]
    }
  }

  async function scheduleNewTasks() {
    for (const [id, taskObj] of Object.entries(tasks)) {
      if (scheduledTasks[id]) continue;
      
      if (!configValidator.isTaskValid(taskObj)) {
        console.warn(`Skipping invalid task: ${id}`)
        continue
      }
      
      console.log('Start scheduled task', id)
      
      const taskFn = formEnhancedTaskFunction(id, taskObj)
      
      if (taskObj.run_on_load) {
        try {
          await taskFn()
        } catch (e) {
          console.log('Error running task first time', id, e)
          // Record initial execution failure
          taskMonitor.recordTaskEvent(id, 'initial_run_failed', { error: e.message })
        }
      }
      
      if (taskObj.no_schedule === true || !taskObj.schedule) continue;
      scheduledTasks[id] = cron.schedule(taskObj.schedule, taskFn)
      
      taskMonitor.recordTaskEvent(id, 'scheduled', { schedule: taskObj.schedule })
    }
  }

  function formEnhancedTaskFunction(id, taskObj) {
    return async () => {
      const executionId = `${id}_${Date.now()}`
      taskObj.name = id
      
      // Pre-execution monitoring
      taskMonitor.recordTaskEvent(id, 'execution_started', { executionId })
      const startTime = Date.now()
      
      try {
        let result
        
        if (taskObj.npm_script) {
          result = await taskExecutor.runNpmCommandWithEnhancements(taskObj, executionId)
        } else {
          result = await taskExecutor.spawnPromiseWithEnhancements(taskObj, executionId)
        }
        
        // Record successful execution
        const duration = Date.now() - startTime
        taskMonitor.recordTaskEvent(id, 'execution_completed', {
          executionId,
          duration,
          result
        })
        
        return result
        
      } catch (e) {
        // Enhanced error handling and recording
        const duration = Date.now() - startTime
        taskMonitor.recordTaskEvent(id, 'execution_failed', {
          executionId,
          duration,
          error: e.message,
          stack: e.stack
        })
        
        console.log('Error running task', id, e)
        
        // Optional retry logic for critical tasks
        if (taskObj.retry_on_failure && taskObj.max_retries > 0) {
          console.log(`Scheduling retry for task ${id}`)
          setTimeout(() => {
            taskObj.max_retries--
            formEnhancedTaskFunction(id, taskObj)()
          }, (taskObj.retry_delay || 60000))
        }
        throw e
      }
    }
  }

  async function runNpmCommand({ npm_script, name, script_location }) {
    return spawnPromise({
      name,
      bash_script: `
        cd repo/${script_location}
        npm run ${npm_script}
      `
    })
  }

  // Original spawn promise with enhancements in TaskExecutor
  async function spawnPromise({ bash_script, name }) {
    const start = +new Date()
    if (Array.isArray(bash_script)) bash_script = bash_script.join('\n')
    console.log('[Start]', name)
    return new Promise((resolve, reject) => {
      const childProcess = spawn('bash', ['-c', bash_script], { stdio: 'inherit' });

      childProcess.on('close', (code) => {
        const runTime = ((+(new Date) - start) / 1e3).toFixed(1)
        console.log(`[Done] ${name} | runtime: ${runTime}s`)
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Child process exited with code ${code}`));
        }
      });
    });
  }
}

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...')
  await taskMonitor.shutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  await taskMonitor.shutdown()
  process.exit(0)
})
