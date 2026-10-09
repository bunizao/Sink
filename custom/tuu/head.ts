const icons: Record<string, string> = {
  '/icon-192.png': '/tuu/icon-192.png',
  '/apple-touch-icon.png': '/tuu/apple-touch-icon.png',
  '/favicon.ico': '/tuu/favicon.ico',
  '/icon.png': '/tuu/icon.png',
}

export default defineNuxtPlugin(() => {
  // Match upstream's head entries so Unhead deduplicates them before rewriting.
  useHead({
    link: [
      { rel: 'icon', type: 'image/png', href: '/icon-192.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'shortcut icon', href: '/favicon.ico' },
    ],
  })

  injectHead().hooks.hook('tags:resolve', ({ tags }) => {
    for (const tag of tags) {
      const icon = tag.props.href ? icons[tag.props.href] : undefined
      if (tag.tag === 'link' && icon)
        tag.props.href = icon
    }
  })
})
