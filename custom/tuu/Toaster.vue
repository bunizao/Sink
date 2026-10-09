<script setup lang="ts">
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })

const route = useRoute()
const attrs = useAttrs()
const DashboardToaster = defineAsyncComponent(() => import('@/components/ui/sonner/Sonner.vue'))
const DeferredToaster = () => h(DashboardToaster as Component, attrs)
</script>

<template>
  <!-- Keep dashboard notifications out of the public terminal's startup graph. -->
  <DeferredToaster v-if="route.path.startsWith('/dashboard')" />
</template>
