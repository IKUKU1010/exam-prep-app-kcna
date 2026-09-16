# exam-prep-app-kcna
This is a KCNA Examination Preparatory application. This application was developed  using Node.js + Express + SQLite + React-free vanilla frontend for simplicity and easy deployment. This gives you a friendly UI, proper database, and bundled exam generation.. The question bank was built using standard KCNA curriculum.


# Setup Instructions

## Project Structure

```
exam-prep-app-kcna/
├── package.json
├── server.js              # Express server + API
├── db.js                  # SQLite setup & seeding
├── questions.js           # Question bank
├── public/
│   ├── index.html         # Dashboard
│   ├── exam.html          # Exam interface
│   ├── result.html        # Results page
│   ├── styles.css
│   └── app.js
└── kcna.db                # SQLite database (auto-created)
```

## 1. Download the Repository

```bash
git clone https://github.com/IKUKU1010/exam-prep-app-kcna.git
```

## 2. Navigate to the App Directory

```bash
cd exam-prep-app-kcna
```

## 3. Confirm You're in the Right Place

```bash
ls
```

You should see:

```
package.json  server.js  db.js  questions.js  public/
```

## 4. Install Dependencies

First, configure npm to use a user directory:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

Then install the dependencies:

```bash
npm install
```

You should see something like:

```
added 57 packages, and audited 58 packages in 3s
```

## 5. Install PM2 Globally

```bash
npm install -g pm2
```

## 6. Test It Works in the Foreground FIRST

```bash
node server.js
```

You should see:

```
Seeded 200 questions.
Created 5 exam bundles x 60 questions each.
KCNA Prep running at http://localhost:3000
```

Leave it running and open a **second terminal** to test:

```bash
curl http://localhost:3000
curl http://localhost:3000/api/bundles
```

Both should return content. If yes → `Ctrl+C` in the first terminal to stop it, then move to the next step.

## 7. Start the Application in Detached Mode

```bash
pm2 start server.js --name kcna-prep --cwd /home/harry/exam-prep-app-kcna
```

## 8. Verify

```bash
pm2 status          # should show "online", not "errored"
pm2 logs kcna-prep --lines 20
curl http://localhost:3000
```

## 9. Redeploy

```bash
cd /home/harry/exam-prep-app-kcna
```

**1.** Save the updated files (overwrite).

**2.** Wipe the old DB so the new schema + questions get loaded:

```bash
rm -f kcna.db kcna.db-wal kcna.db-shm
```

**3.** Stop the running app (if any):

```bash
pm2 delete kcna-prep 2>/dev/null || true
```

**4.** Rebuild and start fresh:

```bash
node db.js --reseed
pm2 start server.js --name kcna-prep --cwd /home/harry/exam-prep-app-kcna
pm2 save
```

**5.** Verify:

```bash
pm2 status
pm2 logs kcna-prep --lines 30
curl -s http://localhost:3000/api/bundles | head -c 500
```