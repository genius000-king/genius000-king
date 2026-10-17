import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
export default defineConfig({plugins:[react(),viteSingleFile()],build:{outDir:'standalone',chunkSizeWarningLimit:3000,rollupOptions:{output:{inlineDynamicImports:true}}}});
