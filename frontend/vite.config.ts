import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { normalizeContactPrivacyNoticeVersion } from './src/config/contactPrivacy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  if (
    mode === 'production'
    && !normalizeContactPrivacyNoticeVersion(env.VITE_CONTACT_PRIVACY_NOTICE_VERSION)
  ) {
    throw new Error(
      'Missing or invalid VITE_CONTACT_PRIVACY_NOTICE_VERSION configuration for production build.',
    )
  }

  return {
    plugins: [react()],
    server: {
      watch: {
        usePolling: true,
      },
    },
    resolve: {
      alias: {
        '@assets': '/public/assets',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      restoreMocks: true,
    },
  }
})
