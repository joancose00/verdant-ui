# Verdant UI

A comprehensive web interface for exploring Verdant World miner stats and address metrics across Abstract and Base chains.

## Features

- 🔍 **Address Discovery**: Scan blockchain for addresses with miners
- 📊 **Miner Analytics**: View detailed stats for each miner (type, status, rewards, grace periods)
- 💰 **Address Metrics**: Track deposits, withdrawals, and ratios
- 🎨 **Color-Coded UI**: Visual distinction between miner types (Starter, Basic, Advanced, Elite)
- 🔄 **Multi-Chain**: Support for both Abstract and Base networks
- 🎛️ **Advanced Filtering**: Filter by active miners, sort by multiple criteria
- 🌙 **Dark Theme**: Sleek dark interface optimized for web3 users

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd verdant-ui
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred RPC endpoints if needed
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)**

## Usage

### Address Discovery
1. Select your preferred chain (Abstract/Base)
2. Click "Scan for Addresses" to discover addresses with miners
3. Choose scan limit (100-2000 miners)
4. Click any discovered address to auto-populate the query form

### Miner Analysis
- **Filter**: Toggle between "All Miners" and "Active Only"
- **Sort**: Order by miner number, type, rewards, grace period, or status
- **Details**: View comprehensive stats including grace periods, rewards, and maintenance costs

### CLI Tools

**Scan for addresses via command line:**
```bash
npm run scan abstract 500    # Scan 500 miners on Abstract
npm run scan base 1000       # Scan 1000 miners on Base
```

## API Endpoints

- `POST /api/miner-stats` - Get detailed miner statistics
- `POST /api/address-metrics` - Get address deposit/withdrawal metrics  
- `POST /api/scan-addresses` - Discover addresses with miners

## Deployment

### Vercel (Recommended)

1. **Connect to Vercel**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Set environment variables in Vercel dashboard**
   - Copy all variables from `.env.example`
   - Add them in your Vercel project settings

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Other Platforms

The app is a standard Next.js application and can be deployed to:
- Netlify
- Railway  
- DigitalOcean App Platform
- AWS Amplify
- Any Node.js hosting provider

## Tech Stack

- **Framework**: Next.js 15 (React 19)
- **Blockchain**: ethers.js v6
- **Styling**: Inline styles with dark theme
- **APIs**: Next.js API Routes
- **Networks**: Abstract Chain, Base

## Contract Addresses

### Abstract Chain
- **MinerLogic**: `0x6C418a2230DB3EB5Db087384c676aa1351c80f46`
- **StorageCore**: `0xab834B944B7485022Fb01EE0C8c7A393896d1338`

### Base Chain  
- **MinerLogic**: `0xCe3a0Bc9c204E0FB19D207440cBc1eD66Dab14b9`
- **StorageCore**: `0x756B4D800245563228930c536C4d8A95D3ec1DE9`

## Architecture

```
├── app/
│   ├── api/           # Next.js API routes
│   ├── layout.js      # Root layout
│   └── page.js        # Main page
├── components/
│   ├── AddressExplorer.js      # Address discovery UI
│   └── WalletQueryInterface.js # Main query interface
├── utils/
│   └── addressScanner.js       # Blockchain scanning logic
├── contracts/         # Contract ABIs and interfaces
└── scanAddresses.js   # CLI scanner tool
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or issues:
- Open a GitHub issue
- Check the documentation
- Review the contract interfaces in `/contracts`