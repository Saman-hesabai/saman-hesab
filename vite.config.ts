import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/saman-hesab/',

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'سامان حساب',
        short_name: 'سامان حساب',
        description: 'دفتر حساب هوشمند فروشگاه',
        theme_color: '#10b981',
        background_color: '#f4f7fb',
        display: 'standalone',
        start_url: '/saman-hesab/',
        icons: [
          {
            src: '/saman-hesab/favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
})
