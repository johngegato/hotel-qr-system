# Deploy Test Call Page for Testing

## Prerequisite: Update SERVER_URL

Once your Railway server is deployed and working, update the URL in `apps/guest-web/test-call.html`:

```javascript
// Line ~132
const SERVER_URL = 'https://artistic-possibility-production.up.railway.app';
```

## Quick Testing Options

### Option 1: Open Locally (Fastest)
1. Open `apps/guest-web/test-call.html` directly in your browser
2. Double-click the file or drag it into Chrome/Firefox
3. The page will work immediately for testing

### Option 2: Netlify Drop (No Account Needed)
1. Go to https://app.netlify.com/drop
2. Drag the `apps/guest-web` folder onto the drop zone
3. Get an instant live URL like `https://random-name-12345.netlify.app`
4. Share the URL with testers

### Option 3: GitHub Pages (Free, Persistent)
1. Push your code to GitHub
2. Go to Repository Settings → Pages
3. Select source: `main` branch, `/apps/guest-web` folder
4. Your site will be at `https://johngegato.github.io/hotel-qr-system/test-call.html`

### Option 4: Vercel (Free, Auto-deploy)
1. Go to https://vercel.com
2. Import your GitHub repo
3. Set output directory to `apps/guest-web`
4. Deploy

## Testing the Call

1. **Open the test page** in your browser
2. **Click "Call Front Desk"** - it will request microphone access
3. **On the Android app** (front desk), you should see the incoming call
4. **Answer or decline** from the Android app

## Troubleshooting

### "Connection refused" or "Server unavailable"
- Make sure your Railway server is running (check `/health` endpoint)
- Verify the SERVER_URL in test-call.html matches your Railway URL

### "Microphone access denied"
- Allow microphone permissions when prompted
- Use HTTPS (required for WebRTC) - localhost works, but remote URLs need HTTPS

### Call doesn't connect
- Check browser console (F12) for errors
- Verify both client and server are using the same Railway URL
- Check Railway logs for any errors