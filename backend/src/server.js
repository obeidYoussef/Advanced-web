import { app } from './app.js'
import { env } from './config/env.js'
import { startEmailWorker } from './jobs/emailWorker.js'

app.listen(env.PORT, () => {
    console.log(`Hotel API running at http://localhost:${env.PORT}`)
    startEmailWorker()
})
