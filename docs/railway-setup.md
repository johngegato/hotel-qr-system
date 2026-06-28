# Railway Deployment Setup for Audio Signaling Server

## Why Railway?
Railway is a modern cloud platform that's easier to set up than Oracle Cloud, with a generous free tier and simple deployment workflow.

## Step 1: Create Railway Account
1. Go to https://railway.app
2. Click "Sign Up" (you can sign up with GitHub, which is recommended)
3. Verify your email if required
4. You'll get $5 of free credit per month (no credit card required for trial)

## Step 2: Install Railway CLI (Optional but Recommended)
```bash
# Using npm
npm install -g @railway/cli

# Login to Railway
railway login
```

Alternatively, you can deploy directly from the Railway web dashboard.

## Step 3: Prepare the Project for Deployment

### Option A: Deploy via Railway Dashboard (Easiest)
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select `hotel-qr-system` repository
5. Railway will auto-detect the Node.js project
6. Configure the root directory to `backend/audio-signaling`
7. Click "Deploy"

### Option B: Deploy via Railway CLI
```bash
# Navigate to the audio-signaling directory
cd backend/audio-signaling

# Initialize Railway project
railway init

# Follow the prompts:
# - Project name: hotel-audio-signaling
# - Environment: production

# Deploy
railway up
```

## Step 4: Configure Environment Variables

In Railway Dashboard:
1. Go to your project → Variables tab
2. Add the following variables if needed:
   - `NODE_ENV`: `production`
   - `PORT`: Railway automatically provides this (default: 3000)

**Note:** The server is already configured to use `process.env.PORT` which Railway provides automatically.

## Step 5: Get Your Railway URL

After deployment:
1. Go to your project in Railway Dashboard
2. Click on "Settings" tab
3. Under "Networking", click "Generate Domain"
4. You'll get a URL like: `https://hotel-audio-signaling.up.railway.app`
5. Save this URL - you'll need it for the client apps

## Step 6: Update Client Apps

### Update Guest Web App (`apps/guest-web/test-call.html`)
Change line 132:
```javascript
// Before:
const SERVER_URL = 'http://localhost:5000';

// After:
const SERVER_URL = 'https://your-railway-url.up.railway.app';
```

### Update Front Desk Android App (`apps/front-desk-android/App.js`)
Change line 24:
```javascript
// Before:
const SERVER_URL = 'http://10.0.2.2:5000';

// After:
const SERVER_URL = 'https://your-railway-url.up.railway.app';
```

## Step 7: Verify Deployment

Test the health endpoint:
```bash
curl https://your-railway-url.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "activeCalls": 0,
  "queueLength": 0
}
```

## Step 8: Enable CORS for Production (Important!)

The server currently allows all origins (`origin: "*"`). For production, update `server.js` to restrict CORS:

```javascript
const io = new Server(server, {
  cors: {
    origin: [
      "https://your-guest-web-url.vercel.app",
      "https://your-admin-dashboard-url.vercel.app"
    ],
    methods: ["GET", "POST"]
  }
});
```

## Troubleshooting

### Deployment Fails
- Check that `package.json` exists in `backend/audio-signaling`
- Ensure Node.js version is >= 18 (set in package.json engines)
- Check Railway logs for specific errors

### WebSocket Connection Issues
- Make sure you're using `https://` for the Railway URL
- Railway automatically handles SSL/TLS
- Check that CORS is properly configured

### Free Tier Limits
- Railway free tier: $5 credit/month
- Typical usage for signaling server: ~$1-2/month
- Monitor usage in Railway Dashboard → Billing

## Updating the Deployment

When you make changes to the server code:

### Via CLI:
```bash
cd backend/audio-signaling
railway up
```

### Via Dashboard:
- Railway auto-deploys when you push to GitHub (if connected)
- Or manually trigger deploy from Dashboard → Deployments → Redeploy

## Additional Resources
- Railway Docs: https://docs.railway.app
- Railway Pricing: https://railway.app/pricing
- Custom Domains: https://docs.railway.app/guides/custom-domains