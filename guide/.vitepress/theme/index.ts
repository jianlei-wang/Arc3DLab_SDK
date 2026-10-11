import type { Theme } from "vitepress"
import DefaultTheme from "vitepress/theme"
import { h } from "vue"
import PeerLinks from "./PeerLinks.vue"
import "./custom.css"

const theme: Theme = {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "nav-bar-content-after": () => h(PeerLinks),
    })
  },
}

export default theme
