# Useful MongoDB Commands

Connect to the local MongoDB container first:

```bash
docker exec -it ai-running-coach-mongodb-1 mongosh
```

Then run any of the commands below inside the shell.

---

```js
use running-coach

db.auth.find().toArray()                                                                // Check lockout state

db.auth.updateOne({ _id: 'lockout' }, { $set: { failureCount: 0, blocked: false } })    // Unlock the app

db.plans.deleteMany({})                                                                 // Delete all plans

db.messages.deleteMany({})                                                              // Delete all messages

db.runs.deleteMany({})                                                                  // Delete all runs
```
