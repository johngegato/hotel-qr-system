# Oracle Cloud VM Setup for Audio Signaling Server

## Step 1: Create Oracle Cloud Account
1. Go to https://cloud.oracle.com
2. Sign up for free account (requires credit card for verification)
3. Verify your email

## Step 2: Create Always Free VM
1. Navigate to **Compute** → **Instances**
2. Click **Create Instance**
3. Configure:
   - **Name**: `hotel-audio-server`
   - **Compartment**: Leave default
   - **Image**: Ubuntu 22.04
   - **Shape**: VM.Standard.A1.Flex (Always Free)
     - OCPU: 1
     - Memory: 2 GB
   - **Networking**: Create new VCN or use default
     - ✅ Assign public IP address
   - **SSH Keys**: Generate or upload your public key
4. Click **Create**

## Step 3: Connect to VM
```bash
ssh -i ~/.ssh/your-private-key.pem ubuntu@YOUR_PUBLIC_IP