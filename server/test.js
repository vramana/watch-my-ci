import express from 'express'

import PgBoss from 'pg-boss';

const boss = new PgBoss('postgres://user:pass@host/database');

boss.on('error', error => console.error(error));


const syncWorkflowsQueue = 'workflowsSync';

const app = express();

app.get('/public/:owner/:repo', async (req, res) => {
    await boss.send(syncWorkflowsQueue, { owner: req.params.owner, repo: req.params.repo });
    res.json({})
})




app.listen(9000, async () => {
    await boss.start();
    boss.work(syncWorkflowsQueue, () => {
        // get github workflows
        // save in database
    })
    console.log("server is ready")
})