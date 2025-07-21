# Deployment Guide

## 🚀 Quick Deploy to Vercel

### Method 1: GitHub + Vercel Dashboard
1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Verdant UI with miner stats and address explorer"
   git branch -M main
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Deploy via Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variables (see below)
   - Click "Deploy"

### Method 2: Vercel CLI
1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login and Deploy**
   ```bash
   vercel login
   vercel
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add MINER_CONTRACT_ABS
   vercel env add STORAGE_CONTRACT_ABS
   # ... add all env vars from .env.example
   ```

## 🔧 Environment Variables

Add these in your Vercel project settings:

```bash
# Abstract Chain
MINER_CONTRACT_ABS=0x6C418a2230DB3EB5Db087384c676aa1351c80f46
STORAGE_CONTRACT_ABS=0xab834B944B7485022Fb01EE0C8c7A393896d1338
RPC_URL_ABS=https://api.mainnet.abs.xyz

# Base Chain  
MINER_CONTRACT_BASE=0xCe3a0Bc9c204E0FB19D207440cBc1eD66Dab14b9
STORAGE_CONTRACT_BASE=0x756B4D800245563228930c536C4d8A95D3ec1DE9
RPC_URL_BASE=https://mainnet.base.org

# Additional contracts (if needed)
BULK_CONTRACT_ABS=0x57fC741910164a0e1183eAac2A9c23d2AD5E8DD1
ITEM_CONTRACT_ABS=0x4D6995dDa2817a0A08b003d6Cc2e96ab200c38D4
BULK_CONTRACT_BASE=0xF04092Dbf5dB4442B761883c7217a89AA55508a0
ITEM_CONTRACT_BASE=0x4D6995dDa2817a0A08b003d6Cc2e96ab200c38D4
```

## 🌐 Custom Domain

1. **Add Domain in Vercel**
   - Go to Project Settings > Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update DNS Records**
   - Add CNAME record pointing to your Vercel deployment
   - Wait for propagation (usually 5-30 minutes)

## 🔍 Post-Deployment Testing

After deployment, test these features:
- [ ] Chain switching (Abstract ⟷ Base)
- [ ] Address scanning functionality  
- [ ] Miner stats querying
- [ ] Address metrics display
- [ ] Filtering and sorting
- [ ] Grace period indicators
- [ ] Mobile responsiveness

## 📊 Performance Optimization

The app is already optimized with:
- ✅ Static generation where possible
- ✅ Code splitting
- ✅ Optimized images and fonts
- ✅ Tree shaking for smaller bundles
- ✅ Production console removal

## 🐛 Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Check that contract addresses are valid
- Verify RPC endpoints are accessible

### Runtime Errors  
- Check browser console for client-side errors
- Verify Vercel function logs for API errors
- Test contract connectivity with provided RPC URLs

### Performance Issues
- Monitor Vercel analytics
- Check for rate limiting on RPC endpoints
- Consider implementing request caching

## 🔄 Updates

To deploy updates:
```bash
git add .
git commit -m "Update: description of changes"
git push
# Vercel will auto-deploy from GitHub
```

## 📱 Mobile Optimization

The UI is responsive and works on:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (320px - 767px)

## 🔒 Security

- Environment variables are secure in Vercel
- No private keys or secrets in frontend code
- RPC calls use public endpoints only
- CORS is handled by Next.js API routes