import '../workers/email-worker'

console.log('Email worker process started')

// Keep the process running
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully')
  process.exit(0)
})