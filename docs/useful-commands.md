# Useful MongoDB Commands

Connect to the local MongoDB container first:

```bash
docker exec -it ai-running-coach-mongodb-1 mongosh
```

Then run any of the commands below inside the shell.

---

```js
use running-coach

// ── Users ────────────────────────────────────────────────────────────────────

db.users.find().toArray()                                                       // List all users

db.users.insertOne({                                                            // Seed a new user
  email: "you@example.com",
  passwordHash: "<bcrypt hash — see below>",
  isAdmin: true,
  tempPassword: true,
  createdAt: new Date(),
  updatedAt: new Date()
})

db.users.updateOne(                                                             // Force password reset
  { email: "you@example.com" },
  { $set: { tempPassword: true, updatedAt: new Date() } }
)

db.users.deleteOne({ email: "you@example.com" })                               // Delete a user

// ── Refresh tokens ───────────────────────────────────────────────────────────

db.refresh_tokens.deleteMany({})                                               // Force all users to re-login

db.refresh_tokens.deleteMany({ userId: ObjectId("<user _id here>") })          // Force one user to re-login

// ── App data ─────────────────────────────────────────────────────────────────

db.plans.deleteMany({})                                                         // Delete all plans

db.messages.deleteMany({})                                                      // Delete all messages

db.runs.deleteMany({})                                                          // Delete all runs
```

---

## Generate a bcrypt hash (for seeding users)

Run from the `api/` directory:

```bash
node -e "require('bcrypt').hash('yourpassword', 10).then(console.log)"
```
