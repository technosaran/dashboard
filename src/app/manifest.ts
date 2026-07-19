import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  // Use a version query for icon URLs to force PWA refresh on update
  const version = "2.0.8"; // This can be dynamic based on your build or package.json
  
  return {
    name: 'arthaX — Wealth Terminal',
    short_name: 'arthaX',
    description: 'arthaX personal wealth terminal — track stocks, mutual funds, expenses, income, and automate transaction alerts',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#06080f',
    theme_color: '#6c5ce7',
    icons: [
      {
        src: `/icon-192.png?v=${version}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/icon-192.png?v=${version}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `/icon-512.png?v=${version}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/icon-512.png?v=${version}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: "Quick Action",
        short_name: "Add",
        url: "/dashboard?action=new",
        icons: [{ src: `/icon-192.png?v=${version}`, sizes: "192x192" }]
      },
      {
        name: "Ledger History",
        short_name: "History",
        url: "/dashboard/ledger",
        icons: [{ src: `/icon-192.png?v=${version}`, sizes: "192x192" }]
      }
    ]
  }
}
