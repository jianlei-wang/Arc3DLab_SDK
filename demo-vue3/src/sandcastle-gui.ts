export interface SandcastleMenuOption {
  text: string
  onselect: () => void | Promise<void>
}

export interface SandcastleSliderOptions {
  min?: number
  max?: number
  step?: number
  value: number
}

export interface SandcastleGui {
  addToolbarButton(text: string, onClick: () => void | Promise<void>): void
  addToggleButton(
    text: string,
    checked: boolean,
    onChange: (checked: boolean) => void | Promise<void>
  ): void
  addFpsMeter(
    initialVisible: boolean,
    onChange: (visible: boolean) => void | Promise<void>
  ): { setValue(fps: number): void }
  addToolbarMenu(options: SandcastleMenuOption[]): void
  addMenubarItem(
    label: string,
    options: string[],
    value: string,
    onChange: (value: string) => void | Promise<void>
  ): void
  addSlider(
    label: string,
    options: SandcastleSliderOptions,
    onChange: (value: number) => void | Promise<void>
  ): void
  addNumberInput(
    label: string,
    value: number,
    onChange: (value: number) => void | Promise<void>
  ): void
  addTextInput(
    label: string,
    value: string,
    onChange: (value: string) => void | Promise<void>
  ): void
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

  const createField = (label: string): { field: HTMLLabelElement; caption: HTMLSpanElement } => {
    const field = document.createElement("label")
    field.className = "gui-field"
    const caption = document.createElement("span")
    caption.className = "gui-field-label"
    caption.textContent = label
    field.append(caption)
    return { field, caption }
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
    addFpsMeter(initialVisible, onChange) {
      const label = document.createElement("label")
      label.className = "gui-toggle"
      const input = document.createElement("input")
      input.type = "checkbox"
      input.checked = initialVisible
      input.addEventListener("change", () => runAction(() => onChange(input.checked)))
      const caption = document.createElement("span")
      caption.textContent = "FPS"
      const readout = document.createElement("span")
      readout.className = "gui-field-value"
      readout.textContent = "--"
      label.append(input, caption, readout)
      host.append(label)
      return {
        setValue(fps) {
          readout.textContent = Number.isFinite(fps) ? String(fps) : "--"
        },
      }
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
    addMenubarItem(label, options, value, onChange) {
      if (!options.length) return
      const { field } = createField(label)
      const select = document.createElement("select")
      for (const option of options) {
        const item = document.createElement("option")
        item.textContent = option
        select.append(item)
      }
      const initial = options.indexOf(value)
      if (initial >= 0) select.selectedIndex = initial
      select.addEventListener("change", () => {
        const selected = options[select.selectedIndex]
        if (selected !== undefined) runAction(() => onChange(selected))
      })
      field.append(select)
      host.append(field)
    },
    addSlider(label, options, onChange) {
      const { field } = createField(label)
      const input = document.createElement("input")
      input.type = "range"
      input.min = String(options.min ?? 0)
      input.max = String(options.max ?? 100)
      input.step = String(options.step ?? 1)
      input.value = String(options.value)
      const readout = document.createElement("span")
      readout.className = "gui-field-value"
      readout.textContent = String(options.value)
      input.addEventListener("input", () => {
        const value = Number(input.value)
        readout.textContent = String(value)
        runAction(() => onChange(value))
      })
      field.append(input, readout)
      host.append(field)
    },
    addNumberInput(label, value, onChange) {
      const { field } = createField(label)
      const input = document.createElement("input")
      input.type = "number"
      input.value = String(value)
      input.addEventListener("change", () => runAction(() => onChange(Number(input.value))))
      field.append(input)
      host.append(field)
    },
    addTextInput(label, value, onChange) {
      const { field } = createField(label)
      const input = document.createElement("input")
      input.type = "text"
      input.value = value
      input.addEventListener("change", () => runAction(() => onChange(input.value)))
      field.append(input)
      host.append(field)
    },
  }
}
