import { defineConfig } from 'vite';
import postcssConfig from './postcss.config.ts';
import injectHTML from 'vite-plugin-html-inject';
import FullReload from 'vite-plugin-full-reload';
import fg from 'fast-glob';

export default defineConfig(({ command }) => {
  return {
    define: {
      ...{
        [command === 'serve' ? 'global' : '_global']: {},
      },
    },
    base: './',
    plugins: [
      injectHTML(),
      FullReload(['./src/**/*.{html,css,js,ts}']),
    ],
    css: {
      postcss: postcssConfig,
    },
    build: {
      minify: false,
      rollupOptions: {
        input: fg
          .sync(['./*.html', './src/**/*.html'])
          .reduce((entries, file) => {
            const name = file.slice(
              file.lastIndexOf('/') + 1,
              file.lastIndexOf('.'),
            );
            entries[name] = file;
            return entries;
          }, {}),
        output: {
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
    server: {
      open: '/game.html',
      watch: {
        usePolling: true,
      },
    },
  };
});

