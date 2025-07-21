export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Verdant UI - Miner Stats & Metrics</title>
      </head>
      <body style={{ 
        margin: 0, 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        minHeight: '100vh'
      }}>
        {children}
      </body>
    </html>
  );
}