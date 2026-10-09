export interface SandcastleMenuOption {
  text: string
  onselect: () => void | Promise<void>
}

export interface SandcastleGui {
  addToolbarButton(text: string, onClick: () => void | Promise<void>): void
  addToggleButton(
    text: string,
    checked: boolean,
    onChange: (checked: boolean) => void | Promise<void>
  ): void
  addToolbarMenu(options: SandcastleMenuOption[]): void
  reset(): void
}

function runAction(action: () => void | Promise<void>): void {
  void Promise.resolve(action()).catch((cause) => {
    console.error(cause)
  })
}

export function createSandcastleGui(host: HTMLElement): SandcastleGui {
  const reset = () => {
    host.replaceChildren()
  }

  reset()

  return {
    reset,
    addToolbarButton(text, onClick) {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = text
      button.addEventListener("click", () => runAction(onClick))
      host.append(button)
    },
    addToggleButton(text, checked, onChange) {
      const label = document.createElement("label")
      label.className = "gui-toggle"
      const input = document.createElement("input")
      input.type = "checkbox"
      input.checked = checked
      input.addEventListener("change", () => runAction(() => onChange(input.checked)))
      const caption = document.createElement("span")
      caption.textContent = text
      label.append(input, caption)
      host.append(label)
    },
    addToolbarMenu(options) {
      if (!options.length) return
      const select = document.createElement("select")
      for (const option of options) {
        const item = document.createElement("option")
        item.textContent = option.text
        select.append(item)
      }
      select.addEventListener("change", () => {
        const selected = options[select.selectedIndex]
        if (selected) runAction(selected.onselect)
      })
      host.append(select)
    },
  }
}
