import { defineConfig, loadEnv } from 'vite';
import { createApi } from './server/api.js';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    server: { port: Number(env.VALDORIA_DEV_PORT || 5179), strictPort: true },
    plugins: [{
      name: 'valdoria-api',
      configureServer(server) {
        const { handle, close } = createApi(env);
        server.middlewares.use('/api', (request, response) => handle(request, response));
        server.httpServer?.once('close', close);
      }
    }],
    build: {
      chunkSizeWarningLimit: 800,
      rolldownOptions: { output: { codeSplitting: { groups: [{ name:'three', test:/node_modules[\\/]three[\\/]/ }] } } }
    }
  };
});

