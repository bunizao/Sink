import { addPlugin, createResolver, defineNuxtModule, extendPages } from 'nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'tuu-ui' },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    extendPages((pages) => {
      const homepage = pages.find(page => page.path === '/')
      if (homepage)
        homepage.file = resolve('../custom/tuu/Home.vue')
      else
        pages.push({ name: 'index', path: '/', file: resolve('../custom/tuu/Home.vue') })
    })

    nuxt.hook('app:resolve', (app) => {
      app.errorComponent = resolve('../custom/tuu/Error.vue')
      app.layouts['tuu-home'] = {
        name: 'tuu-home',
        file: resolve('../custom/tuu/Layout.vue'),
      }
    })

    const stylesheetIndex = nuxt.options.css.indexOf('@/assets/css/tailwind.css')
    if (stylesheetIndex < 0)
      throw new Error('Tuu UI requires the upstream Tailwind stylesheet')

    nuxt.options.css.splice(stylesheetIndex, 1, resolve('../custom/tuu/theme.css'))
    addPlugin(resolve('../custom/tuu/head.ts'))

    nuxt.hook('prepare:types', ({ tsConfig, nodeTsConfig }) => {
      tsConfig.include?.push(resolve('../custom/tuu/**/*'))
      nodeTsConfig.exclude?.push(resolve('../custom/tuu/**/*'))
    })
  },
})
