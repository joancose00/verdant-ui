export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Verdant UI - Miner Stats & Metrics</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta charSet="utf-8" />
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